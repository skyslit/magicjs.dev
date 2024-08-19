export class StaticStore {
    static registry: any = {};
}

export function registerService(key: string, service: any) {
    StaticStore.registry[key] = service;
}

export function getService<T>(key: string): T {
    return StaticStore.registry[key] || null
}