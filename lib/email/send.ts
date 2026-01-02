import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import { WelcomeEmail } from "./templates/welcome";

// Email configuration
const EMAIL_CONFIG = {
  // MailHog SMTP settings (development)
  smtp: {
    host: process.env.SMTP_HOST || "localhost",
    port: Number.parseInt(process.env.SMTP_PORT || "50239", 10),
    secure: false,
    // MailHog doesn't require auth
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  },
  from: {
    name: process.env.EMAIL_FROM_NAME || "Template Alpha",
    address: process.env.EMAIL_FROM_ADDRESS || "noreply@template-alpha.local",
  },
  appName: process.env.APP_NAME || "Template Alpha",
  appUrl: process.env.APP_URL || "http://localhost:58665",
};

// Create reusable transporter
function createTransporter() {
  return nodemailer.createTransport(EMAIL_CONFIG.smtp);
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using the configured transporter
 */
async function sendEmail(options: SendEmailOptions): Promise<void> {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"${EMAIL_CONFIG.from.name}" <${EMAIL_CONFIG.from.address}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}

/**
 * Send a welcome email to a newly registered user
 */
export async function sendWelcomeEmail(email: string): Promise<void> {
  const html = await render(
    WelcomeEmail({
      email,
      appName: EMAIL_CONFIG.appName,
      appUrl: EMAIL_CONFIG.appUrl,
    }),
  );

  const text = await render(
    WelcomeEmail({
      email,
      appName: EMAIL_CONFIG.appName,
      appUrl: EMAIL_CONFIG.appUrl,
    }),
    { plainText: true },
  );

  await sendEmail({
    to: email,
    subject: `Welcome to ${EMAIL_CONFIG.appName}`,
    html,
    text,
  });
}
