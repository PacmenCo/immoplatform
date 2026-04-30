import { ZodError } from "zod";

/**
 * Flatten a ZodError into the per-field shape consumed by `ActionResult`:
 * a single banner message + a `{ fieldName: message }` map keyed by the
 * first path segment (camelCase, matching the schema field name).
 *
 * - Issues with an empty path become the `topLevel` (a refine on the root
 *   object, or a transform that throws). The first such message wins.
 * - Issues with a path use `path[0]` as the key (we ignore deeper paths
 *   for now — none of our schemas nest user-facing fields).
 * - Multiple issues on the same field keep the FIRST. Zod refinements
 *   rarely stack meaningfully on a single input and showing two messages
 *   inline is noisy.
 */
export function flattenZodErrors(error: ZodError): {
  topLevel: string;
  fields: Record<string, string>;
} {
  const fields: Record<string, string> = {};
  let topLevel = "";

  for (const issue of error.issues) {
    if (issue.path.length === 0) {
      if (!topLevel) topLevel = issue.message;
      continue;
    }
    const key = String(issue.path[0]);
    if (!(key in fields)) fields[key] = issue.message;
  }

  // Fallback when every issue is per-field — give callers a banner copy
  // they can surface without reaching into the map.
  if (!topLevel) {
    const count = Object.keys(fields).length;
    if (count > 0) {
      topLevel =
        count === 1
          ? "Check the highlighted field."
          : `Check the ${count} highlighted fields.`;
    }
  }

  return { topLevel, fields };
}
