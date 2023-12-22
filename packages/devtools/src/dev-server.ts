import express from 'express';
import path from 'path';
import { SPABuilder } from './frontend-builder';
import { BackendBuilder } from './backend-builder';
import devMiddleware from 'webpack-dev-middleware';
import hotMiddleware from 'webpack-hot-middleware';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import httpProxy from 'http-proxy';

type Options = {
    cwd: string
}

const proxy = httpProxy.createProxyServer();

proxy.on('error', (err, req, res: any) => {
  console.error(err);
});

export function createDevServer(opts: Options) {
    console.log('Starting dev server');

    const app = express();
    let appProcess: ChildProcess;

    let appRunning: boolean = false;
    let appRunningTimer = null;

    const runApp = () => {
        appRunning = false;
        clearTimeout(appRunningTimer);
        if (appProcess) {
            appProcess.kill('SIGKILL');
        }
        const appPath: string = path.join(opts.cwd, 'build', 'server', 'main.js');

        if (!fs.existsSync(appPath)) {
            console.log('');
            console.log('Waiting for output...');
            return false;
        }

        appProcess = spawn('node', [appPath], {
            stdio: 'inherit',
        });

        appRunningTimer = setTimeout(() => {
            appRunning = true;
        }, 3000);
    };

    const backendBuilder = new BackendBuilder(path.join(opts.cwd, 'src/server.tsx'));
    const frontendBuilder = new SPABuilder('client', path.join(opts.cwd, 'src/client.tsx'));

    backendBuilder.build({
        cwd: opts.cwd,
        mode: 'development',
        watchMode: true
    });

    frontendBuilder.build({
        cwd: opts.cwd,
        mode: 'development',
        watchMode: true
    });

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

    app.use(devMiddleware(backendBuilder.compiler, { stats: 'none', outputFileSystem: require('fs') }));
    app.use(devMiddleware(frontendBuilder.compiler, { stats: 'none', outputFileSystem: require('fs') }));

    app.use(hotMiddleware(frontendBuilder.compiler, {}));

    app.all('/*', async (req, res) => {
        try {
            while (appRunning === false) {
                await new Promise<void>((r) => setTimeout(() => r(), 300));
            }
            
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate"); // HTTP 1.1.
            res.setHeader("Pragma", "no-cache"); // HTTP 1.0.
            res.setHeader("Expires", "0"); // Proxies.
      
            proxy.web(req, res, {
              target: 'http://localhost:3000',
              ws: true,
              timeout: 30
            });
          } catch (e) {
            res.status(500).json({ message: e?.message });
          }
    })

    app.listen(3001, undefined, undefined, () => {
        console.log('Dev server listing on port 3001');
    })
}