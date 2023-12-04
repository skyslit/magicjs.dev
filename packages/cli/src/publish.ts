import fs from 'fs-extra';
import path from 'path';
import tar from 'tar-fs';
import FormData from 'form-data';
import axios from 'axios';

export async function publish(featureName: string, secretKey: string) {
    const cwd = process.cwd();
    const TEMP_FOLDER = path.join(cwd, '.temp');
    const TARGET_TAR_FILE_PATH = path.join(TEMP_FOLDER, 'archive.tar.gz');

    const FEATURE_SOURCE_DIR = path.join(cwd, 'src', 'features', featureName);
    if (!fs.existsSync(FEATURE_SOURCE_DIR)) {
        throw new Error(`feature '${featureName}' does not exist`);
    }

    if (fs.existsSync(TEMP_FOLDER)) {
        fs.emptyDirSync(TEMP_FOLDER);
    } else {
        fs.mkdirSync(TEMP_FOLDER, { recursive: true });
    }

    let config: any = null;
    const CONFIG_FILE_PATH = path.join(FEATURE_SOURCE_DIR, 'config.json');
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
        throw new Error(`config does not found`);
    }

    try {
        config = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf-8'));
    } catch (e) {
        throw new Error(`config should be a valid json`);
    }

    if (!config.packageId) {
        throw new Error(`packageId is invalid or not found`);
    }

    await new Promise<void>((resolve, reject) => {
        tar.pack(FEATURE_SOURCE_DIR)
        .pipe(fs.createWriteStream(TARGET_TAR_FILE_PATH))
        .on('finish', () => {
            resolve();
        })
        .on('error', reject);
    });

    const form = new FormData();
    form.append('archive', fs.createReadStream(TARGET_TAR_FILE_PATH));
    form.append('config', JSON.stringify(config));

    const res = await axios.post(`https://app.mern.ai/___service/compass/publishTemplate?packageId=${encodeURIComponent(config.packageId)}`, form, {
        headers: {
            ...form.getHeaders(),
            'secretkey': secretKey
        }
    });

    fs.emptyDirSync(TEMP_FOLDER);
    fs.rmdirSync(TEMP_FOLDER);
    
    console.log('published');
}