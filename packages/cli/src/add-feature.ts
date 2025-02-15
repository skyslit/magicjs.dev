import fs from 'fs-extra';
import path from 'path';
import { https, http } from 'follow-redirects';
import gunzip from 'gunzip-maybe';
import tar from 'tar-fs';

export async function addFeature(featureName: string, packageId: string, _cwd?: string) {
    const cwd = _cwd || process.cwd();
    const TEMP_FOLDER = path.join(cwd, '.temp');
    const TARGET_TAR_FILE_PATH = path.join(TEMP_FOLDER, 'archive.tar.gz');

    const FEATURE_SOURCE_DIR = path.join(cwd, 'src', 'features', featureName);
    if (fs.existsSync(FEATURE_SOURCE_DIR)) {
        throw new Error(`feature '${featureName}' already exist, choose new name`);
    }

    if (fs.existsSync(TEMP_FOLDER)) {
        fs.emptyDirSync(TEMP_FOLDER);
    } else {
        fs.mkdirSync(TEMP_FOLDER, { recursive: true });
    }

    await new Promise<void>((resolve, reject) =>{
        const file = fs.createWriteStream(TARGET_TAR_FILE_PATH);

        const MERN_AI_HOSTNAME = process.env.MERN_AI_HOSTNAME;
        const hasMernAIHostname = Boolean(MERN_AI_HOSTNAME);

        console.log('hasMernAIHostname', hasMernAIHostname);

        const request = (hasMernAIHostname === true ? https : http).get({
            hostname: hasMernAIHostname === true ? MERN_AI_HOSTNAME : 'mern-app-svc.prod',
            path: `/___service/compass/downloadTemplate?packageId=${encodeURIComponent(packageId)}`,
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
            fs.unlink(TARGET_TAR_FILE_PATH); // Delete the file async. (But we don't check the result)
            reject(err);
          });
    });

    fs.mkdirSync(FEATURE_SOURCE_DIR, { recursive: true });

    console.log('Extracting files...');
    await new Promise<void>((resolve, reject) => {
        fs.createReadStream(TARGET_TAR_FILE_PATH)
          .pipe(gunzip())
          .pipe(tar.extract(FEATURE_SOURCE_DIR, {}))
          .on('error', reject)
          .on('finish', () => {
            resolve();
          });
      });

    fs.emptyDirSync(TEMP_FOLDER);
    fs.rmdirSync(TEMP_FOLDER);

    console.log('Package added');
}