import { Readable } from "stream";
import { IUserUploadServices } from "../IUserUploadServices";
import { MERNAI_Core } from "./core";
import axios from "axios";
import path from 'path';

export class UserUploadServices extends MERNAI_Core implements IUserUploadServices {
    saveFileToUserUploads(dir: string, name: string, file: Readable) {
        if (this.userUploadServiceEnabled === false) {
            console.warn('User upload service need non dev env id to be enabled');
        }

        this.client?.request({
            method: 'post',
            url: `/blob/api/v2/buckets/${process.env['WS_NON_DEV_ENV_ID']}?path=${path.posix.join(dir, name)}`,
            data: file,
            headers: {
                'Content-Type': 'application/octet-stream'
            }
        }).then((res) => {
            console.log('File uploaded')
        })
        .catch((err) => {
            console.error(err);
        });
    }

    async removeFileFromUserUploads(dir: string, name: string) {
        if (this.userUploadServiceEnabled === false) {
            console.warn('User upload service need non dev env id to be enabled');
        }

        await this.client?.request({
            method: 'delete',
            url: `/blob/api/v2/buckets/${process.env['WS_NON_DEV_ENV_ID']}?path=${path.posix.join(dir, name)}`,
            responseType: 'stream'
        });

        return true;
    }

    async readFileFromUserUploads(dir: string, name: string) {
        if (this.userUploadServiceEnabled === false) {
            console.warn('User upload service need non dev env id to be enabled');
        }

        const response = await this.client?.request({
            method: 'get',
            url: `/blob/api/v2/buckets/${process.env['WS_NON_DEV_ENV_ID']}?path=${path.posix.join(dir, name)}`,
            responseType: 'stream'
        });

        return { ___resMode: 'managed', reader: response?.data }
    }
}