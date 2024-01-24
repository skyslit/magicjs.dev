import { Readable } from 'stream';

export interface IUserUploadServices {
    saveFileToUserUploads: (dir: string, name: string, file: Readable) => void;
    removeFileFromUserUploads: (dir: string, name: string) => Promise<boolean>;
    readFileFromUserUploads: (dir: string, name: string) => Promise<{
        ___resMode: string;
        reader: Readable;
    }>;
}