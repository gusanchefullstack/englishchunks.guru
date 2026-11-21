import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
// Signed R2 URLs are virtual-hosted: https://<bucket>.<account>.r2.cloudflarestorage.com/<key>
const r2 =
  process.env.R2_BUCKET && process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_BUCKET}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : "";
if (!isDev && process.env.npm_lifecycle_event === "build" && !r2) {
  console.warn(
    "⚠ R2_BUCKET / R2_ACCOUNT_ID not set at build time: the CSP will block TTS audio and avatars. Set them in the build environment (Vercel project env).",
  );
}

/**
 * Static CSP (nonces would force every page dynamic and lose partial prerendering).
 * Audio/images come from signed URLs on our R2 bucket; Google avatars from googleusercontent.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  ["img-src 'self' data: blob:", r2, "https://lh3.googleusercontent.com"].filter(Boolean).join(" "),
  ["media-src 'self' blob:", r2].filter(Boolean).join(" "),
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Microphone only for our own pages (recording); nothing else.
  {
    key: "Permissions-Policy",
    value: "microphone=(self), camera=(), geolocation=(), payment=(), usb=()",
  },
  ...(isDev
    ? []
    : [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
