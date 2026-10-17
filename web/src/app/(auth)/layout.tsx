import { Sparkles, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/** Figma 1:4 / 2:1244 — dark brand panel + form. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[44%_1fr]">
      <aside className="bg-coach text-snow relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <Link
          href="/"
          className="bg-card text-foreground inline-flex w-fit items-center gap-2 rounded-xl px-3 py-2"
        >
          <Image src="/logo-mark.svg" alt="" width={32} height={32} />
          <span className="font-bold">
            englishchunks<span className="text-brand-link text-xs">.guru</span>
          </span>
        </Link>
        <div>
          <p className="text-mint inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold tracking-[1.3px] uppercase">
            <Sparkles aria-hidden className="size-3.5" /> Your daily English ritual
          </p>
          <p className="mt-6 text-5xl leading-tight">
            Real English. <em className="text-mint font-bold">Ready when you need it.</em>
          </p>
          <p className="text-coach-foreground mt-5">
            One useful chunk. Twelve focused minutes. A little more confidence every day.
          </p>
        </div>
        <blockquote className="border-mint border-l-2 pl-4">
          <p>
            “I used today&apos;s chunk in a meeting—and nobody knew I had learned it that morning.”
          </p>
          <footer className="text-coach-foreground mt-2 text-sm">— Hana, B1 learner</footer>
        </blockquote>
      </aside>
      <main id="main" className="relative flex items-center justify-center px-5 py-12">
        <Link
          href="/"
          aria-label="Back to home"
          className="absolute top-5 right-5 grid size-10 place-items-center rounded-full border"
        >
          <X aria-hidden className="size-4" />
        </Link>
        <div className="w-full max-w-[420px]">{children}</div>
      </main>
    </div>
  );
}
