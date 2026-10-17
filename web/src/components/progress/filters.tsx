import Link from "next/link";
import { cn } from "@/lib/utils";

/** Segmented links that update URL state (shareable, back-button friendly). */
export function Segmented({
  label,
  options,
  current,
  hrefFor,
}: {
  label: string;
  options: { value: string; label: string }[];
  current: string;
  hrefFor: (value: string) => string;
}) {
  return (
    <nav aria-label={label} className="bg-surface-subtle inline-flex rounded-xl border p-1 text-sm">
      {options.map((o) => (
        <Link
          key={o.value}
          href={hrefFor(o.value)}
          scroll={false}
          aria-current={o.value === current ? "true" : undefined}
          className={cn(
            "rounded-lg px-3 py-1.5 font-bold",
            o.value === current ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
