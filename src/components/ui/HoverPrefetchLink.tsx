"use client";

import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * `<Link>` that disables Next.js's default viewport prefetch and instead
 * prefetches on hover or keyboard focus. Use on pages that render many
 * sibling links pointing at query-string variants (period pickers, faceted
 * filters) — the default would prefetch every variant as soon as the list
 * enters the viewport.
 */
export function HoverPrefetchLink({
  href,
  ...rest
}: ComponentProps<typeof Link>) {
  const router = useRouter();
  const target = typeof href === "string" ? href : href?.toString() ?? "";
  return (
    <Link
      {...rest}
      href={href}
      prefetch={false}
      onMouseEnter={() => router.prefetch(target)}
      onFocus={() => router.prefetch(target)}
    />
  );
}
