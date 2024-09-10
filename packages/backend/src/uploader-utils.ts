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
        const bb = busboy({ ...config || {}, headers: req.headers, defParamCharset: 'utf8' });
        const handlers: any = {
            '_read': () => {
                if (hasInitialised === true) {
                    return;
                }

                hasInitialised = true;

                const completeRequest = () => {
                    if (progress.every(Boolean) === false || streamClosed === false) {
                        return;
                    }

                    // @ts-ignore
                    const buckets: any = req?._resBucket || {};
                    let bucketResponses = Object.keys(buckets).reduce((acc, key) => {
                        return { ...acc, ...buckets[key] };
                    }, {});

                    res.json({ ...bucketResponses, ack: true });
                }

                let progress: Array<boolean> = [];
                let progressIndex: number = -1;
                let streamClosed = false;
                bb.on('file', async (name, file, info) => {
                    const index = ++progressIndex;
                    progress[index] = false;
                    try {
                        if (handlers['onfile']) {
                            await Promise.resolve(handlers['onfile'](name, file, info));
                        }
                    } catch (e) {
                        console.error(e);
                    }
                    progress[index] = true;
                    completeRequest();
                });

                bb.on('field', (name, val, info) => {
                    console.log(`Field [${name}]: value: %j`, val);
                });

                bb.on('close', () => {
                    streamClosed = true;
                    completeRequest();
                });

                req.pipe(bb);
            }
        }

        const handler = new UploadHandler(handlers);
        return handler
    }
}