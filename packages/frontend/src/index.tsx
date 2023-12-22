import React from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import UrlPattern from 'url-pattern';
import { BackendRemote } from './backend';
import axios, { Axios } from 'axios';
import _path from 'path';

const path = _path.posix;

function* infinite() {
    let index = 0;
    let timestamp = (new Date()).valueOf();

    const g = () => `${timestamp}_${index}`;

    while (true) {
        index++;

        yield g();
    }

    return g();
}

export const generator = infinite();

type Context = {
    token: string
    isAuthenticated: boolean,
    currentUser: any
}

const getCookies = function () {
    var pairs = document.cookie.split(";");
    var cookies: any = {};
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split("=");
        cookies[(pair[0] + '').trim()] = unescape(pair.slice(1).join('='));
    }
    return cookies;
}

export class FrontendController {
    static instance: FrontendController;
    static getInstance() {
        if (!FrontendController.instance) {
            FrontendController.instance = new FrontendController();
        }

        return FrontendController.instance;
    }

    registeredComponents: any[] = [];
    arkConfig: any = null;
    context = {
        token: null,
        isAuthenticated: false,
        currentUser: null
    }
    map: any = {};
    applets: any[] = [];
    client: Axios = axios.create();

    subscribe(event: string, handler: any): () => void {
        let id = String(generator.next().value);

        if (!this.map[event]) {
            this.map[event] = {};
        }

        this.map[event][id] = async (...args: any[]) => {
            try {
                if (handler) {
                    await Promise.resolve(handler(...args));
                }
            } catch (e) {
                console.error(e);
            }
        };

        return () => {
            delete this.map[event][id]
        }
    }

    async emit(event: string, ...args: any[]): Promise<void> {
        if (this.map[event]) {
            const handlers = Object.keys(this.map[event]).map((k) => this.map[event][k]);
            await Promise.allSettled(handlers.map((h) => h && h(...args)));
        }
    }

    async refreshContext() {
        const res = await axios.post('/__backend/__context');
        this.context = res.data;
        this.emit('core/context/change', this.context)
    }

    setAuthCookie(v: any) {
        const hasChanged = this?.context?.token !== v;
        if (hasChanged === true) {
            this.refreshContext();
        }
        this.context.token = v;
    }

    constructor() {
        this.refreshContext.bind(this);

        this.client.interceptors.response.use((v) => {
            let authToken = getCookies();
            authToken = authToken['authorization'] || null;
            this.setAuthCookie(authToken);
            return v;
        });

        /** Attempt to hydrate the state */
        try {
            // @ts-ignore
            const ___ark_hydrated_state___ = globalThis['___ark_hydrated_state___'];
            if (___ark_hydrated_state___) {
                this.context = ___ark_hydrated_state___;
            }
        } catch (e) {
            console.error(e);
        }
    }
}

export const backend = BackendRemote.getInstance();
export const controllerRef = FrontendController.getInstance();
// @ts-ignore
export const ControllerContext = React.createContext<FrontendController>(null);

/* -------------------------------------------------------------------------- */
/*                                 Core Hooks                                 */
/* -------------------------------------------------------------------------- */

export function useLogin() {
    const controller = React.useContext(ControllerContext);
    const [context, setContext] = React.useState<Context>(controller.context as any);

    React.useEffect(() => {
        const handler = (ctx: any) => {
            setContext(ctx);
        }

        const unsub = controller.subscribe('core/context/change', handler);
        return unsub;
    }, []);

    const logout = React.useCallback(async () => {
        return await controller.client.post('/__backend/__context/logout');
    }, []);

    return { current: context, logout }
}

export function useAxios() {
    const { controller } = useController();
    return controller.client;
}

export function useController() {
    const controller = React.useContext(ControllerContext);
    return { controller }
}

/* -------------------------------------------------------------------------- */
/*                                    View                                    */
/* -------------------------------------------------------------------------- */

interface ReactComponent { (...props: any[]): any; getInitialState?: () => any; }

export function createComponent(component: ReactComponent) {
    return component;
}

export function registerView(path: string, id: string, Component: any) {
    controllerRef.registeredComponents.push({
        path,
        Component
    })
}

export function registerApplet(meta: any, Component: any) {
    controllerRef.applets.push({
        ...meta,
        Component
    });
}

/* -------------------------------------------------------------------------- */
/*                                Route Begins                                */
/* -------------------------------------------------------------------------- */

type RouteApi = {
    pathname: string,
    match?: any,
    component?: any
    push: (path: string) => void
    isInitialRender: boolean
}

// @ts-ignore
const RouteProvider = React.createContext<RouteApi>(null);
const RouteMetaContext = React.createContext<any>(null);
const AppletMetaContext = React.createContext<any>(null);

export function attachRouteMeta(routeMeta: any, Comp: any) {
    return (props: any) => (
        <RouteMetaContext.Provider value={routeMeta}>
            <Comp {...props} />
        </RouteMetaContext.Provider>
    )
}

