import { Button, Heading, Text } from "@react-email/components";
import { buttonStyle, EmailLayout } from "./layout";

export function WaitlistInvite({ url }: { url: string }) {
  return (
    <EmailLayout preview="Your EnglishChunks.guru spot is ready">
      <Heading as="h1" style={{ fontSize: 22, margin: "0 0 12px" }}>
        Your spot is ready!
      </Heading>
      <Text>
        Thanks for waiting. Create your account with this link — it works once and expires in 7
        days.
      </Text>
      <Button href={url} style={buttonStyle}>
        Create my account
      </Button>
    </EmailLayout>
  );
}
