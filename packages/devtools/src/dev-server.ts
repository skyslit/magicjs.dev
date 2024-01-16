import express from 'express';
import path from 'path';
import { SPABuilder } from './frontend-builder';
import { BackendBuilder } from './backend-builder';
import devMiddleware from 'webpack-dev-middleware';
import hotMiddleware from 'webpack-hot-middleware';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs-extra';
import httpProxy from 'http-proxy';
import chalk from 'chalk';
import getPort from 'get-port';
import open from 'open';
import axios from 'axios';
import safeJson from 'json-stringify-safe';

type Options = {
    env?: 'development' | 'production',
    cwd: string,
    runtimeUrl?: string
}

const proxy = httpProxy.createProxyServer();

proxy.on('error', (err, req, res: any) => {
    console.log('Could not connect to server process');
});

export async function runBuild(opts: Options) {
    let { runtimeUrl, env } = opts;

    if (env === undefined) {
        env = 'development';
    }

    // Clean up build folder
    fs.emptyDirSync(path.join(opts.cwd, 'build'));

    const HasRuntimeAgent = Boolean(runtimeUrl);

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
        hasErrors: false,
        __frontendStatusInStr: '',
        __backendStatusInStr: '',
    }

    let appProcess: ChildProcess;
    let appRunningTimer = null;
    const runApp = () => {
        if (env !== 'development') {
            return;
        }

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

    const printLog = () => {
        if (env !== 'development') {
            return;
        }
        
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
            if (status.devServerActive === false && env === 'development') {
                console.log('');
                console.log(chalk.yellow(`Starting development server...`));
            }
        }
    }

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

    backendBuilder.attachMonitor((err, result) => {
        try {
            if (err) throw err;

            if (env === 'production') {
                status.__backendStatusInStr = result.toString();
            }

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

            if (env === 'production') {
                status.__frontendStatusInStr = result.toString();
            }

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

    backendBuilder.build({
        cwd: opts.cwd,
        mode: env,
        watchMode: env === 'development'
    });

    frontendBuilder.build({
        cwd: opts.cwd,
        mode: env,
        watchMode: env === 'development'
    });

    if (env === 'development') {
        const app = express();

        printLog();

        const backendMiddleware = devMiddleware(backendBuilder.compiler, { stats: 'none', outputFileSystem: require('fs') });
        const frontendMiddleware = devMiddleware(frontendBuilder.compiler, { stats: 'none', outputFileSystem: require('fs') });

        app.use(backendMiddleware);
        app.use(frontendMiddleware);

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
                while (status.appServerLive === false && status.hasErrors === false) {
                    await new Promise<void>((r) => setTimeout(() => r(), 300));
                }

                if (status.hasErrors === true) {
                    let backendOutput = null;
                    let frontendOutput = null;

                    backendOutput = [
                        ...backendMiddleware.context.stats.toJson().errors,
                        ...backendMiddleware.context.stats.toJson().warnings
                    ];

                    frontendOutput = [
                        ...frontendMiddleware.context.stats.toJson().errors,
                        ...frontendMiddleware.context.stats.toJson().warnings
                    ];

                    res.send(`
                    <html>
                    <head>
                    </head>
                    <body style="padding: 24px; background-color: white;">
                        <div style="background-color: white;">
                        <h1 style="margin: 0px; font-family: sans-serif; font-weight: normal;">There's some <span style="background-color: red; color: white; padding: 0 12px;">error</span> in the code</h1>
                        <h2 style="margin-top: 8px; font-family: sans-serif; font-weight: normal;">Please use the terminal or below output to further troubleshoot it</h2>

                        <button style="margin-top: 12px" onclick="reload()">Refresh</button>
                        <code style="margin-top: 12px">
                        ${safeJson(backendOutput)}
                        </code>
                        <code style="margin-top: 12px">
                        ${safeJson(frontendOutput)}
                        </code>
                        </div>
                        <script>
                            function reload() {
                                window.location.reload();
                            }
                        </script>
                    </body>
                    </html>
                `)
                    return;
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
    } else {
        let timer = setInterval(() => {
            if (status.frontendCompiled === true && status.backendCompiled === true) {
                if (status.hasErrors === true) {
                    console.log(status.backendErrors);
                    console.log(status.frontendErrors);
                    
                    console.error(chalk.red('Compiled with error'));
                    process.exit(1);
                } else {
                    console.log(status.__backendStatusInStr);
                    console.log(status.__frontendStatusInStr);

                    console.error(chalk.green('Built successfully'));
                }
                clearInterval(timer);
            }
        }, 1000);
    }
}