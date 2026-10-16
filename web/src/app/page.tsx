import Link from "next/link";

// Placeholder until the landing page (US7) is built.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <p className="text-eyebrow text-xs font-bold tracking-[1.7px] uppercase">
        Your daily English ritual
      </p>
      <h1 className="text-4xl tracking-tight">Real English. Ready when you need it.</h1>
      <p className="text-muted-foreground text-lg">
        One useful chunk a day. Hear it, say it, write it, and watch your confidence grow.
      </p>
      <div>
        <Link
          href="/sign-up"
          className="bg-primary text-primary-foreground inline-flex min-h-12 items-center rounded-xl px-5 font-bold"
        >
          Start free
        </Link>
      </div>
    </main>
  );
}
