import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Logo } from "@/components/app-shell/logo";
import { IntroVideo } from "@/components/marketing/intro-video";
import { Plans } from "@/components/marketing/plans";
import { isBillingActive } from "@/lib/domain/billing-state";

const TYPES = [
  { name: "Collocations", text: "make a decision", note: "Words that naturally go together." },
  { name: "Idioms", text: "spill the beans", note: "The meaning isn't in the single words." },
  { name: "Social phrases", text: "how's it going?", note: "Quick formulas for everyday talk." },
  {
    name: "Vague language",
    text: "or something like that",
    note: "Sound natural when you're not exact.",
  },
  { name: "Sentence frames", text: "I tend to …", note: "Fill the gap with your own idea." },
  {
    name: "Verb patterns",
    text: "get used to …",
    note: "Verbs with a fixed structure after them.",
  },
  {
    name: "Discourse markers",
    text: "having said that",
    note: "Connect and organize what you say.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav aria-label="Account" className="flex items-center gap-2">
          <Link href="/sign-in" className="rounded-xl px-4 py-2 font-bold">
            Log in
          </Link>
          <Link
            href="/sign-up"
            className="bg-primary text-primary-foreground rounded-xl px-4 py-2 font-bold"
          >
            Start free
          </Link>
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <p className="text-eyebrow inline-flex items-center gap-2 text-xs font-bold tracking-[1.7px] uppercase">
              <Sparkles aria-hidden className="size-4" /> Your daily English ritual
            </p>
            <h1 className="mt-4 text-[clamp(2.5rem,7vw,4rem)] leading-[1.05] tracking-[-1.5px]">
              Real English. <em className="text-brand-link font-bold">Ready when you need it.</em>
            </h1>
            <p className="text-muted-foreground mt-5 max-w-xl text-lg">
              Native speakers don&apos;t build sentences word by word — they use{" "}
              <strong className="text-foreground">chunks</strong>. Learn one useful chunk a day:
              hear it, say it, write it, and get friendly feedback on your pronunciation.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Suspense fallback={<HeroCta billingActive={false} />}>
                <HeroCtaLive />
              </Suspense>
              <a href="#chunks" className="bg-card rounded-xl border px-5 py-3 font-bold">
                What&apos;s a chunk?
              </a>
            </div>
          </div>
          <IntroVideo />
        </section>

        <section id="chunks" aria-labelledby="chunks-title" className="bg-card border-y">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <p className="text-eyebrow text-xs font-bold tracking-[1.7px] uppercase">Why chunks?</p>
            <h2 id="chunks-title" className="mt-2 text-[clamp(2rem,5vw,2.75rem)] leading-tight">
              Speak in ready-made blocks of meaning.
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl">
              Chunks help you speak faster and sound natural, because you stop translating word by
              word. We teach seven kinds, matched to your level from A1 to C2.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TYPES.map((t) => (
                <li key={t.name} className="rounded-2xl border p-5">
                  <p className="text-tag-type-foreground text-xs font-bold tracking-wide uppercase">
                    {t.name}
                  </p>
                  <p className="mt-2 text-xl">“{t.text}”</p>
                  <p className="text-muted-foreground mt-1 text-sm">{t.note}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="plans-title" className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-eyebrow text-xs font-bold tracking-[1.7px] uppercase">Plans</p>
          <h2 id="plans-title" className="mt-2 mb-8 text-[clamp(2rem,5vw,2.75rem)] leading-tight">
            Start small. Practice every day.
          </h2>
          <Suspense fallback={<Plans billingActive={false} />}>
            <PlansLive />
          </Suspense>
        </section>

        <section className="bg-coach text-snow">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-14">
            <p className="max-w-xl text-3xl">
              One useful chunk. Twelve focused minutes. A little more confidence every day.
            </p>
            <Link
              href="/sign-up"
              className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-xl px-6 py-3 font-bold"
            >
              Get started <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </section>
      </main>
      <footer className="text-muted-foreground mx-auto max-w-6xl px-5 py-8 text-sm">
        © EnglishChunks.guru · For learners aged 16 and over · Built with open-source AI
      </footer>
    </div>
  );
}

function HeroCta({ billingActive }: { billingActive: boolean }) {
  return (
    <Link
      href="/sign-up"
      className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold"
    >
      {billingActive ? "Start your 7-day free trial" : "Start free"}{" "}
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}

async function HeroCtaLive() {
  await connection(); // request-time: billing state can change any time
  return <HeroCta billingActive={await isBillingActive()} />;
}

async function PlansLive() {
  await connection();
  return <Plans billingActive={await isBillingActive()} />;
}
