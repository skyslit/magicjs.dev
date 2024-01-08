import express from 'express';
import path from 'path';
import { SPABuilder } from './frontend-builder';
import { BackendBuilder } from './backend-builder';
import devMiddleware from 'webpack-dev-middleware';
import hotMiddleware from 'webpack-hot-middleware';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import httpProxy from 'http-proxy';
import chalk from 'chalk';
import getPort from 'get-port';
import open from 'open';
import axios from 'axios';
import safeJson from 'json-stringify-safe';

type Options = {
    cwd: string,
    runtimeUrl?: string
}

const proxy = httpProxy.createProxyServer();

proxy.on('error', (err, req, res: any) => {
    console.log('Could not connect to server process');
});

export async function createDevServer(opts: Options) {
    const { runtimeUrl } = opts;

    const HasRuntimeAgent = Boolean(runtimeUrl);
    const app = express();
    let appProcess: ChildProcess;

    let appRunningTimer = null;

    let status = {
        appServerPort: await getPort(),
        appServerLive: false,
        devServerPort: 3000,
        devServerActive: false,
        frontendCompiled: false,
        backendCompiled: false,
        compilationStatus: 'building',
        frontendWarnings: [],
        backendWarnings: [],
        frontendErrors: [],
        backendErrors: [],
        hasWarnings: false,
        hasErrors: false
    }

    const reportToRuntime = (payload: any) => {
        if (HasRuntimeAgent === true) {
            axios({
                method: 'post',
                baseURL: runtimeUrl,
                url: '/__ark__agent_c/report_from_compiler',
                data: safeJson(payload),
                headers: {
                    'Content-Type': 'application/json',
                }
            })
            .catch((e) => {
                console.log(chalk.red(`Could not communicate with agent ${runtimeUrl}`));
            })
        }
    }

    const refreshCompilationStatus = () => {
        status.hasErrors = status.backendErrors.length > 0 || status.frontendErrors.length > 0;
        status.hasWarnings = status.backendWarnings.length > 0 || status.frontendWarnings.length > 0;

        if (status.backendCompiled === true && status.frontendCompiled === true) {
            if (status.hasErrors === true) {
                status.compilationStatus = 'error';
            } else if (status.hasWarnings === true) {
                status.compilationStatus = 'compiled-with-warnings';
            } else {
                status.compilationStatus = 'ready';
            }
        } else {
            status.compilationStatus = 'building';
        }

        printLog();
        reportToRuntime(status);
    }

    const printLog = () => {
        console.clear();

        // Show compilation status
        switch (status.compilationStatus) {
            case 'ready': {
                console.log(chalk.green('Compiled successfully!'));
                break;
            }
            case 'error': {
                console.log(chalk.red('Compilation failed'));
                break;
            }
            case 'compiled-with-warnings': {
                console.log(chalk.yellow('Compiled with warnings'));
                console.log(status.backendWarnings);
                console.log(status.frontendWarnings);
                break;
            }
            default: {
                console.log(chalk.blue('Building changes...'));
                break;
            }
        }

        if (status.compilationStatus === 'ready' || status.compilationStatus === 'compiled-with-warnings') {
            console.log('');
            if (status.devServerActive === true) {
                console.log('You can now view project in the browser');
                console.log('');
                console.log(`    Local:       http://localhost:${status.devServerPort}`);
                console.log('');
            }
        } else {
            if (status.devServerActive === false) {
                console.log('');
                console.log(chalk.yellow(`Starting development server...`));
            }
        }
    }

    printLog();

    const runApp = () => {
        status.appServerLive = false;
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
            // stdio: 'inherit',
            env: {
                ...process.env,
                DEV_PORT: String(status.appServerPort)
            }
        });

        const processLog = (msg: string) => {
            if (status.appServerLive === false) {
                status.appServerLive = msg.startsWith('Listening on port');
            }

            console.log(msg);
        }

        appProcess.stdout.on('data', (data) => {
            let d = String(data);
            processLog(d.substring(0, d.length - 1));
        });

        appProcess.stderr.on('data', (data) => {
            let d = String(data);
            processLog(d.substring(0, d.length - 1));
        });

        appRunningTimer = setTimeout(() => {
            status.appServerLive = true;
        }, 3000);
    };

    const backendBuilder = new BackendBuilder(path.join(opts.cwd, 'src/server.tsx'));
    const frontendBuilder = new SPABuilder('client', path.join(opts.cwd, 'src/client.tsx'));

    backendBuilder.on('compiling', () => {
        status.backendCompiled = false;
        refreshCompilationStatus();
    });

    frontendBuilder.on('compiling', () => {
        status.frontendCompiled = false;
        refreshCompilationStatus();
    });

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
                status.backendErrors = result.compilation.errors;
                status.backendWarnings = result.compilation.warnings;
            }

            status.backendCompiled = true;
            refreshCompilationStatus();

            runApp();
        } catch (e) {
            console.error(e);
        }
    })

    frontendBuilder.attachMonitor((err, result) => {
        try {
            if (err) throw err;

            if (result) {
                status.frontendErrors = result.compilation.errors;
                status.frontendWarnings = result.compilation.warnings;
            }

            status.frontendCompiled = true;
            refreshCompilationStatus();

            runApp();
        } catch (e) {
            console.error(e);
        }
    });

    app.use(devMiddleware(backendBuilder.compiler, { stats: 'none', outputFileSystem: require('fs') }));
    app.use(devMiddleware(frontendBuilder.compiler, { stats: 'none', outputFileSystem: require('fs') }));

    app.use(hotMiddleware(frontendBuilder.compiler, { log: false }));

    app.get('/____compiler__status', (req, res) => {
        res.json(
            JSON.parse(
                safeJson(status)
            )
        );
    })

    app.all('/*', async (req, res) => {
        try {
            while (status.appServerLive === false) {
                await new Promise<void>((r) => setTimeout(() => r(), 300));
            }
            
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate"); // HTTP 1.1.
            res.setHeader("Pragma", "no-cache"); // HTTP 1.0.
            res.setHeader("Expires", "0"); // Proxies.
      
            proxy.web(req, res, {
              target: `http://localhost:${status.appServerPort}`,
              ws: true
            });
          } catch (e) {
            res.status(500).json({ message: e?.message });
          }
    })

    const server = app.listen(status.devServerPort, undefined, undefined, () => {
        status.devServerActive = true;
        printLog();

        if (HasRuntimeAgent === false) {
            open(`http://localhost:${status.devServerPort}`);
        }
    })

    server.on('upgrade', (req, socket, head) => {
        proxy.ws(req, socket, head, {
            target: `http://localhost:${status.appServerPort}`
        });
    })
}