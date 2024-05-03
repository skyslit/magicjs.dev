type ExecuteWithTokenArgs = {
    attempt: number,
    token: any
}

export type TokenProviderOptions = {
    maxRetryAttempt: number
    defaultToken: any
    tokenResolver: (api: ExecuteWithTokenArgs) => Promise<any> | any
};

export type TokenProvider = {
    executeWithToken: (fn: (api: ExecuteWithTokenArgs) => Promise<any> | any) => Promise<any>
    attachTokenResolver: (fn: (api: ExecuteWithTokenArgs) => Promise<any> | any) => void
}

export function createTokenProvider(opts?: Partial<TokenProviderOptions>): TokenProvider {
    if (!opts) {
        opts = {};
    }

    if (isNaN(opts.maxRetryAttempt)) {
        opts.maxRetryAttempt = 2;
    }

    const attachTokenResolver = async (fn: (api: ExecuteWithTokenArgs) => Promise<any> | any) => {
        opts.tokenResolver = fn;
    }

    const executeWithToken = async (fn: (api: ExecuteWithTokenArgs) => Promise<any> | any) => {
        let result: any = undefined;
        let attempt: number = 1;
        let shouldRefreshToken: boolean = Boolean(opts.defaultToken) === false;

        while (true) {
            if (shouldRefreshToken === true && typeof opts?.tokenResolver === 'function') {
                try {
                    opts.defaultToken = await Promise.resolve(opts?.tokenResolver({
                        attempt,
                        token: opts?.defaultToken
                    }));
                } catch (e) {
                    console.error(e);
                    throw new Error(`Error while resolving token`);
                }
            }

            try {
                result = await Promise.resolve(fn({
                    attempt,
                    token: opts?.defaultToken
                }));
                break;
            } catch (e) {
                if (e?.shouldRefreshToken === true) {
                    if (attempt >= opts.maxRetryAttempt) {
                        throw e;
                    } else {
                        await new Promise<void>((r) => setTimeout(() => r(), 200));
                    }
                } else {
                    throw e;
                }
            }

            attempt++;
        }

        return result;
    }

    return {
        executeWithToken,
        attachTokenResolver
    }
}

export class TokenExpiredError extends Error {
    shouldRefreshToken: boolean = true;
    
    constructor(message?: string) {
        super(message);
    }
}