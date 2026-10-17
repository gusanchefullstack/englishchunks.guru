import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms of use · EnglishChunks.guru",
  description: "The rules for using EnglishChunks.guru.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="October 17, 2026">
      <p>
        By creating an account or using EnglishChunks.guru you agree to these terms and to our{" "}
        <Link href="/privacy">privacy policy</Link>. Questions:{" "}
        <a href="mailto:hello@englishchunks.guru">hello@englishchunks.guru</a>.
      </p>

      <h2>Who can use it</h2>
      <ul>
        <li>You must be 16 or older.</li>
        <li>One account per person. Keep your sign-in details to yourself.</li>
      </ul>

      <h2>What the service is</h2>
      <ul>
        <li>
          A daily English practice tool. Scores, tips and writing feedback are generated
          automatically to help you learn; they are guidance, not an official language assessment
          or certification.
        </li>
        <li>
          The service is new and still improving. We may change, pause or stop features, and it
          may sometimes be unavailable.
        </li>
      </ul>

      <h2>Fair use</h2>
      <ul>
        <li>Record only your own voice, and don&apos;t upload anything unlawful or abusive.</li>
        <li>
          Don&apos;t try to break, overload or reverse-engineer the service, get around daily
          limits, or access other people&apos;s data.
        </li>
        <li>We may suspend accounts that break these rules.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        Sentences you write and chunks you suggest stay yours. You let us use them to run the
        service for you (for example, grading your writing). If you suggest a chunk and we add it
        to the library, other learners may see and practice it.
      </p>

      <h2>Plans and payments</h2>
      <p>
        Practice is free while we are testing. If paid plans are offered later, prices, the free
        trial and how to cancel will be shown clearly before you pay, and payments are handled by
        Stripe. You can cancel any time; your plan stays active until the end of the paid period.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time in your <Link href="/profile">profile</Link>,
        which permanently removes your data as described in the privacy policy.
      </p>

      <h2>Liability</h2>
      <p>
        The service is provided &ldquo;as is&rdquo;. To the extent the law allows, we are not
        liable for indirect losses or for decisions you make based on automated feedback.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. If a change matters, we&apos;ll update the date above and let
        you know in the app or by email.
      </p>
    </LegalPage>
  );
}
