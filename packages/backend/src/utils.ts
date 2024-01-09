import bcrypt from 'bcryptjs';
import fs from 'fs-extra';
import path from 'path';
import { Readable } from 'stream';

/* -------------------------------------------------------------------------- */
/*                                  Security                                  */
/* -------------------------------------------------------------------------- */

function hash(payload: string, salt: number = 10) {
    const s = bcrypt.genSaltSync();
    return bcrypt.hashSync(payload, s);
}

function verifyHash(payload: string, hash: string): boolean {
    return bcrypt.compareSync(payload, hash);
}

function getUserUploadPath(dir: string) {
    return path.join(__dirname, '../../user-uploads', dir);
}

function saveFileToUserUploads(dir: string, name: string, file: Readable) {
    const uploadPath = getUserUploadPath(dir);
    fs.mkdirSync(uploadPath, { recursive: true });
    const writer = fs.createWriteStream(path.join(uploadPath, name), { autoClose: true });
    file.pipe(writer);
}

function readFileFromUserUploads(dir: string, name: string) {
    let filePath = getUserUploadPath(dir);
    filePath = path.join(filePath, name || '');
    if (fs.existsSync(filePath)) {
        const reader = fs.createReadStream(filePath, { autoClose: true });
        return {
            ___resMode: 'managed',
            reader
        }
    } else {
        throw new Error(`Request resource not found in the server`);
    }
}

function removeFileFromUserUploads(dir: string, name: string) {
    let filePath = getUserUploadPath(dir);
    filePath = path.join(filePath, name || '');
    if (fs.existsSync(filePath)) {
        fs.rmSync(filePath);
    }

    return true;
}

export default {
    hash,
    verifyHash,
    saveFileToUserUploads,
    readFileFromUserUploads,
    removeFileFromUserUploads
}