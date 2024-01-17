import { runBuild } from '@magicjs.dev/devtools/build/dev-server';
import chalk from 'chalk';

export function buildApp(watch: boolean = false, runtimeUrl?: string) {
    const mode: 'development' | 'production' = watch === true ? 'development' : 'production';
    if (mode === 'development') {
        console.clear();
        console.log(chalk.blue(`Compiling for '${mode}' environment`));
        const cwd = process.cwd();
        runBuild({
            cwd,
            runtimeUrl
        });
    } else {
        console.log('Building...');
        const cwd = process.cwd();
        runBuild({
            cwd,
            runtimeUrl,
            env: 'production'
        });
    }
}