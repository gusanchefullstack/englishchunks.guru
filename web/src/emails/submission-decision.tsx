import { Button, Heading, Text } from "@react-email/components";
import { buttonStyle, EmailLayout } from "./layout";

export function SubmissionAccepted({
  name,
  chunkText,
  points,
  url,
}: {
  name: string;
  chunkText: string;
  points: number;
  url: string;
}) {
  return (
    <EmailLayout preview={`“${chunkText}” is now in the library`}>
      <Heading as="h1" style={{ fontSize: 22, margin: "0 0 12px" }}>
        Great find, {name}!
      </Heading>
      <Text>
        Your chunk “{chunkText}” was accepted and is now in the library for every learner. You
        earned {points} points.
      </Text>
      <Button href={url} style={buttonStyle}>
        See it in the library
      </Button>
    </EmailLayout>
  );
}

export function SubmissionRejected({
  name,
  chunkText,
  reason,
}: {
  name: string;
  chunkText: string;
  reason: string | null;
}) {
  return (
    <EmailLayout preview="An update on your chunk suggestion">
      <Heading as="h1" style={{ fontSize: 22, margin: "0 0 12px" }}>
        Thanks for your suggestion, {name}
      </Heading>
      <Text>
        We didn&apos;t add “{chunkText}” to the library this time.
        {reason ? ` Reviewer note: ${reason}` : ""}
      </Text>
      <Text>Keep the ideas coming — every suggestion helps the library grow.</Text>
    </EmailLayout>
  );
}
