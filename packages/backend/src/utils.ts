import bcrypt from 'bcryptjs';
import { Readable } from 'stream';
import { getService } from './services';
import { IEmailVerificationServices } from './services/IEmailVerificationServices';
import { IUserUploadServices } from './services/IUserUploadServices';
import { data } from '.';

/* -------------------------------------------------------------------------- */
/*                                  Security                                  */
/* -------------------------------------------------------------------------- */

export type RoleMapping = {
    userId: string,
    role: string
}

const USER_ROLE_MAPPING_COLLECTION_NAME = 'user_role_mapping';

function hash(payload: string, salt: number = 10) {
    const s = bcrypt.genSaltSync();
    return bcrypt.hashSync(payload, s);
}

function verifyHash(payload: string, hash: string): boolean {
    return bcrypt.compareSync(payload, hash);
}

async function assignRoleToUser(userId: string, role: string): Promise<boolean> {
    const collection = data(USER_ROLE_MAPPING_COLLECTION_NAME);

    await collection.updateOne({
        userId,
        role
    }, {
        $set: {}
    }, { upsert: true });

    return true;
}

async function unassignRoleFromUser(userId: string, role: string): Promise<boolean> {
    const collection = data(USER_ROLE_MAPPING_COLLECTION_NAME);

    await collection.deleteOne({
        userId,
        role
    });

    return true;
}

async function findAllRolesByUser(userId: string): Promise<RoleMapping[]> {
    const collection = data(USER_ROLE_MAPPING_COLLECTION_NAME);

    const matchingRoles = await collection.find({
        userId
    }).toArray();

    return matchingRoles as any[];
}

async function isUserInAnyRoles(userId: string, roles: string | Array<string>): Promise<boolean> {
    if (!Array.isArray(roles)) {
        roles = [roles];
    }

    const collection = data(USER_ROLE_MAPPING_COLLECTION_NAME);

    const matchingRoles = await collection.find({
        userId,
        role: {
            $in: roles
        }
    }).toArray();

    return matchingRoles.length > 0;
}

/* -------------------------------------------------------------------------- */
/*                           File Upload / Download                           */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                                Communication                               */
/* -------------------------------------------------------------------------- */

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
    initiateEmailVerification,
    assignRoleToUser,
    unassignRoleFromUser,
    isUserInAnyRoles,
    findAllRolesByUser
}