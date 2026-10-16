import Image from "next/image";
import Link from "next/link";

export function Logo() {
  return (
    <Link
      href="/today"
      className="flex items-center gap-2 rounded-lg"
      aria-label="EnglishChunks.guru home"
    >
      <Image src="/logo-mark.svg" alt="" width={36} height={36} priority />
      <span className="text-[17px] leading-none font-bold tracking-tight">
        englishchunks<span className="text-brand-link text-[11px]">.guru</span>
      </span>
    </Link>
  );
}
