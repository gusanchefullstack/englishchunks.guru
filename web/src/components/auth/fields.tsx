import { Check, Circle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/account-rules";

function Rule({ met, children }: { met: boolean; children: ReactNode }) {
  const Icon = met ? Check : Circle;
  return (
    <li className={`flex items-center gap-1.5 ${met ? "text-foreground font-medium" : ""}`}>
      <Icon aria-hidden className="size-3 shrink-0" />
      <span>
        {children}
        <span className="sr-only">{met ? " (done)" : " (not yet)"}</span>
      </span>
    </li>
  );
}

/** Live hint for a new-password field: the length rule (with a count) and what characters are allowed. */
export function PasswordHint({ length }: { length: number }) {
  return (
    <ul className="grid gap-1">
      <Rule met={length >= PASSWORD_MIN}>
        At least {PASSWORD_MIN} characters
        {length > 0 && length < PASSWORD_MIN ? ` (${length}/${PASSWORD_MIN})` : ""}
      </Rule>
      <li className="pl-[18px]">
        Any letters, numbers, spaces or symbols. No special characters required — a short phrase
        works well.
      </li>
    </ul>
  );
}

export const PASSWORD_ERRORS: Record<string, string> = {
  PASSWORD_TOO_SHORT: `Your password needs at least ${PASSWORD_MIN} characters.`,
  PASSWORD_TOO_LONG: `Your password can have at most ${PASSWORD_MAX} characters.`,
};

export function Field({
  label,
  id,
  hint,
  ...props
}: { label: string; id: string; hint?: ReactNode } & ComponentProps<"input">) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-bold">
        {label}
      </Label>
      <Input
        id={id}
        name={id}
        className="bg-card h-12 rounded-xl"
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      />
      {hint ? (
        <div id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export const submitBtn =
  "bg-primary text-primary-foreground inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 font-bold disabled:opacity-50";
export const outlineBtn =
  "bg-card inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border px-5 font-bold disabled:opacity-50";

export function Divider({ children }: { children: string }) {
  return (
    <div className="text-muted-foreground flex items-center gap-3 text-xs">
      <span className="bg-border h-px flex-1" />
      {children}
      <span className="bg-border h-px flex-1" />
    </div>
  );
}

export function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4">
      <path
        fill="#4285F4"
        d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6c-.3 1.4-1.1 2.5-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9C3.8 20.5 7.6 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.7 14c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7H2C1.3 8.5.9 10.2.9 12s.4 3.5 1.1 5l3.7-3z"
      />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2C17.5 2.1 15 1 12 1 7.6 1 3.8 3.5 2 7l3.7 2.9C6.6 7.3 9.1 5.4 12 5.4z"
      />
    </svg>
  );
}
