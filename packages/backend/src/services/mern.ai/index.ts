import { registerService } from "..";
import { EmailVerificationServices } from "./EmailVerificationServices";

export function initaliseMERNAI_Services() {
    registerService('email-verify-services', new EmailVerificationServices());
}