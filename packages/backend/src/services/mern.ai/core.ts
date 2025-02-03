import axios, { Axios } from 'axios';

export function resolveCompassServiceEndpoint() {
    let baseUrl = 'https://compass-services.skyslit.com';

    if (typeof process.env.WS_ENVIRONMENT_ID === 'string' && process.env.WS_ENVIRONMENT_ID !== '') {
        console.log('Using private service name for compass service');
        baseUrl = 'http://srv-service.prod';
    } else {
        console.log('Using public service name for compass service');
    }

    return process.env.COMPASS_SERVICE_ENDPOINT || baseUrl
}

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
            WS_ENVIRONMENT_ID
        } = process.env || {};

        this.isEnabled = Boolean(WS_CRED_SERVICE_TENANT_ID)
            && Boolean(WS_CRED_SERVICE_CLIENT_ID)
            && Boolean(WS_CRED_SERVICE_CLIENT_SECRET)
            && Boolean(WS_PROJECT_ID);

        this.userUploadServiceEnabled = this.isEnabled && Boolean(WS_ENVIRONMENT_ID);

        // Added logs
        if (this._isEnabled === true) {
            this.client = axios.create({
                baseURL: resolveCompassServiceEndpoint(),
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