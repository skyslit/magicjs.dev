import { Readable } from "stream";
import { IUserUploadServices } from "../IUserUploadServices";
import fs from 'fs-extra';
import path from 'path';

function getUserUploadPath(dir: string) {
    return path.join(process.cwd(), 'user-uploads', dir);
}

export class LocalUserUploadServices implements IUserUploadServices {
    saveFileToUserUploads(dir: string, name: string, file: Readable) {
        const uploadPath = getUserUploadPath(dir);
        fs.mkdirSync(uploadPath, { recursive: true });
        const writer = fs.createWriteStream(path.join(uploadPath, name), { autoClose: true });
        file.pipe(writer);
    }

    async removeFileFromUserUploads(dir: string, name: string) {
        let filePath = getUserUploadPath(dir);
        filePath = path.join(filePath, name || '');
        if (fs.existsSync(filePath)) {
            fs.rmSync(filePath);
        }

        return true;
    }

    async readFileFromUserUploads(dir: string, name: string) {
        let filePath = getUserUploadPath(dir);
        filePath = path.join(filePath, name || '');
        if (fs.existsSync(filePath)) {
            const reader = fs.createReadStream(filePath, { autoClose: true });
            return {
                ___resMode: 'managed',
                reader: reader
            }
        } else {
            throw new Error(`Request resource not found in the server`);
        }
    }
}