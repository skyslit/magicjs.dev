import { extractBackendModuleId } from '../utils/backend-module-extractor';
import path from 'path';

export default function (source) {
    const isARemoteFile = String(this.resourcePath).endsWith('.server.tsx');
    if (isARemoteFile === true) {
        const backendModuleId = extractBackendModuleId(process.cwd(), path.relative(process.cwd(), this.resourcePath));
        return `
        import { controller } from '@skyslit/ark-frontend';
        export default async function (...args: any[]) {
            try {
                const res = await controller.client.post('/__backend/__managed/' + '${backendModuleId}', {
                    args
                }, {
                    withCredentials: true
                });

                return res.data;
            } catch (e) {
                throw new Error((e?.response?.data?.message ? e?.response?.data?.message : e?.message) || 'Network error');
            }
            return "Calling api at ${backendModuleId}"
        }`;
    }

    return source;
}