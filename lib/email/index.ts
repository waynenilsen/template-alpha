/**
 * Email service module
 *
 * Handles email rendering and sending using React Email and Nodemailer.
 * In development, emails are sent to MailHog for easy testing.
 */

export {
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "./send";
export { InvitationEmail } from "./templates/invitation";
export { WelcomeEmail } from "./templates/welcome";
