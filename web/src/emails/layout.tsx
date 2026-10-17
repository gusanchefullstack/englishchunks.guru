import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

/** Shared email layout using the brand palette (snow background, ink text, mint accent). */
export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  const base = process.env.BETTER_AUTH_URL ?? "https://englishchunks.guru";
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: "#f4faff",
          color: "#08090a",
          fontFamily: "Nunito, Arial, sans-serif",
        }}
      >
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 24px" }}>
          <Img src={`${base}/logo-mark-email.png`} width="40" height="40" alt="EnglishChunks.guru" />
          <Section
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #dfe8ea",
              borderRadius: 20,
              padding: "28px 32px",
              marginTop: 16,
            }}
          >
            {children}
          </Section>
          <Hr style={{ borderColor: "#dfe8ea", margin: "24px 0" }} />
          <Text style={{ color: "#667179", fontSize: 12 }}>
            EnglishChunks.guru · One useful chunk a day.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const buttonStyle = {
  backgroundColor: "#5dfdcb",
  color: "#08090a",
  borderRadius: 12,
  padding: "12px 20px",
  fontWeight: 700,
  textDecoration: "none",
  display: "inline-block",
} as const;
