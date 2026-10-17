import { Button, Heading, Link, Text } from "@react-email/components";
import { buttonStyle, EmailLayout } from "./layout";

export function ReminderEmail({
  name,
  streak,
  appUrl,
  unsubscribeUrl,
}: {
  name: string;
  streak: number;
  appUrl: string;
  unsubscribeUrl: string;
}) {
  return (
    <EmailLayout preview="Your chunk for today is waiting">
      <Heading as="h1" style={{ fontSize: 22, margin: "0 0 12px" }}>
        Hi {name}, your chunk is waiting
      </Heading>
      <Text>
        {streak > 0
          ? `You're on a ${streak}-day streak. One short practice keeps it going.`
          : "One short practice today starts a new streak."}
      </Text>
      <Button href={`${appUrl}/today`} style={buttonStyle}>
        Practice now
      </Button>
      <Text style={{ color: "#667179", fontSize: 12, marginTop: 24 }}>
        You get this because daily reminders are on.{" "}
        <Link href={unsubscribeUrl}>Turn off reminders</Link>
      </Text>
    </EmailLayout>
  );
}
