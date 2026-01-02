/**
 * Email service module
 *
 * Handles email rendering and sending using React Email and Nodemailer.
 * In development, emails are sent to MailHog for easy testing.
 */

export { sendWelcomeEmail } from "./send";
export { WelcomeEmail } from "./templates/welcome";
