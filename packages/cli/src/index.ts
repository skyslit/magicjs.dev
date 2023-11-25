#!/usr/bin/env node
import { SPABuilder, BackendBuilder } from '@skyslit/ark-devtools';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';

const cwd = process.cwd();

let appProcess: ChildProcess;

const runApp = () => {
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
};

const frontendBuilder = new SPABuilder('client', path.join(cwd, 'src/client.tsx'));
const backendBuilder = new BackendBuilder(path.join(cwd, 'src/server.tsx'));

backendBuilder.attachMonitor((err, result) => {
    try {
        if (err) throw err;

        if (result) {
            console.error(result.compilation.errors);
            console.warn(result.compilation.warnings);
        }

        runApp();
    } catch (e) {
        console.error(e);
    }
})

frontendBuilder.attachMonitor((err, result) => {
    try {
      if (err) throw err;

      if (result) {
            console.error(result.compilation.errors);
            console.warn(result.compilation.warnings);
      }

      runApp();
    } catch (e) {
        console.error(e);
    }
  });

frontendBuilder.build({
    mode: 'development',
    cwd,
    watchMode: true
})

backendBuilder.build({
    mode: 'development',
    cwd,
    watchMode: true
})

console.log('Say hello');