export function attachAppletMeta(appletMeta: any, Comp: any) {
    return (props: any) => (
        <AppletMetaContext.Provider value={appletMeta}>
            <Comp {...props} />
        </AppletMetaContext.Provider>
    )
}

export function useRouteMeta() {
    return React.useContext(RouteMetaContext);
}

export function useAppletMeta() {
    return React.useContext(AppletMetaContext);
}

function createRoute(defaultRoot: string, controller: FrontendController): RouteApi {
    const [isInitialRender, setIsInitialRender] = React.useState(true);
    const [pathname, setPathname] = React.useState(defaultRoot || globalThis?.window?.location?.pathname);

    React.useEffect(() => {
        window.onpopstate = () => {
            setIsInitialRender(false);
            setPathname(window.location.pathname);
        }
    }, [])

    const push = React.useCallback((path: string) => {
        window.history.pushState({}, '', path);
        setIsInitialRender(false);
        setPathname(path);
    }, []);

    const [match, component] = React.useMemo(() => {
        let match: any;
        let component: any;
        for (const item of controller.registeredComponents) {
            const pattern = new UrlPattern(item.path);
            match = pattern.match(pathname);

            if (match) {
                component = item;
                break;
            }
        }
        
        return [match, component];
    }, [pathname]);

    return {
        pathname,
        match,
        component,
        push,
        isInitialRender
    }
}

export function useRoute(): RouteApi {
    return React.useContext(RouteProvider);
}

export function useParams() {
    const { pathname } = useRoute();
    const routeMeta = useRouteMeta();
    const appletMeta = useAppletMeta();
    const { controller } = useController();

    const routeInfo = React.useMemo(() => {
        return getRouteInfoByPageId(routeMeta?.pageId, controller);
    }, [pathname, routeMeta?.pageId]);

    let url: string = React.useMemo(() => {
        if (routeInfo) {
            const { path } = routeInfo;
            try {
                return path
            } catch (e) {
                console.error(e);
                return path;
            }
        }

        return '';
    }, [routeInfo]);

    let appletUrl = React.useMemo(() => {
        if (appletMeta) {
            let mounts = getMountsByPageId(routeMeta?.pageId, controller);
            let currentMount = mounts.find((m) => m.appletId === appletMeta?.genricPath);
            return currentMount?.path || '';
        }

        return '';
    }, [pathname, routeMeta?.pageId]);


    const finalUrl = React.useMemo(() => {
        return path.join(url, appletUrl);
    }, [url, appletUrl]);

    const params = React.useMemo(() => {
        const pattern = new UrlPattern(finalUrl);
        return pattern.match(pathname);
    }, [finalUrl, pathname]);

    return params;
}

function PageRenderer(props: any) {
    const { component, isInitialRender, pathname } = useRoute();

    if (!component?.Component) {
        return (
            <iframe style={{ width: '100vw', height: '100vh' }} src={`https://mern.ai/templates/__notfound?path=${pathname}`} />
        );
    }

    const Component = React.useMemo(() => {
        return component.Component;
    }, [component.Component]);

    if (isInitialRender === false) {
        return (
            <React.Suspense fallback={<div>Lazy Loading</div>}>
                <Component {...props} />
            </React.Suspense>
        )
    }

    return (
        <Component {...props} />
    )
}

function getRouteInfoByPageId(pageId: string, controller: FrontendController) {
    if (Array.isArray(controller?.arkConfig?.routes)) {
        return controller.arkConfig.routes.find((r: any) => r.pageId === pageId);
    }

    return null;
}

export type LinkDisplayProps = {
    pageId?: string,
    appletId?: string
    params?: any,
    children?: (props: { url: string }) => JSX.Element
}

export function LinkDisplay(props: LinkDisplayProps): JSX.Element {
    const { params } = props;
    const routeMeta = useRouteMeta();
    const appletMeta = useAppletMeta();
    const { controller } = useController();

    const pageId = React.useMemo(() => {
        return props?.pageId || routeMeta?.pageId;
    }, [props.pageId, routeMeta?.pageId]);

    const routeInfo = React.useMemo(() => {
        return getRouteInfoByPageId(pageId, controller);
    }, [pageId]);

    let url: string = React.useMemo(() => {
        if (routeInfo) {
            const { path } = routeInfo;
            try {
                const pat = new UrlPattern(path);
                return pat.stringify(params)
            } catch (e) {
                console.error(e);
                return path;
            }
        }

        return '';
    }, [routeInfo, params]);

    let appletUrl = React.useMemo(() => {
        if (props.appletId) {
            let mounts = getMountsByPageId(pageId, controller);

            let mount: any = mounts.find((m) => m.appletId === props.appletId);

            if (!mount) {
                mount = mounts.find((m) => m.appletId === path.join(appletMeta?.featurePath, props?.appletId || ''));
            }

            if (mount) {
                const pat = new UrlPattern(mount.path);
                return pat.stringify(params);
            }
        }

        return '';
    }, [pageId, props.appletId, appletMeta?.featurePath]);

    const finalUrl = React.useMemo(() => {
        return path.join(url, appletUrl);
    }, [url, appletUrl])

    if (finalUrl && props?.children && finalUrl !== '.') {
        return props.children({ url: finalUrl })
    }

    return (<></>)
}

