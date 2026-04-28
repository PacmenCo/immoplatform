/**
 * The logo image (wordmark PNG). Use this anywhere the brand mark stands
 * alone in chrome — site nav, footer, dashboard sidebar, mobile topbar,
 * auth shell, onboarding headers. Centralized so swapping the image is a
 * single-file change.
 *
 * For the brand name *inline within prose*, use `<BrandName />` instead —
 * it renders as a styled span that flows with surrounding text.
 *
 * The intrinsic ratio (998:250 ≈ 4:1) is preserved by `w-auto`. Pick the
 * height with a Tailwind class via `className` — common values:
 *   - h-8  (32px) → mobile topbar
 *   - h-10 (40px) → dashboard sidebar, onboarding headers
 *   - h-12 (48px) → marketing nav + footer, auth shell
 */
export function BrandLogo({
  className = "h-10 w-auto",
  alt = "immoplatform.be",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src="/logo.png"
      alt={alt}
      width={998}
      height={250}
      className={className}
    />
  );
}
