import { Logo } from "@/components/app-shell/logo";

export default function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-20 max-w-4xl items-center justify-between px-5">
        <Logo />
      </header>
      <main id="main" className="mx-auto max-w-4xl px-5 pb-16">
        {children}
      </main>
    </div>
  );
}
