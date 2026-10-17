import { Button, Heading, Text } from "@react-email/components";
import { buttonStyle, EmailLayout } from "./layout";

export function TrialEnding({ name, url }: { name: string; url: string }) {
  return (
    <EmailLayout preview="Your free trial ends tomorrow">
      <Heading as="h1" style={{ fontSize: 22, margin: "0 0 12px" }}>
        Your free trial ends tomorrow, {name}
      </Heading>
      <Text>
        Choose a plan to keep your streak and daily practice going. Your progress stays saved either
        way.
      </Text>
      <Button href={url} style={buttonStyle}>
        Choose a plan
      </Button>
    </EmailLayout>
  );
}

export function PaymentFailed({ name, url }: { name: string; url: string }) {
  return (
    <EmailLayout preview="We couldn't take your payment">
      <Heading as="h1" style={{ fontSize: 22, margin: "0 0 12px" }}>
        We couldn&apos;t take your payment
      </Heading>
      <Text>
        Hi {name}, your latest payment didn&apos;t go through. You can keep practicing while we try
        again — please update your payment method to avoid interruption.
      </Text>
      <Button href={url} style={buttonStyle}>
        Update payment method
      </Button>
    </EmailLayout>
  );
}
