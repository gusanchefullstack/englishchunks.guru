import { Button, Heading, Text } from "@react-email/components";
import { buttonStyle, EmailLayout } from "./layout";

export function ResetPassword({ name, url }: { name: string; url: string }) {
  return (
    <EmailLayout preview="Reset your EnglishChunks.guru password">
      <Heading as="h1" style={{ fontSize: 24, margin: "0 0 12px" }}>
        Reset your password
      </Heading>
      <Text>
        Hi {name}, use this button to choose a new password. It works once and expires in 1 hour.
      </Text>
      <Button href={url} style={buttonStyle}>
        Choose a new password
      </Button>
      <Text style={{ color: "#667179", fontSize: 13 }}>
        If you didn&apos;t ask for this, you can ignore this email — your password won&apos;t
        change.
      </Text>
    </EmailLayout>
  );
}
