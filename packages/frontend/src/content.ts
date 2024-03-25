import React, { useState } from "react";
import { CMSLog, resolveAddressForTraversal, resolveIndexFromTraversalResult, CMS } from './content-core';
import isEqual from 'lodash/isEqual';
import cloneDeep from 'lodash/cloneDeep'
import traverse from 'traverse';

type ContentHookOptions<T> = {
    serviceId: string;
    defaultContent: T;
    useReduxStore: boolean;
    enableLocalStorage?: boolean;
};

export function useContent<T>(opts_?: string | Partial<ContentHookOptions<T>>) {
    const opts: ContentHookOptions<any> = React.useMemo(() => {
        return Object.assign<
            ContentHookOptions<any>,
            Partial<ContentHookOptions<any>>
        >(
            {
                serviceId: typeof opts_ === 'string' ? opts_ : undefined,
                defaultContent: {},
                useReduxStore: false,
                enableLocalStorage: false,
            },
            typeof opts_ === 'object' ? opts_ : undefined
        )
    }, [opts_]);

    const localStorageKey: string = React.useMemo(() => {
        return `_cmsHook/_ls/${opts.serviceId}`;
    }, [opts.serviceId]);

    if (opts.enableLocalStorage === true) {
        try {
            opts.defaultContent = JSON.parse(
                localStorage.getItem(localStorageKey)
            );
        } catch (e) {
            console.warn(
                `Failed to load content from local storage for '${opts.serviceId};`
            );
            console.warn(e);
        }
    }

    const [baseContent, setBaseContent] = useState<any>(opts.defaultContent);
    const [content, setContentToState] = useState<any>(opts.defaultContent);
    const [hasChanged, setHasChanged] = useState<boolean>(false);

    React.useEffect(() => {
        setHasChanged(isEqual(baseContent, content) === false);
    }, [baseContent, content]);

    let isBatchModeEnabled: boolean = false;
    let batchContent: any = null;

    const getCurrentValByKey = (
        key: string,
        ejectTraverseResult: boolean = false
    ) => {
        const traverseResult = traverse(
            isBatchModeEnabled === true ? batchContent : content
        );
        const resolvedKey = resolveAddressForTraversal(traverseResult, key);

        if (ejectTraverseResult === true) {
            return {
                val: traverseResult.get(resolvedKey.split('.')),
                traverseResult,
                resolvedKey,
            };
        }

        return traverseResult.get(resolvedKey.split('.'));
    };

    const actionLogs = React.useRef<Array<CMSLog>>([]);
    const updateKey = (key: string, val: any) => {
        let input: any = null;

        if (isBatchModeEnabled === true) {
            input = batchContent;
        } else {
            input = cloneDeep(content);
        }

        const result = CMS.updateContent(
            input,
            [
                {
                    key,
                    val,
                },
            ],
            'edit'
        );

        const output = result.content;
        actionLogs.current.push(...result.appliedActions);

        if (isBatchModeEnabled === true) {
            batchContent = output;
        } else {
            setContentToState(output);
        }
    };

    return {
        isAvailable: content !== null && content !== undefined,
        hasChanged,
        content,
        actionLogs,
        runBatch: (fn: (content: any) => void) => {
            isBatchModeEnabled = true;
            batchContent = cloneDeep(content);
            fn && fn(batchContent);
            isBatchModeEnabled = false;
            setContentToState(batchContent);
            batchContent = null;
        },
        reset: () => {
            setContentToState(baseContent);
            setHasChanged(false);
            actionLogs.current = [];
        },
        setContent: (val) => {
            setContentToState(val);
            setBaseContent(val);
            setHasChanged(false);
            actionLogs.current = [];
        },
        markAsSaved: () => {
            setBaseContent(content);
            setHasChanged(false);
            actionLogs.current = [];
        },
        getPendingLogs: () => {
            return actionLogs.current;
        },
        resetPendingLogs: () => {
            actionLogs.current = [];
        },
        insertItem: (key, indexToInsert, val) => {
            const item = getCurrentValByKey(key, true);
            const resolvedIndex = resolveIndexFromTraversalResult(
                item.traverseResult,
                item.resolvedKey,
                String(indexToInsert)
            );
            if (Array.isArray(item.val)) {
                updateKey(key, [
                    ...item.val.slice(0, resolvedIndex),
                    val,
                    ...item.val.slice(resolvedIndex, item.val.length),
                ]);
            } else {
                throw new Error(
                    `${key} is not an array. pushItem can be only called upon an array`
                );
            }
        },
        pushItem: (key, val) => {
            const item = getCurrentValByKey(key);
            updateKey(key, [...(item || []), val]);
        },
        unshiftItem: (key, val) => {
            const item = getCurrentValByKey(key);
            updateKey(key, [val, ...(item || [])]);
        },
        removeItemAt: (key, index) => {
            const item = getCurrentValByKey(key, true);
            const resolvedIndex = resolveIndexFromTraversalResult(
                item.traverseResult,
                item.resolvedKey,
                index
            );
            if (Array.isArray(item.val)) {
                updateKey(
                    key,
                    item.val.filter((x: any, i: number) => i !== resolvedIndex)
                );
            } else {
                throw new Error(
                    `${key} is not an array. unshiftItem can be only called upon an array`
                );
            }
        },
        updateKey,
        saveLocally: () => {
            try {
                window.localStorage.setItem(
                    localStorageKey,
                    JSON.stringify(content)
                );
            } catch (e) {
                console.warn(
                    `Failed to load content from local storage for '${opts.serviceId};`
                );
                console.warn(e);
            }
        },
        hasLocalData: () => {
            try {
                const data = JSON.parse(
                    window.localStorage.getItem(localStorageKey)
                );
                return data !== undefined && data !== null;
            } catch (e) {
                console.warn(
                    `Failed to load content from local storage for '${opts.serviceId};`
                );
                console.warn(e);
            }

            return false;
        },
    };
}