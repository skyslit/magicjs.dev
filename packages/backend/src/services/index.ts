const registry: any = {};

export function registerService(key: string, service: any) {
    registry[key] = service;
}

export function getService<T>(key: string): T {
    return registry[key] || null
}