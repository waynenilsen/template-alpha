import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface PasswordResetEmailProps {
  email?: string;
  resetLink?: string;
  appName?: string;
  appUrl?: string;
}

const defaultProps: PasswordResetEmailProps = {
  email: "user@example.com",
  resetLink: "http://localhost:58665/reset-password?token=abc123",
  appName: "Template Alpha",
  appUrl: "http://localhost:58665",
};

export function PasswordResetEmail({
  email = defaultProps.email,
  resetLink = defaultProps.resetLink,
  appName = defaultProps.appName,
  appUrl = defaultProps.appUrl,
}: PasswordResetEmailProps) {
  const previewText = `Reset your ${appName} password`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with gradient accent */}
          <Section style={headerSection}>
            <div style={gradientBar} />
            <Heading style={logoText}>{appName}</Heading>
          </Section>

          {/* Main content */}
          <Section style={contentSection}>
            <Heading style={heading}>Reset your password</Heading>
            <Text style={paragraph}>
              We received a request to reset the password for your account
              associated with <strong style={highlight}>{email}</strong>.
            </Text>

            <Text style={paragraph}>
              Click the button below to choose a new password. This link will
              expire in 1 hour.
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={resetLink}>
                Reset Password
              </Button>
            </Section>

            <Section style={warningBox}>
              <Text style={warningText}>
                If you didn't request this password reset, you can safely ignore
                this email. Your password will remain unchanged.
              </Text>
            </Section>

            <Text style={paragraph}>
              If the button doesn't work, copy and paste this link into your
              browser:
            </Text>
            <Text style={linkText}>
              <Link href={resetLink} style={resetLinkStyle}>
                {resetLink}
              </Link>
            </Text>
          </Section>

          {/* Divider */}
          <Hr style={hr} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              This email was sent to{" "}
              <Link href={`mailto:${email}`} style={footerLink}>
                {email}
              </Link>
            </Text>
            <Text style={footerText}>
              <Link href={appUrl} style={footerLink}>
                {appName}
              </Link>{" "}
              &mdash; Built for teams that ship
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles - Modern, clean, on-brand
const main: React.CSSProperties = {
  backgroundColor: "#f6f6f6",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "0",
  maxWidth: "580px",
  borderRadius: "8px",
  overflow: "hidden",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
};

const headerSection: React.CSSProperties = {
  padding: "0",
};

const gradientBar: React.CSSProperties = {
  height: "4px",
  background: "linear-gradient(90deg, #171717 0%, #404040 50%, #171717 100%)",
};

const logoText: React.CSSProperties = {
  color: "#171717",
  fontSize: "24px",
  fontWeight: "700",
  textAlign: "center" as const,
  padding: "32px 0 24px",
  margin: "0",
  letterSpacing: "-0.5px",
};

const contentSection: React.CSSProperties = {
  padding: "0 40px 32px",
};

const heading: React.CSSProperties = {
  color: "#171717",
  fontSize: "28px",
  fontWeight: "600",
  lineHeight: "1.3",
  margin: "0 0 24px",
  letterSpacing: "-0.5px",
};

const paragraph: React.CSSProperties = {
  color: "#525252",
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 24px",
};

const highlight: React.CSSProperties = {
  color: "#171717",
};

const warningBox: React.CSSProperties = {
  backgroundColor: "#fafafa",
  borderRadius: "8px",
  padding: "16px 24px",
  margin: "0 0 24px",
  borderLeft: "3px solid #a3a3a3",
};

const warningText: React.CSSProperties = {
  color: "#525252",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0",
};

const buttonContainer: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "0 0 32px",
};

const button: React.CSSProperties = {
  backgroundColor: "#171717",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "14px 32px",
  display: "inline-block",
};

const linkText: React.CSSProperties = {
  color: "#525252",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 24px",
  wordBreak: "break-all" as const,
};

const resetLinkStyle: React.CSSProperties = {
  color: "#737373",
  textDecoration: "underline",
};

const hr: React.CSSProperties = {
  borderColor: "#e5e5e5",
  margin: "0",
};

const footer: React.CSSProperties = {
  padding: "24px 40px",
};

const footerText: React.CSSProperties = {
  color: "#a3a3a3",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0 0 8px",
  textAlign: "center" as const,
};

const footerLink: React.CSSProperties = {
  color: "#737373",
  textDecoration: "underline",
};

export default PasswordResetEmail;
