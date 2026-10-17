"use client";

import { Camera, ChevronRight, LogOut, Settings2, Trash2, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PlayButton } from "@/components/session/play-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { authClient } from "@/lib/auth-client";
import { hourLabel, LANGUAGES } from "@/lib/languages";
import { LEVEL_LABELS } from "@/lib/levels";
import { deleteAccount, updateProfile } from "@/server/actions/profile";

type ProfileUser = {
  name: string;
  email: string;
  image: string | null;
  level: keyof typeof LEVEL_LABELS | null;
  motherTongue: string | null;
  timeZone: string;
  voiceId: string | null;
  theme: "light" | "dark" | "system";
  rankingVisible: boolean;
  remindersEnabled: boolean;
  reminderHour: number;
  createdAt: Date;
  role: string;
};

const control = "bg-card h-11 rounded-xl border px-3 text-sm";

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4 first:border-t-0">
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        {value ? <p className="font-bold">{value}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function ProfileView({
  user,
  voices,
  previewRef,
}: {
  user: ProfileUser;
  voices: { id: string; label: string }[];
  previewRef: string | null;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [u, setU] = useState(user);
  const [image, setImage] = useState(user.image);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const timeZones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [u.timeZone];
    }
  }, [u.timeZone]);

  async function save(patch: Partial<ProfileUser> & { displayName?: string }) {
    const prev = u;
    setU({ ...u, ...patch, ...(patch.displayName ? { name: patch.displayName } : {}) });
    const r = await updateProfile(patch);
    if (!r.ok) {
      setU(prev);
      return toast.error(r.error.message);
    }
    toast.success("Saved");
    router.refresh();
  }

  async function upload(file: File) {
    setUploading(true);
    const form = new FormData();
    form.set("image", file);
    const res = await fetch("/api/profile/avatar", { method: "POST", body: form });
    const body = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) return toast.error(body?.error?.message ?? "Upload failed.");
    setImage(body.imageUrl);
    toast.success("Picture updated");
    router.refresh();
  }

  const initials = u.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const level = u.level ? `${u.level} · ${LEVEL_LABELS[u.level]}` : "Not set";

  return (
    <div>
      <p className="text-eyebrow text-xs font-bold tracking-[1.7px] uppercase">Your space</p>
      <h1 className="mt-1 text-[34px] leading-tight tracking-[-1px]">Profile &amp; preferences</h1>
      <p className="text-muted-foreground mt-1">
        Keep your learning experience feeling like yours.
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-[264px_1fr]">
        <section
          aria-label="Your profile"
          className="bg-coach text-snow self-start rounded-[20px] p-6 text-center"
        >
          <div className="relative mx-auto w-fit">
            <Avatar className="size-24">
              {image ? <AvatarImage src={image} alt="" /> : null}
              <AvatarFallback className="bg-sky text-ink text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Change profile picture"
              className="bg-primary text-primary-foreground absolute right-0 bottom-0 grid size-8 place-items-center rounded-full border-2 border-[var(--coach)]"
            >
              <Camera aria-hidden className="size-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Profile picture file"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </div>
          <p className="mt-4 text-lg">{u.name}</p>
          <p className="text-coach-foreground text-sm break-all">{u.email}</p>
          <p className="bg-white/10 text-mint mx-auto mt-3 w-fit rounded-full px-3 py-1 text-xs font-bold">
            {level}
          </p>
          <div className="mt-6 border-t border-white/15 pt-4">
            <p className="text-coach-foreground text-[10px] tracking-[1.3px] uppercase">
              Member since
            </p>
            <p className="font-bold">
              {new Date(u.createdAt).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </section>

        <div className="grid gap-5">
          <section aria-labelledby="learning-title" className="bg-card rounded-[20px] border">
            <header className="flex items-center gap-3 border-b px-6 py-5">
              <span className="bg-nav-active grid size-10 place-items-center rounded-xl">
                <User aria-hidden className="size-5" />
              </span>
              <div>
                <h2 id="learning-title" className="text-xl">
                  Learning profile
                </h2>
                <p className="text-muted-foreground text-xs">
                  Used to personalize your daily chunks.
                </p>
              </div>
            </header>
            <Row label="Display name" value={u.name}>
              <input
                aria-label="Display name"
                defaultValue={u.name}
                maxLength={40}
                className={control}
                onBlur={(e) =>
                  e.target.value.trim() &&
                  e.target.value.trim() !== u.name &&
                  save({ displayName: e.target.value.trim() })
                }
              />
            </Row>
            <Row label="English level" value={level}>
              <Link href="/onboarding/level" className="text-sm font-bold">
                Change <ChevronRight aria-hidden className="inline size-4" />
              </Link>
            </Row>
            <Row label="Plan" value="Plan & billing">
              <Link href="/billing" className="text-sm font-bold">
                View <ChevronRight aria-hidden className="inline size-4" />
              </Link>
            </Row>
            <Row label="Mother tongue">
              <select
                aria-label="Mother tongue"
                className={control}
                value={u.motherTongue ?? ""}
                onChange={(e) => save({ motherTongue: e.target.value || null })}
              >
                <option value="">Not set</option>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Row>
          </section>

          <section aria-labelledby="prefs-title" className="bg-card rounded-[20px] border">
            <header className="flex items-center gap-3 border-b px-6 py-5">
              <span className="bg-nav-active grid size-10 place-items-center rounded-xl">
                <Settings2 aria-hidden className="size-5" />
              </span>
              <div>
                <h2 id="prefs-title" className="text-xl">
                  Practice preferences
                </h2>
                <p className="text-muted-foreground text-xs">Set up your ideal daily routine.</p>
              </div>
            </header>
            <Row
              label="Daily reminder email"
              value={u.remindersEnabled ? hourLabel(u.reminderHour) : "Off"}
            >
              <div className="flex items-center gap-3">
                <select
                  aria-label="Reminder time"
                  className={control}
                  value={u.reminderHour}
                  disabled={!u.remindersEnabled}
                  onChange={(e) => save({ reminderHour: Number(e.target.value) })}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </select>
                <Switch
                  aria-label="Daily reminder email"
                  checked={u.remindersEnabled}
                  onCheckedChange={(v) => save({ remindersEnabled: v })}
                />
              </div>
            </Row>
            <Row label="Audio voice" value="American English">
              <div className="flex items-center gap-3">
                {previewRef && u.voiceId ? (
                  <PlayButton
                    key={u.voiceId}
                    audioRef={previewRef}
                    voice={u.voiceId}
                    label="Preview voice"
                    showLabel={false}
                  />
                ) : null}
                <select
                  aria-label="Audio voice"
                  className={control}
                  value={u.voiceId ?? voices[0]?.id}
                  onChange={(e) => save({ voiceId: e.target.value })}
                >
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </Row>
            <Row label="Appearance">
              <select
                aria-label="Appearance"
                className={control}
                value={u.theme}
                onChange={(e) => {
                  const theme = e.target.value as ProfileUser["theme"];
                  setTheme(theme);
                  save({ theme });
                }}
              >
                <option value="system">Match my device</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </Row>
            <Row
              label="Show me in the public ranking"
              value={u.rankingVisible ? "Visible" : "Hidden"}
            >
              <Switch
                aria-label="Show me in the public ranking"
                checked={u.rankingVisible}
                onCheckedChange={(v) => save({ rankingVisible: v })}
              />
            </Row>
            <Row label="Time zone" value={u.timeZone}>
              <select
                aria-label="Time zone"
                className={`${control} max-w-56`}
                value={u.timeZone}
                onChange={(e) => save({ timeZone: e.target.value })}
              >
                {timeZones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </Row>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className="text-destructive inline-flex items-center gap-2 font-bold"
              onClick={async () => {
                await authClient.signOut();
                router.push("/sign-in");
                router.refresh();
              }}
            >
              <LogOut aria-hidden className="size-4" /> Log out
            </button>
            {u.role === "admin" ? (
              <Link href="/admin" className="bg-card rounded-xl border px-4 py-2 text-sm font-bold">
                Open admin console
              </Link>
            ) : null}
          </div>

          <DeleteAccount />
        </div>
      </div>
    </div>
  );
}

function DeleteAccount() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <section
      aria-labelledby="danger-title"
      className="border-destructive/40 rounded-[20px] border p-6"
    >
      <h2 id="danger-title" className="text-lg">
        Delete account
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        This erases your profile, picture, sentences, scores and points right away. It can&apos;t be
        undone.
      </p>
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className="text-destructive border-destructive mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-bold"
          >
            <Trash2 aria-hidden className="size-4" /> Delete my account
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Everything is erased immediately. Type DELETE to confirm.
            </DialogDescription>
          </DialogHeader>
          <input
            aria-label="Type DELETE to confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={control}
            autoComplete="off"
          />
          <DialogFooter>
            <DialogClose asChild>
              <button type="button" className="bg-card min-h-11 rounded-xl border px-4 font-bold">
                Keep my account
              </button>
            </DialogClose>
            <button
              type="button"
              disabled={confirm !== "DELETE" || pending}
              className="bg-destructive min-h-11 rounded-xl px-4 font-bold text-white disabled:opacity-50"
              onClick={async () => {
                setPending(true);
                const r = await deleteAccount(confirm);
                setPending(false);
                if (!r.ok) return toast.error(r.error.message);
                router.push("/?deleted=1");
                router.refresh();
              }}
            >
              Delete forever
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
