import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/app-shell/logo";

/** Plain, readable layout for /privacy and /terms. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Logo />
        <Link href="/" className="text-sm font-bold">
          Home
        </Link>
      </header>
      <main
        id="main"
        className="mx-auto max-w-3xl px-5 pb-16 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6"
      >
        <h1 className="text-[34px] leading-tight tracking-[-1px]">{title}</h1>
        <p className="text-muted-foreground text-sm">Last updated: {updated}</p>
        {children}
      </main>
      <LegalFooter />
    </div>
  );
}

export function LegalFooter() {
  return (
    <footer className="text-muted-foreground mx-auto flex max-w-6xl flex-wrap gap-x-4 gap-y-1 px-5 py-8 text-sm">
      <span>© EnglishChunks.guru · For learners aged 16 and over · Built with open-source AI</span>
      <Link href="/privacy">Privacy</Link>
      <Link href="/terms">Terms</Link>
    </footer>
  );
}
