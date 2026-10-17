import { Button, Heading, Text } from "@react-email/components";
import { buttonStyle, EmailLayout } from "./layout";

export function VerifyEmail({ name, url }: { name: string; url: string }) {
  return (
    <EmailLayout preview="Confirm your email to start your first chunk">
      <Heading as="h1" style={{ fontSize: 24, margin: "0 0 12px" }}>
        Welcome, {name}!
      </Heading>
      <Text>Confirm your email to start your first chunk. The link works for 24 hours.</Text>
      <Button href={url} style={buttonStyle}>
        Confirm my email
      </Button>
      <Text style={{ color: "#667179", fontSize: 13 }}>
        If you didn&apos;t create an account, you can ignore this email.
      </Text>
    </EmailLayout>
  );
}
