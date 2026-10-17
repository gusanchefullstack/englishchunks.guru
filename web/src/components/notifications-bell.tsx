"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { markNotificationsRead } from "@/server/actions/submissions";

type Item = { id: string; message: string; createdAt: Date | string; readAt: Date | string | null };

export function NotificationsBellView({ items, unread }: { items: Item[]; unread: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(unread);
  const panelId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && count > 0) {
      setCount(0);
      await markNotificationsRead();
      router.refresh();
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
        className="hover:bg-muted relative grid size-10 place-items-center rounded-xl"
      >
        <Bell aria-hidden className="size-5" />
        {count ? (
          <span
            aria-hidden
            className="bg-destructive absolute top-1 right-1 grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white"
          >
            {count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label="Notifications"
          className="bg-popover absolute top-11 right-0 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border p-3 shadow-lg lg:right-auto lg:left-0"
        >
          {items.length ? (
            <ul className="grid gap-1">
              {items.map((n) => (
                <li key={n.id} className="rounded-lg p-2 text-sm">
                  <p>{n.message}</p>
                  <p className="text-muted-foreground text-xs">
                    {new Date(n.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground p-2 text-sm">No notifications yet.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
