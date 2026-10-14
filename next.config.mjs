// L8 fix: this internal staff dashboard shipped no security headers at all.
// This is a practical, not a strict/nonce-based CSP — Next.js's own hydration
// scripts need 'unsafe-inline'/'unsafe-eval' without the extra nonce-wiring
// middleware that strict-dynamic requires. Still real value: it blocks
// framing, locks connections/images/styles down to known hosts, and removes
// plugin/object embedding, on top of the app's already-clean XSS surface.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
const connectSrc = [
  "'self'",
  'https://tiles.openfreemap.org',
  supabaseUrl,
  supabaseUrl.replace(/^https:/, 'wss:'),
  apiUrl,
]
  .filter(Boolean)
  .join(' ')

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
