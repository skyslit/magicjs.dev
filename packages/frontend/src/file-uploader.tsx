import React from 'react';
import axios from 'axios';

export function createUploader(backendFn: () => any) {
    const [files, addFiles] = React.useState<FileList | null>();
    const [loading, setLoading] = React.useState<boolean>(false);
    const [uploadProgress, setUploadProgress] = React.useState(0);

    const readyToUpload = React.useMemo(() => {
        return files && files.length > 0;
    }, [files]);

    const upload = React.useCallback(async (...args: any[]) => {
        if (files) {
            try {
                setLoading(true);
                setUploadProgress(0);

                const apiPath = backendFn.prototype.__fullPath;
                const formData = new FormData();
                let i: number;
                for (i = 0; i < files.length; i++) {
                    formData.append(`file_${i}`, files[i]);
                }

                const response = await axios({
                    data: formData,
                    method: 'post',
                    url: apiPath,
                    onUploadProgress: progressEvent => {
                        const { loaded, total } = progressEvent;
                        const percentCompleted = Math.round((loaded * 100) / (total as any));
                        if (!isNaN(percentCompleted)) {
                            setUploadProgress(percentCompleted);
                        }
                    },
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        'args': JSON.stringify(args)
                    }
                });

                setUploadProgress(100);
                setLoading(false);
            } catch (e) {
                setLoading(false);
                throw e;
            }
        }
    }, [backendFn, files]);

    return {
        addFiles,
        readyToUpload,
        upload,
        loading,
        uploadProgress
    }
}

export function createSrc(backendFn: () => any) {
    return {
        getLink: (...args: any[]) => {
            const apiPath = backendFn?.prototype?.__fullPath;
            if (!apiPath) {
                throw new Error(`backendFn is invalid`);
            }

            const url = new URL('http://localhost');
            url.pathname = apiPath;
            if (args.length > 0) {
                url.searchParams.set('args', JSON.stringify(args));
            }

            return `${url.pathname}${url.search}`
        }
    }
}