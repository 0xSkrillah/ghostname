/**
 * Content-Security-Policy for the production build.
 *
 * GhostName ships as static files (GitHub Pages, Swarm) where no HTTP headers
 * can be set, so the policy travels in a <meta> tag injected at build time.
 * It is deliberately not applied in `vite dev`, where the React refresh
 * preamble is an inline script and HMR uses a websocket.
 *
 * - script-src 'self': only the hashed bundles; no inline, no eval, no CDN.
 * - style-src needs 'unsafe-inline' for React style attributes only.
 * - connect-src https: covers user-pinned RPC endpoints, public RPC defaults
 *   and the Mobula endpoint without enumerating hosts that users may change.
 * - object-src 'none', base-uri 'self', form-action 'none': no plugins, no
 *   base hijacking, no form exfiltration.
 */
export const CSP_DIRECTIVES: Record<string, string> = {
  'default-src': "'self'",
  'script-src': "'self'",
  'style-src': "'self' 'unsafe-inline'",
  'img-src': "'self' data:",
  'font-src': "'self'",
  'connect-src': 'https:',
  'object-src': "'none'",
  'base-uri': "'self'",
  'form-action': "'none'",
  'upgrade-insecure-requests': '',
};

export const CSP_POLICY = Object.entries(CSP_DIRECTIVES)
  .map(([directive, value]) => (value ? `${directive} ${value}` : directive))
  .join('; ');

/** The tag injected into dist/index.html. */
export function cspMetaTag(): string {
  return `<meta http-equiv="Content-Security-Policy" content="${CSP_POLICY}" />`;
}
