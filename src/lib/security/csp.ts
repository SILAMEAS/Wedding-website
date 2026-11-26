/**
 * Content-Security-Policy with a per-request nonce (set in src/proxy.ts).
 *
 * - script-src: nonce + strict-dynamic. No inline scripts without the nonce.
 * - style-src: 'unsafe-inline' is required because next/font, next/image and
 *   Motion write inline style="" attributes, which nonces cannot cover. Style
 *   injection is low risk compared with script injection.
 * - img/media: self + Cloudinary. frame-src: Google Maps embeds only.
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'wasm-unsafe-eval' lets the check-in scanner compile its self-hosted QR decoder
    // (WebAssembly only; does not allow JavaScript eval).
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "'wasm-unsafe-eval'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:", "https://res.cloudinary.com"],
    "media-src": ["'self'", "blob:", "https://res.cloudinary.com"],
    "font-src": ["'self'"],
    "connect-src": ["'self'"],
    "frame-src": ["https://www.google.com", "https://maps.google.com"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
  // upgrade-insecure-requests would break plain-http localhost development.
  return isDev ? policy : `${policy}; upgrade-insecure-requests`;
}

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/** Static headers applied to every response (next.config.ts). */
export function staticSecurityHeaders(isProd: boolean): { key: string; value: string }[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    // Invitation URLs contain secret tokens: never send them to other origins.
    { key: "Referrer-Policy", value: "same-origin" },
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
  ];
}
