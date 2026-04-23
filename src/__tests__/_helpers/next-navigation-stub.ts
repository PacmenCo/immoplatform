/**
 * Vitest shim for `next/navigation`. Real `redirect()` throws a dispatcher-
 * recognized sentinel that Next catches and converts to an HTTP 3xx; outside
 * a request context it escapes as an ordinary error. Here we rethrow a
 * named error class so tests can assert on the target URL:
 *
 *   try {
 *     await login(undefined, formData);
 *   } catch (e) {
 *     expect(e).toBeInstanceOf(NextRedirectError);
 *     expect((e as NextRedirectError).url).toBe("/dashboard");
 *   }
 *
 * Or with a custom matcher:
 *   await expect(login(...)).rejects.toBeInstanceOf(NextRedirectError);
 */

export class NextRedirectError extends Error {
  readonly digest = "NEXT_REDIRECT";
  constructor(public readonly url: string) {
    super(`NEXT_REDIRECT: ${url}`);
    this.name = "NextRedirectError";
  }
}

export class NextNotFoundError extends Error {
  readonly digest = "NEXT_NOT_FOUND";
  constructor() {
    super("NEXT_NOT_FOUND");
    this.name = "NextNotFoundError";
  }
}

export function redirect(url: string): never {
  throw new NextRedirectError(url);
}

export function permanentRedirect(url: string): never {
  throw new NextRedirectError(url);
}

export function notFound(): never {
  throw new NextNotFoundError();
}

/**
 * Run a function that's expected to end with `redirect(url)` and return the
 * target URL. Rethrows anything that isn't a NextRedirectError so real
 * errors surface. Use in tests like:
 *
 *   const url = await captureRedirect(() => login(undefined, form));
 *   expect(url).toBe("/dashboard");
 */
export async function captureRedirect(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof NextRedirectError) return e.url;
    throw e;
  }
  throw new Error("Expected redirect, but function returned normally.");
}
