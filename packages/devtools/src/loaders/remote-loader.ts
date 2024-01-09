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
        import { controllerRef } from '@magicjs.dev/frontend';

        const fullPath = '/__backend/__managed/' + '${backendModuleId}';

        async function invoke (...args: any[]) {
            try {
                const res = await controllerRef.client.post(fullPath, {
                    args
                }, {
                    withCredentials: true
                });

                return res.data;
            } catch (e) {
                throw new Error((e?.response?.data?.message ? e?.response?.data?.message : e?.message) || 'Network error');
            }
            return "Calling api at ${backendModuleId}"
        }

        invoke.prototype.__fullPath = fullPath;
        invoke.prototype.__backendModuleId = '${backendModuleId}';

        export default invoke`;
    }

    return source;
}