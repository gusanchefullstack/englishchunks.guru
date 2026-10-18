import { Headphones, Mic, PenLine, Volume2 } from "lucide-react";

/**
 * Landing video (FR-070). NEXT_PUBLIC_LANDING_VIDEO_URL points at the MP4 on the Spaces CDN;
 * NEXT_PUBLIC_LANDING_VIDEO_CAPTIONS (WebVTT, required for WCAG) and _POSTER are served from
 * /public on our own origin — a cross-origin <track> would need CORS. Without a URL, a static
 * walkthrough of the session is shown.
 */
export function IntroVideo() {
  const src = process.env.NEXT_PUBLIC_LANDING_VIDEO_URL;
  const captions = process.env.NEXT_PUBLIC_LANDING_VIDEO_CAPTIONS;
  const poster = process.env.NEXT_PUBLIC_LANDING_VIDEO_POSTER;
  if (src) {
    return (
      <video
        controls
        playsInline
        preload="metadata"
        poster={poster}
        className="aspect-video w-full rounded-[20px] border bg-black"
        aria-label="How EnglishChunks.guru works"
      >
        <source src={src} />
        {captions ? (
          <track kind="captions" src={captions} srcLang="en" label="English" default />
        ) : null}
      </video>
    );
  }
  const steps = [
    { icon: Headphones, title: "Learn", text: "Hear the chunk and three real examples." },
    { icon: Mic, title: "Speak twice", text: "Get a score and a tip on the sounds to fix." },
    { icon: PenLine, title: "Write", text: "Use it in your own sentences — we polish them." },
    { icon: Volume2, title: "Read aloud", text: "Say your sentences and see today's score." },
  ];
  return (
    <ol
      className="bg-coach text-snow grid gap-4 rounded-[20px] p-6 sm:grid-cols-2"
      aria-label="How a daily session works"
    >
      {steps.map(({ icon: Icon, title, text }, i) => (
        <li key={title} className="rounded-2xl border border-white/10 p-5">
          <Icon aria-hidden className="text-mint size-6" />
          <p className="mt-3 font-bold">
            {i + 1}. {title}
          </p>
          <p className="text-coach-foreground mt-1 text-sm">{text}</p>
        </li>
      ))}
    </ol>
  );
}
