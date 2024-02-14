import fs from 'fs-extra';
import path from 'path';
import { https } from 'follow-redirects';
import tar from 'tar-fs';
import gunzip from 'gunzip-maybe';
import { spawn } from 'child_process';
import os from 'os';
import gitP from 'simple-git';

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

const normalizeOptions = (input: any) => {
    let result = {
      disableAutoReturn: false,
      disableAutoReplace: false,
    };
  
    result = Object.assign(result, input);
  
    return result;
  };
  
export const createCommand = (
    cmd: string,
    cmdBash?: string,
    opts?: any
  ) => {
    opts = normalizeOptions(opts);
    const hasBashSpecificCommand = cmdBash !== undefined || cmdBash !== null;
  
    if (hasBashSpecificCommand === true) {
      const shellName = shell;
      if (shellName === 'bash') {
        // @ts-ignore
        cmd = cmdBash;
      }
    } else {
      if (opts.disableAutoReplace === false) {
        // @ts-ignore
        cmd = cmdBash?.replace(';', ' && ');
      }
    }
  
    if (opts.disableAutoReturn === false) {
      if (cmd.endsWith('\n') === false) {
        cmd = cmd + '\n';
      }
    }
  
    return cmd;
  };
  
export default function runCommand(
    commandStr: string,
    opts?: any
  ) {
    return new Promise((resolve, reject) => {
      const bash = spawn(shell, {
        cwd: opts.cwd,
      });
  
      bash.stdout.on('data', function (data) {
        console.log(String(data));
      });
  
      bash.stderr.on('data', function (data) {
        console.log(String(data));
      });
  
      bash.on('exit', function (code) {
        resolve(true);
      });
  
      bash.stdin.write(createCommand(commandStr, commandStr));
    });
  }

  
export async function init(cwd?: string) {
    if (!cwd) {
      cwd = process.cwd();
    }
    const tarFilePath = path.join(cwd, 'archive.tar.gz')

    console.log('Cloning files...');
    await new Promise<void>((resolve, reject) =>{
        const file = fs.createWriteStream(tarFilePath);

        const request = https.get({
            hostname: 'api.github.com',
            path: '/repos/skyslit/magicjs.dev-base/tarball',
            headers: {
                'user-agent': 'Mozilla/5.0'
            }
        }, function (response) {
            response.pipe(file);

            // after download completed close filestream
            file.on("finish", () => {
                file.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });

                console.log("Download Completed");
            });
        }).on('error', function(err) { 
            console.error(err);
            // Handle errors
            fs.unlink(tarFilePath); // Delete the file async. (But we don't check the result)
            reject(err);
          });
    });

    console.log('Extracting files...');
    await new Promise<void>((resolve, reject) => {
        fs.createReadStream(tarFilePath)
          .pipe(gunzip())
          .pipe(tar.extract(path.dirname(tarFilePath), {}))
          .on('error', reject)
          .on('finish', () => {
            resolve();
          });
      });

    console.log('Installing files...');
    let extractPath = fs
        .readdirSync(cwd)
        .find((d) => d.indexOf('magicjs.dev-base') > -1);
    if (extractPath) {
        extractPath = path.join(cwd, extractPath);

        fs.copySync(extractPath, cwd);
        fs.emptyDirSync(extractPath);
        fs.rmdirSync(extractPath);
        fs.rmSync(tarFilePath);

        console.log('Installing dependencies...');
        await runCommand('npm install; exit', {
            cwd
        });
    }

    console.log('Setting up git...');
    const git = gitP(cwd);
    await git.init()
    .then(() => git.addConfig('user.email', 'bot@skyslit.dev', false, 'local'))
    .then(() => git.addConfig('user.name', 'developer', false, 'local'))
    .then(() => git.add('./*'))
    .then(() => git.commit('chore: initial commit'));
    console.log('Done ✅');
}