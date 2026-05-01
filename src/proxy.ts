import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

// Wrap next-intl's middleware to append `Vary: Accept-Language, Cookie` to
// every response. We negotiate locale on first hit (Accept-Language header)
// and persist via the `NEXT_LOCALE` cookie — caches must key on both, or a
// French browser hitting a CDN node warmed with `/nl` will get the wrong
// language. `append` (not `set`) preserves any Vary already on the response,
// e.g. ones added by route-level `unstable_after` or downstream edge logic.
export default function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  response.headers.append("Vary", "Accept-Language");
  response.headers.append("Vary", "Cookie");
  return response;
}

export const config = {
  // Skip API, server actions, Next internals, public assets, and route-handler
  // outputs (manifest, sitemap, robots, opengraph-image, favicon). Everything
  // else is page-shaped and gets locale-prefixed.
  matcher: [
    "/((?!api|_next|_vercel|.*\\..*|manifest\\.webmanifest|sitemap\\.xml|robots\\.txt|opengraph-image|favicon\\.ico).*)",
  ],
};
