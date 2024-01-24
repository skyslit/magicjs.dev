import bcrypt from 'bcryptjs';
import { Readable } from 'stream';
import { getService } from './services';
import { IEmailVerificationServices } from './services/IEmailVerificationServices';
import { IUserUploadServices } from './services/IUserUploadServices';

/* -------------------------------------------------------------------------- */
/*                                  Security                                  */
/* -------------------------------------------------------------------------- */

function hash(payload: string, salt: number = 10) {
    const s = bcrypt.genSaltSync();
    return bcrypt.hashSync(payload, s);
}

function verifyHash(payload: string, hash: string): boolean {
    return bcrypt.compareSync(payload, hash);
}

function saveFileToUserUploads(dir: string, name: string, file: Readable) {
    const userUploadServices = getService<IUserUploadServices>('user-upload-services');
    return userUploadServices.saveFileToUserUploads(dir, name, file);
}

function readFileFromUserUploads(dir: string, name: string) {
    const userUploadServices = getService<IUserUploadServices>('user-upload-services');
    return userUploadServices.readFileFromUserUploads(dir, name);
}

function removeFileFromUserUploads(dir: string, name: string) {
    const userUploadServices = getService<IUserUploadServices>('user-upload-services');
    return userUploadServices.removeFileFromUserUploads(dir, name);
}

function initiateEmailVerification(emailToVerify: string, otp: number) {
    const emailVerificationService = getService<IEmailVerificationServices>('email-verify-services');
    const isVerifyEmailInitiated = emailVerificationService.initiateVerification(emailToVerify, otp)

    return isVerifyEmailInitiated;
}

export default {
    hash,
    verifyHash,
    saveFileToUserUploads,
    readFileFromUserUploads,
    removeFileFromUserUploads,
    initiateEmailVerification
}