import axios from 'axios';

export class BackendRemote {
    static instance: BackendRemote;
    static getInstance(): BackendRemote {
        if (!BackendRemote.instance) {
            BackendRemote.instance = new BackendRemote();
        }

        return BackendRemote.instance;
    }

    function = {
        call: async (path: string, ...args: any[]) => {
            try {
                const res = await axios({
                    baseURL: '/__backend/__managed/functions',
                    url: path,
                    method: 'post',
                    data: {
                        args
                    }
                });
    
                return res.data;
            } catch (e: any) {
                throw new Error((e?.response?.data?.message || e?.message) || 'Unknown network error');
            }
        }
    }

    constructor() {
    }
}