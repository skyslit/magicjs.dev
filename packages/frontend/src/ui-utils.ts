import path from 'path-browserify';

function* infinite() {
    let index = 0;
    let timestamp = (new Date()).valueOf();

    const g = () => `${timestamp}_${index}`;

    while (true) {
        index++;

        yield g();
    }

    return g();
}

export const generator = infinite();

function generateUniqueId(): string {
    return generator.next().value;
}

function generateUniqueFilename(fileName: string) {
    const p = path.parse(fileName);
    return `${generateUniqueId()}${p.ext}`;
}

export const uiUtils = {
    generateUniqueId,
    generateUniqueFilename
}
