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
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts", "src/__tests__/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
    setupFiles: ["src/__tests__/_helpers/env.ts"],
    // Tests share the `immo_test` Postgres DB and TRUNCATE between cases
    // (see `setupTestDb`). Two test files running concurrently would
    // truncate each other's seed data mid-flight. `fileParallelism: false`
    // is the user-facing knob; vitest 4 also needs `poolOptions.forks.singleFork`
    // to actually pin every file to one fork (otherwise it spawns multiple
    // forks that each receive a sequential subset, but the forks themselves
    // run in parallel against the same Postgres DB → FK violations on the
    // shared seed ids `u_admin`/`u_staff`/etc).
    pool: "forks",
    fileParallelism: false,
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
