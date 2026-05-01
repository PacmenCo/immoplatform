import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Loads the request-scoped i18n config (locale, messages) for every Server
// Component render. Without this wrapper, `useTranslations` / `getTranslations`
// throw at request time because next-intl can't find the message catalog.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Freelancer lane allows 50 MB PDFs × MAX_FILES_PER_UPLOAD. Leave
      // headroom over the 20 × 50 MB = 1000 MB theoretical worst case by
      // sizing for realistic batches.
      bodySizeLimit: "250mb",
    },
  },
  // Production droplet has 1 GB RAM; tsc OOMs if run inline with `next build`.
  // Type safety is enforced via local `tsc --noEmit` + Vitest pre-deploy.
  // See CLAUDE.md "Build constraints". (Next 16 dropped the top-level `eslint`
  // config option since `next lint` was removed, so no eslint key needed.)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withNextIntl(nextConfig);
