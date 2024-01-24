import { registerService } from "..";
import { LocalUserUploadServices } from "../local/LocalUserUploadServices";
import { EmailVerificationServices } from "./EmailVerificationServices";
import { UserUploadServices } from "./UserUploadServices";

export function initaliseMERNAI_Services() {
    const NODE_ENV = process.env['NODE_ENV'];
    const IS_DEVELOPMENT = NODE_ENV === undefined || NODE_ENV === 'development'

    registerService('email-verify-services', new EmailVerificationServices());

    /** Initialise user upload services */
    if (IS_DEVELOPMENT === true && process.env['USER_UPLOAD_SERVICES'] !== 'MERN.AI') {
        console.log('Local User Upload service initialised');
        registerService('user-upload-services', new LocalUserUploadServices());
    } else {
        console.log('MERN.AI User Upload service initialised');
        registerService('user-upload-services', new UserUploadServices());
    }
}