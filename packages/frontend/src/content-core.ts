import traverse from 'traverse';

const idResolutionExpressions = {
    default: () => /^\[.*\]/gm,
};

export type CMSLog = {
    key: string;
    val: any;
    version?: number;
    id?: number;
    clientId?: string;
    timestamp?: string;
    // Only if required
    prevValueType?: string;
    previousValue?: string;
};

/**
 * Resolves a complete object address to the current index
 * @param {traverse.Traverse<any>} traverseResult
 * @param {string} inputAddress
 * @return {string}
 */
export function resolveAddressForTraversal(
    traverseResult: traverse.Traverse<any>,
    inputAddress: string
): string {
    const pathParts = inputAddress.split('.');

    let i = 0;
    for (i; i < pathParts.length; i++) {
        const currentPath = pathParts[i];
        if (idResolutionExpressions.default().test(currentPath) === true) {
            const parentAddress = pathParts.slice(0, i);
            const resolvedId = resolveIndexFromTraversalResult(
                traverseResult,
                resolveTraversalAddressFromPath(parentAddress),
                currentPath
            );
            pathParts[i] = String(resolvedId);
        }
    }

    return resolveTraversalAddressFromPath(pathParts);
}

/**
 * Resolves traversal paths to address
 * @param {string[]} paths
 * @return {string}
 */
export function resolveTraversalAddressFromPath(paths: string[]): string {
    return paths.join('.');
}

/**
 * Resolves index of array item from the ID template
 * @param {traverse.Traverse<any>} traverseResult
 * @param {string} path
 * @param {string} query
 * @return {number}
 */
export function resolveIndexFromTraversalResult(
    traverseResult: traverse.Traverse<any>,
    path: string,
    query: string
): number {
    let id: string = null;

    if (idResolutionExpressions.default().test(query) === false) {
        return Number(query);
    }

    try {
        const results = idResolutionExpressions.default().exec(query);
        if (results && results.length > 0) {
            id = results[0].replace('[', '').replace(']', '');
        }
    } catch (e) {
        console.error(e);
    }

    const target = traverseResult.get(path.split('.').filter(Boolean));

    if (Array.isArray(target) && target.length > 0) {
        const index = target.findIndex((t) => {
            try {
                if (t.id) {
                    if (String(t.id) === String(id)) {
                        return true;
                    }
                }
            } catch (e) {
                console.error(e);
            }
            return false;
        });

        return index;
    }

    return -1;
}

export type CMSApplyMode = 'sync' | 'edit';

export function applyLog(
    content: any,
    key: string,
    val: any,
    mode: CMSApplyMode,
    track: (prevVal: any, prevValType: any) => void
) {
    const traverseResult = traverse(content);
    const resolvedKey = resolveAddressForTraversal(traverseResult, key);
    const paths = traverseResult.paths().filter((p) => p.length > 0);
    let i = 0;
    let hasValueSet: boolean = false;
    for (i = 0; i < paths.length; i++) {
        const address = resolveTraversalAddressFromPath(paths[i]);
        if (address === resolvedKey) {
            if (track) {
                const currentVal = traverseResult.get(paths[i]);
                track(currentVal, typeof currentVal);
            }
            traverseResult.set(paths[i], val);
            hasValueSet = true;
            break;
        }
    }

    if (hasValueSet === false) {
        if (Boolean(resolvedKey)) {
            /** Creating a new key */
            traverseResult.set(String(resolvedKey).split('.'), val);
        }
    }

    return content;
}

function* infinite() {
    let index = 0;

    while (true) {
        yield index++;
    }

    return index;
}

const generator = infinite();

export function sortLogs(actions: Array<CMSLog>) {
    actions = actions.sort((a, b) => {
        if (!isNaN(a.id) && !isNaN(b.id)) {
            if (a.id > b.id) {
                return 1;
            }

            return -1;
        }

        return undefined;
    });

    return actions;
}

export function updateContent(
    content: any,
    actions: Array<CMSLog>,
    mode: CMSApplyMode
) {
    actions = sortLogs(actions);

    let i = 0;
    for (i = 0; i < actions.length; i++) {
        actions[i].id = generator.next().value;
        content = applyLog(
            content,
            actions[i].key,
            actions[i].val,
            mode,
            (prevVal: any, prevValType: any) => {
                actions[i].prevValueType = prevValType;
                if (actions[i].prevValueType === 'string') {
                    // Prev value enabled only for string now
                    actions[i].previousValue = prevVal;
                }
            }
        );
    }

    return {
        appliedActions: actions,
        content,
    };
}

export const CMS = {
    applyLog,
    updateContent,
}