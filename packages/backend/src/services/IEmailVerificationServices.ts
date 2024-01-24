export interface IEmailVerificationServices {
    initiateVerification: (emailToVerify: string, otp: number) => Promise<Boolean>;
}