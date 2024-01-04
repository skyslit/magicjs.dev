import { createDevServer } from '@magicjs.dev/devtools/build/dev-server';
import chalk from 'chalk';

export function buildApp(watch: boolean = false, runtimeUrl?: string) {
    const mode: 'development' | 'production' = watch === true ? 'development' : 'production';
    console.clear();
    console.log(chalk.blue(`Compiling for '${mode}' environment`));
    const cwd = process.cwd();

    createDevServer({
        cwd,
        runtimeUrl
    });
}