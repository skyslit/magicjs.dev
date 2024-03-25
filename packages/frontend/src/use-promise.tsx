import React from 'react';

export function usePromise(p: (...args: any[]) => Promise<any>) {
    const [result, setResult] = React.useState(null);
    const [error, setErr] = React.useState(null);
    const [loading, setLoading] = React.useState(false);

    const refresh = React.useCallback(async (...args: any[]) => {
        setLoading(true);

        try {
            const res = await Promise.resolve(p(...args));
            setResult(res);
        } catch (e) {
            console.error(e);
            setErr(e);
        }

        setLoading(false);
    }, [p]);

    return {
        result,
        error,
        refresh,
        loading
    }
}