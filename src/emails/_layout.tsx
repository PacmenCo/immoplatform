/**
 * Shared React Email layout wrapper.
 *
 * All event templates nest inside `<EmailLayout>`. Keeps header (brand name),
 * body container, and footer consistent. Matches Platform's mail structure:
 * a single column, a title, body content, an optional CTA button, and a
 * muted footer.
 *
 * Hex colors are inlined because email clients do not support CSS custom
 * properties. Mirror values from `src/app/globals.css` (light theme).
 */

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import { useTranslations } from "next-intl";
import { appBaseUrl } from "@/lib/urls";
import { BRAND_PRIMARY, BRAND_ACCENT, BRAND_NAME } from "@/lib/site";

// Mirrors globals.css light-theme values — emails always render against the
// light surface (no dark-mode emails) so we inline the light palette.
export const BRAND_HEX = "#0f172a";          // --color-ink
export const ACCENT_HEX = "#f59e0b";          // --color-accent (amber)
export const BRAND_ON_HEX = "#ffffff";
export const MUTED_HEX = "#64748b";
export const BORDER_HEX = "#e2e8f0";

// Re-export the canonical brand name from site.ts so existing template
// imports of `BRAND_NAME` from this file keep working.
export { BRAND_NAME };

/**
 * Two-tone wordmark for inside email body prose. Mirrors `<BrandName />`
 * from the web — kept as a separate component so emails ship with inline
 * hex colors (CSS vars don't survive the @react-email/render → HTML pass).
 */
export function BrandMark({ size = 14 }: { size?: number }) {
  return (
    <span style={{ fontWeight: 700, letterSpacing: "-0.01em", fontSize: size }}>
      <span style={{ color: BRAND_HEX }}>{BRAND_PRIMARY}</span>
      <span style={{ color: ACCENT_HEX }}>{BRAND_ACCENT}</span>
    </span>
  );
}

type Props = {
  /** Short preview snippet shown in the inbox list. */
  preview: string;
  /** Optional heading rendered at the top of the body. */
  title?: string;
  children: React.ReactNode;
};

export function EmailLayout({ preview, title, children }: Props) {
  const t = useTranslations("emails.common");
  // ICU rich-text: render `{accountSettings}` as the localized link inline so
  // we don't have to chop the sentence in two and risk a translator splitting
  // the prose around a hard-coded English connector.
  const footerNode = t.rich("footerLine", {
    brand: BRAND_NAME,
    accountSettings: (chunks) => (
      <Link
        href={`${appBaseUrl()}/dashboard/settings/notifications`}
        style={footerLink}
      >
        {chunks}
      </Link>
    ),
  });
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>
              <span style={{ color: BRAND_HEX }}>{BRAND_PRIMARY}</span>
              <span style={{ color: ACCENT_HEX }}>{BRAND_ACCENT}</span>
            </Text>
          </Section>
          <Section style={content}>
            {title ? <Heading style={heading}>{title}</Heading> : null}
            {children}
          </Section>
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>{footerNode}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ─── Button ──────────────────────────────────────────────────────────
// Rendered inline (not as React Email's <Button>) so we can guarantee a
// left-aligned block that survives Outlook's weird box model. Matches
// Platform's `mail::button` → left-aligned primary button.

export function CtaButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Section style={{ marginTop: 24, marginBottom: 24 }}>
      <Link href={href} style={button}>
        {children}
      </Link>
    </Section>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const body: React.CSSProperties = {
  backgroundColor: "#f1f5f9",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: 8,
  border: `1px solid ${BORDER_HEX}`,
  margin: "32px auto",
  maxWidth: 600,
  padding: 0,
};

const header: React.CSSProperties = {
  borderBottom: `1px solid ${BORDER_HEX}`,
  padding: "20px 32px",
};

const brand: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  margin: 0,
  letterSpacing: "-0.01em",
  textTransform: "lowercase",
};

const content: React.CSSProperties = {
  padding: "24px 32px 8px",
};

const heading: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 20,
  fontWeight: 600,
  margin: "0 0 16px",
  lineHeight: 1.3,
};

const hr: React.CSSProperties = {
  borderColor: BORDER_HEX,
  margin: "24px 0 0",
};

const footer: React.CSSProperties = {
  padding: "16px 32px 24px",
};

const footerText: React.CSSProperties = {
  color: MUTED_HEX,
  fontSize: 12,
  lineHeight: 1.5,
  margin: 0,
};

const footerLink: React.CSSProperties = {
  color: MUTED_HEX,
  textDecoration: "underline",
};

const button: React.CSSProperties = {
  backgroundColor: BRAND_HEX,
  borderRadius: 6,
  color: BRAND_ON_HEX,
  display: "inline-block",
  fontSize: 14,
  fontWeight: 600,
  padding: "10px 18px",
  textDecoration: "none",
};

// ─── Shared text helpers ─────────────────────────────────────────────

export const paragraphStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 15,
  lineHeight: 1.6,
  margin: "0 0 12px",
};

export const mutedStyle: React.CSSProperties = {
  color: MUTED_HEX,
  fontSize: 14,
  lineHeight: 1.5,
  margin: "0 0 12px",
};

export function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <Text style={{ ...paragraphStyle, ...style }}>{children}</Text>;
}
