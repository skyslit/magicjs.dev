import { createDevServer } from '@skyslit/ark-devtools/build/dev-server';

export function buildApp(watch: boolean = false) {
    const mode: 'development' | 'production' = watch === true ? 'development' : 'production';
    console.log(`Compiling for '${mode}' environment`);
    const cwd = process.cwd();

    createDevServer({
        cwd
    });
}