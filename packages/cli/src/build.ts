import { SPABuilder, BackendBuilder } from '@skyslit/ark-devtools';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';

export function buildApp(watch: boolean = false) {
    const mode: 'development' | 'production' = watch === true ? 'development' : 'production';
    console.log(`Compiling for '${mode}' environment`);
    const cwd = process.cwd();

    let appProcess: ChildProcess;

    const runApp = () => {
        if (mode === 'development') {
            if (appProcess) {
                appProcess.kill('SIGTERM');
            }
            const appPath: string = path.join(cwd, 'build', 'server', 'main.js');
    
            if (!fs.existsSync(appPath)) {
                console.log('');
                console.log('Waiting for output...');
                return false;
            }
    
            appProcess = spawn('node', [appPath], {
                stdio: 'inherit',
            });
        }
    };

    const frontendBuilder = new SPABuilder('client', path.join(cwd, 'src/client.tsx'));
    const backendBuilder = new BackendBuilder(path.join(cwd, 'src/server.tsx'));

    backendBuilder.attachMonitor((err, result) => {
        try {
            if (err) throw err;

            if (result) {
                if (result.compilation.errors.length > 0) {
                    console.error(result.compilation.errors);
                }
                if (result.compilation.warnings.length > 0) {
                    console.warn(result.compilation.warnings);
                }
            }

            console.log('Backend output ready');
            runApp();
        } catch (e) {
            console.error(e);
        }
    })

    frontendBuilder.attachMonitor((err, result) => {
        try {
            if (err) throw err;

            if (result) {
                if (result.compilation.errors.length > 0) {
                    console.error(result.compilation.errors);
                }
                if (result.compilation.warnings.length > 0) {
                    console.warn(result.compilation.warnings);
                }
            }

            console.log('Frontend output ready');

            runApp();
        } catch (e) {
            console.error(e);
        }
    });

    frontendBuilder.build({
        mode,
        cwd,
        watchMode: mode === 'development'
    })

    backendBuilder.build({
        mode,
        cwd,
        watchMode: mode === 'development'
    })

}