export function Link(props: { to?: string, children?: any, className?: string }) {
    const { to } = props;
    const { push } = useRoute();

    return (
        <a className={props.className} href={to} onClick={(e) => {
            e.preventDefault();
            if (to) {
                push(to);
            }
        }}>
            {props.children}
        </a>
    )
}

/* -------------------------------------------------------------------------- */
/*                                 Route Ends                                 */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*                                   Portal                                   */
/* -------------------------------------------------------------------------- */

export function Applet(props: { id: string } & any) {
    const { controller } = useController();
    const { id, ...rest } = props;
    const applet = React.useMemo(() => {
        for (const applet of controller.applets) {
            const isIdMatching = (applet?.resolvers || []).indexOf(id) > -1;
            if (isIdMatching === true) {
                return applet;
            }
        }
    }, [id]);

    if (!applet) {
        return null;
    }

    return (
        <applet.Component {...rest} />
    )
}

export function Mount(props: { path: string }) {
    const { controller } = useController();
    const routeMeta = useRouteMeta();

    const id = React.useMemo(() => {
        if (routeMeta?.pageId) {
            const mounts = getMountsByPageId(routeMeta?.pageId, controller);
            const mount = mounts.find((m) => {
                const pattern = new UrlPattern(m.path);
                return Boolean(pattern.match(props.path));
            });
            if (mount) {
                return mount.appletId
            }
        }

        return null;
    }, [routeMeta?.pageId, props.path]);

    if (id) {
        return (
            <Applet id={id} />
        )
    }

    return (
        <></>
    )
}

/* -------------------------------------------------------------------------- */
/*                                   Mounts                                   */
/* -------------------------------------------------------------------------- */

export type Mounts = {
    appletId: string,
    path: string,
    label: string,
    link: boolean
    pageId: string
}

function getMountsByPageId(pageId: string, controller: FrontendController): Mounts[] {
    const m = controller.applets.reduce((acc, app) => {
        const matchingMounts = app.mounts.filter((m: any) => m.pageId === pageId);
        acc.push(...matchingMounts.map((mount: any) => {
            let pathVal = (mount?.path || app.genricPath);

            if (mount?.pathPostfix) {
                pathVal = path.posix.join(pathVal, mount?.pathPostfix);
            }

            return {
                sort: 0,
                ...mount,
                label: mount?.label || app.defaultLabel,
                path: pathVal,
                resolvers: app.resolvers,
                appletId: app.resolvers[0]
            }
        }));
        return acc;
    }, []).sort((a: any, b: any) => {
        if (a.sort > b.sort) {
            return 1;
        } else if (a.sort < b.sort) {
            return -1;
        }
        return 0;
    });

    return m;
}

export function useMounts() {
    const { controller } = useController();
    const meta = useRouteMeta();
    const mounts: Mounts[] = React.useMemo(() => {
        if (meta?.pageId) {
            return getMountsByPageId(meta?.pageId, controller);
        }

        return [];
    }, [meta?.pageId]);

    return { current: mounts }
}

/* -------------------------------------------------------------------------- */
/*                                    Auth                                    */
/* -------------------------------------------------------------------------- */

export function Protected(props: any) {
    const { current } = useLogin();

    if (current.isAuthenticated === false) {
        return (
            <div style={{ height: '100vh', width: '100vw', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <h1 className='text-5xl'>401 Unauthorized. You need to be signed in to access this page.</h1>
            </div>
        )
    }

    return props.children;
}

export function App(props: { initialPath?: any, helmetContext?: any, controller?: FrontendController }) {
    const controller = React.useMemo(() => {
        return props.controller || FrontendController.getInstance()
    }, [props.controller]);
    const route = createRoute(props?.initialPath, controller);

    return (
        <HelmetProvider context={props?.helmetContext}>
            <RouteProvider.Provider value={route}>
                <ControllerContext.Provider value={controller}>
                    <PageRenderer />
                </ControllerContext.Provider>
            </RouteProvider.Provider>
        </HelmetProvider>
    )
}

export function startApp() {
    const rootElem = document.getElementById('root');
    if (rootElem) {
        const shouldHydrate = (globalThis as any)?.___ark_hydrated_state___?.shouldHydrate === true;
        if (shouldHydrate === true) {
            hydrateRoot(rootElem, <App />);
        } else {
            const root = createRoot(rootElem);
            root.render(<App />);
        }
    }
}

/* -------------------------------------------------------------------------- */
/*                                   Config                                   */
/* -------------------------------------------------------------------------- */

export function loadConfig(config: any) {
    const properties = config?.properties || [];

    return {
        getValue(propertyName: string, defaultVal?: any): any {
            const p = properties.find((p: any) => p?.name === propertyName);
            return p?.value || defaultVal;
        }
    }
}
