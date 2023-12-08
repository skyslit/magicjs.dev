import { extractBackendModuleId } from '../utils/backend-module-extractor';
import path from 'path';

export default function (source) {
    let rPath = this.resourcePath;
    let cwd = process.cwd();

    rPath = rPath.split(path.sep).join(path.posix.sep);
    cwd = cwd.split(path.sep).join(path.posix.sep);

    const isARemoteFile = String(rPath).endsWith('.server.tsx');
    if (isARemoteFile === true) {
        const backendModuleId = extractBackendModuleId(cwd, path.posix.relative(cwd, rPath));
        return `
        import { controllerRef } from '@skyslit/ark-frontend';
        export default async function (...args: any[]) {
            try {
                const res = await controllerRef.client.post('/__backend/__managed/' + '${backendModuleId}', {
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