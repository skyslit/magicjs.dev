import React from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import UrlPattern from 'url-pattern';
import { BackendRemote } from './backend';
import axios, { Axios } from 'axios';

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
export const controller = FrontendController.getInstance();
export const ControllerContext = React.createContext(controller);

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
    return controller.client;
}

/* -------------------------------------------------------------------------- */
/*                                    View                                    */
/* -------------------------------------------------------------------------- */

interface ReactComponent { (): any; getInitialState?: () => any; }

export function createComponent(component: ReactComponent) {
    return component;
}

export function registerView(path: string, id: string, Component: any) {
    controller.registeredComponents.push({
        path,
        Component
    })
}

export function registerApplet(meta: any, Component: any) {
    controller.applets.push({
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
}

// @ts-ignore
const RouteProvider = React.createContext<RouteApi>(null);

function createRoute(defaultRoot: string): RouteApi {
    const [pathname, setPathname] = React.useState(defaultRoot || globalThis?.window?.location?.pathname);

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
        component
    }
}

export function useRoute(): RouteApi {
    return React.useContext(RouteProvider);
}

function PageRenderer(props: any) {
    const { component } = useRoute();
    

    if (!component) {
        return (
            <div>Not Found</div>
        )
    }

    return (
        <component.Component />
    )
}

export type LinkDisplayProps = {
    pageId: string,
    params?: any,
    children?: (props: { url: string }) => JSX.Element
}
export function LinkDisplay(props: LinkDisplayProps): JSX.Element {
    const { pageId, params } = props;
    const routeInfo = React.useMemo(() => {
        if (Array.isArray(controller?.arkConfig?.routes)) {
            return controller.arkConfig.routes.find((r: any) => r.pageId === pageId);
        }

        return null;
    }, [pageId]);

    const url: string = React.useMemo(() => {
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

        return null as any;
    }, [routeInfo, params]);

    if (url && props?.children) {
        return props.children({ url })
    }

    return (<></>)
}

/* -------------------------------------------------------------------------- */
/*                                 Route Ends                                 */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*                                   Portal                                   */
/* -------------------------------------------------------------------------- */

export function Applet(props: { id: string }) {
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

export function App(props: { initialPath?: any, helmetContext?: any, controller?: FrontendController }) {
    const route = createRoute(props?.initialPath);
    return (
        <HelmetProvider context={props?.helmetContext}>
            <RouteProvider.Provider value={route}>
                <ControllerContext.Provider value={props.controller || controller}>
                    <PageRenderer />
                </ControllerContext.Provider>
            </RouteProvider.Provider>
        </HelmetProvider>
    )
}

export function startApp() {
    const rootElem = document.getElementById('root');
    if (rootElem) {
        const root = createRoot(rootElem);
        root.render(<App />);
    }
}