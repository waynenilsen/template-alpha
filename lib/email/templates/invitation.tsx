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

interface InvitationEmailProps {
  email?: string;
  organizationName?: string;
  invitedByEmail?: string;
  inviteUrl?: string;
  appName?: string;
  appUrl?: string;
}

const defaultProps: InvitationEmailProps = {
  email: "user@example.com",
  organizationName: "Acme Corp",
  invitedByEmail: "admin@acme.com",
  inviteUrl: "http://localhost:58665/invite/abc123",
  appName: "Template Alpha",
  appUrl: "http://localhost:58665",
};

export function InvitationEmail({
  email = defaultProps.email,
  organizationName = defaultProps.organizationName,
  invitedByEmail = defaultProps.invitedByEmail,
  inviteUrl = defaultProps.inviteUrl,
  appName = defaultProps.appName,
  appUrl = defaultProps.appUrl,
}: InvitationEmailProps) {
  const previewText = `You've been invited to join ${organizationName} on ${appName}`;

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
            <Heading style={heading}>You're invited!</Heading>
            <Text style={paragraph}>
              <strong style={highlight}>{invitedByEmail}</strong> has invited
              you to join <strong style={highlight}>{organizationName}</strong>{" "}
              on {appName}.
            </Text>

            <Section style={featureBox}>
              <Text style={featureHeading}>What's next:</Text>
              <Text style={featureItem}>
                <span style={bullet}>1.</span> Click the button below to accept
                the invitation
              </Text>
              <Text style={featureItem}>
                <span style={bullet}>2.</span> Sign in or create an account with{" "}
                <strong>{email}</strong>
              </Text>
              <Text style={featureItem}>
                <span style={bullet}>3.</span> Start collaborating with your
                team
              </Text>
            </Section>

            <Section style={buttonContainer}>
              <Button style={button} href={inviteUrl}>
                Accept Invitation
              </Button>
            </Section>

            <Text style={warningText}>
              This invitation will expire in 7 days. If you didn't expect this
              invitation, you can safely ignore this email.
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

const featureBox: React.CSSProperties = {
  backgroundColor: "#fafafa",
  borderRadius: "8px",
  padding: "24px",
  margin: "0 0 32px",
  borderLeft: "3px solid #171717",
};

const featureHeading: React.CSSProperties = {
  color: "#171717",
  fontSize: "14px",
  fontWeight: "600",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 16px",
};

const featureItem: React.CSSProperties = {
  color: "#525252",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 8px",
};

const bullet: React.CSSProperties = {
  color: "#171717",
  fontWeight: "600",
  marginRight: "8px",
};

const buttonContainer: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "0 0 24px",
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

const warningText: React.CSSProperties = {
  color: "#a3a3a3",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0",
  textAlign: "center" as const,
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

export default InvitationEmail;
