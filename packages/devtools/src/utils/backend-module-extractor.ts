import path from 'path';
export function extractBackendModuleId(cwd: string, filePath: string) {
    return path.relative(path.join(cwd, 'src'), path.join(cwd, filePath)).replace(/\..+$/, '')
}