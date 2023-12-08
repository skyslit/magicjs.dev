import path from 'path';
export function extractBackendModuleId(cwd: string, filePath: string) {
    return path.posix.relative(path.posix.join(cwd, 'src'), path.posix.join(cwd, filePath)).replace(/\..+$/, '')
}