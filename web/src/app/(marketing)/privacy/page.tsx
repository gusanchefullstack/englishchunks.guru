import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy policy · EnglishChunks.guru",
  description: "What EnglishChunks.guru collects, why, who processes it, and your choices.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="October 18, 2026">
      <p>
        EnglishChunks.guru helps you learn English chunks by listening, speaking and writing. This
        page explains what we collect, why, who helps us process it, and the choices you have. If
        anything is unclear, write to{" "}
        <a href="mailto:hello@englishchunks.guru">hello@englishchunks.guru</a>.
      </p>

      <h2>Your voice recordings</h2>
      <ul>
        <li>
          When you record yourself, the audio is sent to our own scoring server, scored in memory
          and <strong>deleted as soon as it is scored</strong>. It is never saved to disk, never
          stored in our database and never sent to any third party.
        </li>
        <li>
          We keep only the results: your score, which sounds you found hard and the tip you were
          given. What our speech recognizer heard is not kept.
        </li>
        <li>The scoring uses open-source speech models that run on servers we operate.</li>
      </ul>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name, username, email address, and your Google
          profile picture if you sign in with Google, or a photo you upload yourself.
        </li>
        <li>
          <strong>Learning settings:</strong> your English level, time zone, daily reminder time,
          preferred voice and confirmation that you are 16 or older.
        </li>
        <li>
          <strong>Learning activity:</strong> the chunks you practice, your scores, your streak and
          points, the sentences you write and the feedback on them, and chunks you suggest.
        </li>
        <li>
          <strong>Payments (only once paid plans are switched on):</strong> your plan and its
          status. Card details are handled by Stripe and never reach us.
        </li>
        <li>
          <strong>Technical logs:</strong> short-lived server logs with request IDs and timings.
          They don&apos;t contain your recordings, sentences or what you said.
        </li>
        <li>
          <strong>Practice problems:</strong> when something stops a practice (the microphone is
          blocked, a recording can&apos;t be understood, an upload or page fails), we note what
          happened, at which step and when, so we can fix it. Only a short code is kept, never your
          audio or anything you said or wrote.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To run your daily practice, score your pronunciation and give you feedback.</li>
        <li>To show your progress, streak and ranking within your level band.</li>
        <li>To send account emails (verification, password reset) and reminders you choose.</li>
        <li>To keep the service safe and working (rate limits, abuse prevention, debugging).</li>
      </ul>
      <p>We don&apos;t sell your data, show ads, or use analytics or tracking cookies.</p>

      <h2>Who processes data for us</h2>
      <ul>
        <li>
          <strong>Vercel</strong> hosts the website, and <strong>Neon</strong> hosts our database.
        </li>
        <li>
          <strong>DigitalOcean</strong> hosts our scoring server (where recordings are scored and
          deleted) and stores generated audio and profile photos.
        </li>
        <li>
          <strong>Vercel AI Gateway</strong> sends the sentences you write, and your scores and
          practice text, to open-weight language models so they can grade your writing and write
          short tips. Your recordings are never sent.
        </li>
        <li>
          <strong>ElevenLabs</strong> turns chunk texts, example sentences and your own written
          sentences into audio when you press play.
        </li>
        <li>
          <strong>Resend</strong> delivers our emails, and <strong>Google</strong> handles
          &ldquo;Continue with Google&rdquo; sign-in.
        </li>
        <li>
          <strong>Stripe</strong> processes payments once paid plans are available.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use one essential cookie to keep you signed in. Your light/dark theme choice is saved in
        your browser only. No advertising or analytics cookies.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Recordings: not kept at all (deleted right after scoring).</li>
        <li>Your account and learning history: until you delete your account.</li>
        <li>Technical logs: a short time, then they are rotated out.</li>
        <li>Practice problems: 30 days, then they are deleted automatically.</li>
      </ul>

      <h2>Your choices and rights</h2>
      <ul>
        <li>
          Change your details, level, reminders and photo in your{" "}
          <Link href="/profile">profile</Link>.
        </li>
        <li>Unsubscribe from reminders with one click from any reminder email.</li>
        <li>
          <strong>Delete your account</strong> yourself in your profile. This permanently removes
          your account, learning history, photo and personal audio, and cancels any subscription.
        </li>
        <li>
          To ask for a copy of your data or anything else, email{" "}
          <a href="mailto:hello@englishchunks.guru">hello@englishchunks.guru</a>.
        </li>
      </ul>

      <h2>Age</h2>
      <p>EnglishChunks.guru is for learners aged 16 and over.</p>

      <h2>Changes</h2>
      <p>
        If we change this policy in a way that matters, we&apos;ll update the date above and tell
        you in the app or by email.
      </p>
    </LegalPage>
  );
}
