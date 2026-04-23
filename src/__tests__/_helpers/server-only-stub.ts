// Empty module. Replaces the `server-only` package inside Vitest runs so
// files that do `import "server-only"` load without error. The real package
// throws at build time if imported from a client bundle; in Node/test
// contexts we simply don't need the guard.
export {};
