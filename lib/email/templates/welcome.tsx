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

interface WelcomeEmailProps {
  email?: string;
  appName?: string;
  appUrl?: string;
}

const defaultProps: WelcomeEmailProps = {
  email: "user@example.com",
  appName: "Template Alpha",
  appUrl: "http://localhost:58665",
};

export function WelcomeEmail({
  email = defaultProps.email,
  appName = defaultProps.appName,
  appUrl = defaultProps.appUrl,
}: WelcomeEmailProps) {
  const previewText = `Welcome to ${appName} - Let's build something great together`;

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
            <Heading style={heading}>Welcome aboard</Heading>
            <Text style={paragraph}>
              You've just joined something special. Your account with{" "}
              <strong style={highlight}>{email}</strong> is ready to go.
            </Text>

            <Section style={featureBox}>
              <Text style={featureHeading}>What you can do:</Text>
              <Text style={featureItem}>
                <span style={bullet}>&#x2713;</span> Organize your work with
                powerful task management
              </Text>
              <Text style={featureItem}>
                <span style={bullet}>&#x2713;</span> Collaborate seamlessly with
                your team
              </Text>
              <Text style={featureItem}>
                <span style={bullet}>&#x2713;</span> Track progress and hit your
                goals
              </Text>
            </Section>

            <Section style={buttonContainer}>
              <Button style={button} href={`${appUrl}/dashboard`}>
                Get Started
              </Button>
            </Section>

            <Text style={paragraph}>
              We're here to help you succeed. If you ever need anything, just
              reply to this email.
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

export default WelcomeEmail;
