import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Vitest config for the immo parity-test suite. Tests live in
// `src/__tests__/**` and run in Node so we can drive Prisma + server-only
// helpers directly. See /Users/rl/.claude/plans/mutable-meandering-meteor.md.
export default defineConfig({
  resolve: {
    // Vite 7 resolves `@/…` → `./src/…` natively from tsconfig paths.
    tsconfigPaths: true,
    alias: {
      // Next.js provides the `server-only` package at runtime to catch
      // accidental client imports of server modules. In Vitest it's just
      // a no-op — stub to an empty module so server-only files load.
      "server-only": resolve(__dirname, "src/__tests__/_helpers/server-only-stub.ts"),
      // `next/cache`'s revalidatePath reads Next's async storage (only set
      // up by the framework's request dispatcher). Integration tests call
      // server actions directly, outside any request context — so stub it
      // to a no-op. DB assertions don't need cache invalidation anyway.
      "next/cache": resolve(__dirname, "src/__tests__/_helpers/next-cache-stub.ts"),
      // `next/headers`: in-memory cookie jar + Headers. Lets actions that
      // read the IP via `headers()` or write the session cookie via
      // `cookies()` run to completion. Tests import the __reset* helpers
      // to isolate state between runs.
      "next/headers": resolve(__dirname, "src/__tests__/_helpers/next-headers-stub.ts"),
      // `next/navigation`: redirect() throws a NextRedirectError that tests
      // catch to assert target URL. Without this, the raw framework redirect
      // error escapes as an ordinary Error.
      "next/navigation": resolve(__dirname, "src/__tests__/_helpers/next-navigation-stub.ts"),
      // `next-intl/server`: getLocale() reads request-scoped config that the
      // Next.js dispatcher sets up. Outside a request context (vitest), the
      // real module throws "not supported in Client Components". Stub returns
      // the routing default so locale-aware redirects in server actions work.
      "next-intl/server": resolve(__dirname, "src/__tests__/_helpers/next-intl-server-stub.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts", "src/__tests__/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
    setupFiles: ["src/__tests__/_helpers/env.ts"],
    // next-intl's runtime imports `next/navigation`; without inlining, Vite
    // doesn't transform that transitive import and the `next/navigation`
    // alias above (→ stub) doesn't apply, so the actual `next/navigation`
    // is loaded via Node ESM and fails resolution. Inlining forces Vite to
    // transform next-intl, which propagates the alias.
    server: { deps: { inline: ["next-intl"] } },
    // Forks pool with one Postgres SCHEMA per worker (see env.ts +
    // _helpers/db.ts). Worker 1 lands in `public` so a serial single-fork
    // run / CI works unchanged; workers >1 use `test_wN`. Each worker
    // runs migrate deploy against its own schema on first call and
    // TRUNCATEs only its own tables between tests — cross-worker
    // isolation is total, so file-level parallelism is safe.
    pool: "forks",
  },
});
