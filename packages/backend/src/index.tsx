import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import * as React from 'react';
import ReactDOMServer from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import HTMLParser from 'node-html-parser';
import { App } from '@skyslit/ark-frontend';

export class ServerInstance {
    static instance: ServerInstance;
    static getInstance() {
        if (!ServerInstance.instance) {
            ServerInstance.instance = new ServerInstance();
        }

        return ServerInstance.instance;
    }

    httpServer: http.Server;
    app: express.Express;
    port: number = 8081;

    setPort(p: number) {
        this.port = p;
    }

    constructor () {
        this.app = express();
        this.httpServer = http.createServer(this.app);
        
        this.app.use(morgan('dev'));
        this.app.use(cookieParser());
        
        this.app.use(express.json());
        this.app.use(express.urlencoded());
        this.app.use(express.text());
        this.app.use(express.raw());
        this.app.use(
            '/_browser',
            express.static(path.join(__dirname, '../_browser'))
        );
        this.app.use(
            '/assets',
            express.static(path.join(__dirname, '../assets'))
        );
    }
}

export async function createServer(handler: (instance: ServerInstance) => void | Promise<void>, instance?: ServerInstance): Promise<ServerInstance> {
    if (!instance) {
        instance = ServerInstance.getInstance();
    }

    await Promise.resolve(handler(instance));

    instance.app.get('/*', (req, res, next) => {
        let helmetContext: any = {};
        const htmlFilePath = path.join(__dirname, '../client.html');
        const htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
        const htmlContentNode = HTMLParser.parse(htmlContent);
        const appStr = ReactDOMServer.renderToString(<App helmetContext={helmetContext} initialPath={req.path} />);
        let headContent: string[] = [];

        try {
            headContent = Object.keys(helmetContext?.helmet || {}).reduce(
                (acc: any[], item) => {
                    let c: string;
                    try {
                        c = helmetContext.helmet[item].toString();
                    } catch (e) {
                        console.error(e);
                    }

                    // @ts-ignore
                    if (c) {
                        acc.push(c);
                    }

                    return acc;
                },
                []
            );

            let i = 0;
            for (i = 0; i < headContent.length; i++) {
                const headNode = htmlContentNode
                    .querySelector('head');

                if (headNode) {
                    headNode.appendChild(HTMLParser.parse(headContent[i]));
                }
            }
        } catch (e) {
            console.error(e);
        }
        const rootDiv = htmlContentNode.querySelector('#root');
        if (rootDiv) {
            rootDiv.set_content(appStr);
        }

        res.send(htmlContentNode.toString());
    })

    instance.app.listen(instance.port, undefined as any, undefined as any, () => {
        console.log(`Listing to ${instance?.port}`)
    });

    return instance;
}


