import { AppShell } from "@/components/app-shell/app-shell";

export default function LearnerLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
