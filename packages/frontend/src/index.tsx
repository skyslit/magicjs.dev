import React from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import UrlPattern from 'url-pattern';

export class FrontendController {
    static instance: FrontendController;
    static getInstance() {
        if (!FrontendController.instance) {
            FrontendController.instance = new FrontendController();
        }

        return FrontendController.instance;
    }

    registeredComponents: any[] = []
}

const controller = FrontendController.getInstance();

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

/* -------------------------------------------------------------------------- */
/*                                 Route Ends                                 */
/* -------------------------------------------------------------------------- */

export function App(props: { initialPath?: any, helmetContext?: any }) {
    const route = createRoute(props?.initialPath);
    return (
        <HelmetProvider context={props?.helmetContext}>
            <RouteProvider.Provider value={route}>
                <PageRenderer />
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