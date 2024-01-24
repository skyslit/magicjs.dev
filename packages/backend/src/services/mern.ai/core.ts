import axios, { Axios } from 'axios';

export class MERNAI_Core {
    client: Axios | null;

    private _isEnabled: boolean = false;
    get isEnabled() {
        if (this._isEnabled === false) {
            console.warn(`MERN.AI services not enabled, hence some functionalities won't work as expected.`);
        }
        return this._isEnabled;
    }

    set isEnabled(val: boolean) {
        this._isEnabled = val;
    }

    private _userUploadServiceEnabled: boolean = false;
    get userUploadServiceEnabled() {
        if (this._userUploadServiceEnabled === false) {
            console.warn(`MERN.AI User Uploads service not enabled, hence upload functionalities won't work as expected.`);
        }
        return this._userUploadServiceEnabled;
    }

    set userUploadServiceEnabled(val: boolean) {
        this._userUploadServiceEnabled = val;
    }

    constructor() {
        const {
            WS_CRED_SERVICE_TENANT_ID,
            WS_CRED_SERVICE_CLIENT_ID,
            WS_CRED_SERVICE_CLIENT_SECRET,
            WS_PROJECT_ID,
            WS_NON_DEV_ENV_ID
        } = process.env || {};

        this.isEnabled = Boolean(WS_CRED_SERVICE_TENANT_ID)
            && Boolean(WS_CRED_SERVICE_CLIENT_ID)
            && Boolean(WS_CRED_SERVICE_CLIENT_SECRET)
            && Boolean(WS_PROJECT_ID);

        this.userUploadServiceEnabled = this.isEnabled && Boolean(WS_NON_DEV_ENV_ID);

        if (this._isEnabled === true) {
            this.client = axios.create({
                baseURL: 'https://compass-services.skyslit.com',
                headers: {
                    'tenantid': WS_CRED_SERVICE_TENANT_ID,
                    'clientid': WS_CRED_SERVICE_CLIENT_ID,
                    'clientsecret': WS_CRED_SERVICE_CLIENT_SECRET,
                    'projectid': WS_PROJECT_ID
                }
            });
        } else {
            this.client = null;
        }
    }
}