import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';

export function createComponent() {
    
}

export function registerView(id: string, component: any) {
    console.log(`Registering ${id}`);
}

export function App(props: any) {
    return (
        <HelmetProvider context={props?.helmetContext}>
            <div>From the client</div>
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