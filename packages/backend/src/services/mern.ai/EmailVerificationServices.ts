import { IEmailVerificationServices } from "../IEmailVerificationServices";
import { MERNAI_Core } from "./core";

export class EmailVerificationServices extends MERNAI_Core implements IEmailVerificationServices {
    async initiateVerification(emailToVerify: string, otp: number): Promise<Boolean> {
        if (this.isEnabled === true) {
            try {
                const res = await this.client?.post(`/communication/api/v1/email/verification/initiate`, { emailToVerify, otp })
                if (res?.status === 200) {
                    return true
                }
            } catch (e: any) {
                if (e?.response?.data?.message) {
                    throw new Error(e?.response?.data?.message);
                } else {
                    throw e;
                }
            }
        }

        throw new Error('Compass services not enabled')
    };
}