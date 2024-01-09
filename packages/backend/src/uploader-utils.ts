import { Request, Response } from "express"
import busboy from 'busboy';
import { Readable } from 'stream';

class UploadHandler {
    private _handlers: any;

    constructor (_handlers: any) {
        this._handlers = _handlers;
    }

    onFile(h: (info: busboy.FileInfo, file: Readable, name: string) => void) {
        this._handlers['_read']();
        this._handlers['onfile'] = (name: string, file: Readable, info: busboy.FileInfo) => h(info, file, name);
    }
}

export type UploaderUtils = () => UploadHandler;

export function createUploaderUtils(req: Request, res: Response): UploaderUtils {
    return (config?: busboy.BusboyConfig) => {
        let hasInitialised: boolean = false;
        const bb = busboy({ ...config || {}, headers: req.headers });
        const handlers: any = {
            '_read': () => {
                if (hasInitialised === true) {
                    return;
                }

                hasInitialised = true;

                bb.on('file', (name, file, info) => {
                    if (handlers['onfile']) {
                        handlers['onfile'](name, file, info)
                    }
                });

                bb.on('field', (name, val, info) => {
                    console.log(`Field [${name}]: value: %j`, val);
                });

                bb.on('close', () => {
                    res.json({ ack: true });
                });
                
                req.pipe(bb);
            }
        }

        const handler = new UploadHandler(handlers);
        return handler
    }
}