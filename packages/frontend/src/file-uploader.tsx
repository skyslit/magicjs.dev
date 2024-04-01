import React from 'react';
import axios from 'axios';
import { uiUtils } from './ui-utils';

export function createUploader(backendFn: () => any, useOriginalFileNames: boolean = false) {
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
                let uploadedFiles: string[] = [];
                for (i = 0; i < files.length; i++) {
                    let name = files[i].name;

                    if (useOriginalFileNames === false) {
                        name = uiUtils.generateUniqueFilename(name);
                    }

                    uploadedFiles.push(name);
                    formData.append(`file_${i}`, new File([files[i]], name, { type: files[i].type }));
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

                return uploadedFiles;
            } catch (e) {
                setLoading(false);
                throw e;
            }
        }
    }, [backendFn, files, useOriginalFileNames]);

    return {
        files,
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

export function UploadButton(props: { 
    className?: string, 
    style?: any, 
    uploadBtnClassName?: string, 
    uploadBtnStyle?: any, 
    backendFn: () => any,
    uploadArg?: any,
    onUpload?: (uploadedFiles: string[]) => any
    useOriginalFileNames?: boolean
    inputProps?: React.InputHTMLAttributes<HTMLInputElement>
}) {
    const [err, setErr] = React.useState(null);
    const { readyToUpload, addFiles, files, loading, uploadProgress, upload } = createUploader(props.backendFn, props.useOriginalFileNames);

    if (loading === true) {
        return (
            <span>{`Uploading (${uploadProgress}%)`}</span>
        )
    }

    if (err) {
        return (
            <span>{err?.message || 'Upload error'}</span>
        )
    }

    if (readyToUpload === true) {
        return (
            <button 
                onClick={() => {
                    setErr(null);

                    upload(props?.uploadArg)
                        .then((uploadedFiles) => {
                            addFiles(null);
                            return uploadedFiles;
                        })
                        .then((uploadedFiles) => props?.onUpload && props?.onUpload(uploadedFiles))
                        .catch((err) => setErr(err));
                }}
                className={`${props?.className} ${props?.uploadBtnClassName}`} 
                style={{ ...(props?.style || {}), ...(props?.uploadBtnStyle || {}), cursor: 'pointer' }}
            >
                    {`Upload ${files.length} file(s)`}
            </button>
        )
    }

    return (
        <label className={props?.className} style={{ ...(props?.style || {}), cursor: 'pointer' }}>
            Choose File
            <input
                {...props?.inputProps}
                type="file"
                onChange={(e) => addFiles(e.target.files)}
                style={{ display: 'none' }}
            />
        </label>
    )
}