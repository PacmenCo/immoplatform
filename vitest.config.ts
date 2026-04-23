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
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts", "src/__tests__/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
    setupFiles: ["src/__tests__/_helpers/env.ts"],
    // Prisma against SQLite `file::memory:?cache=shared` shares state
    // across suites in one fork; spawning multiple forks would give each
    // its own memory DB and racy schema pushes. Keep to a single fork.
    pool: "forks",
    fileParallelism: false,
  },
});
