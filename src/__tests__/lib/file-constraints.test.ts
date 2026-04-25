import { describe, expect, it } from "vitest";
import { magicBytesValid } from "@/lib/file-constraints";

// Magic-byte sniffing defends against polyglot uploads — a payload with the
// allowed MIME header but a body of a different type. Without this, an HTML
// file declared as `application/pdf` passes the MIME allowlist and lands in
// storage; a future inline-render or sniffing viewer turns it into XSS.

describe("magicBytesValid — application/pdf", () => {
  it("accepts a buffer starting with %PDF", () => {
    const bytes = new TextEncoder().encode("%PDF-1.4\nfoo");
    expect(magicBytesValid(bytes, "application/pdf")).toBe(true);
  });

  it("accepts %PDF that appears within the first 1024 bytes (PDF spec allows leading garbage)", () => {
    const garbage = new Uint8Array(500).fill(0x20);
    const pdf = new TextEncoder().encode("%PDF-1.4");
    const combined = new Uint8Array(garbage.length + pdf.length);
    combined.set(garbage, 0);
    combined.set(pdf, garbage.length);
    expect(magicBytesValid(combined, "application/pdf")).toBe(true);
  });

  it("rejects a body that's actually HTML", () => {
    const bytes = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    expect(magicBytesValid(bytes, "application/pdf")).toBe(false);
  });

  it("rejects a body that has %PDF only past the 1024-byte window", () => {
    const garbage = new Uint8Array(1100).fill(0x20);
    const pdf = new TextEncoder().encode("%PDF-1.4");
    const combined = new Uint8Array(garbage.length + pdf.length);
    combined.set(garbage, 0);
    combined.set(pdf, garbage.length);
    expect(magicBytesValid(combined, "application/pdf")).toBe(false);
  });

  it("rejects an empty buffer", () => {
    expect(magicBytesValid(new Uint8Array(), "application/pdf")).toBe(false);
  });
});

describe("magicBytesValid — image MIMEs", () => {
  it("accepts a JPEG with FFD8FF prefix", () => {
    expect(magicBytesValid(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")).toBe(true);
  });

  it("rejects a JPEG-claimed body that doesn't start with FFD8FF", () => {
    expect(magicBytesValid(new Uint8Array([0x00, 0x00, 0x00]), "image/jpeg")).toBe(false);
  });

  it("accepts a PNG with the 8-byte signature", () => {
    expect(
      magicBytesValid(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png",
      ),
    ).toBe(true);
  });

  it("rejects a PNG signature that's missing the trailing bytes", () => {
    expect(
      magicBytesValid(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/png"),
    ).toBe(false);
  });

  it("accepts a WebP with RIFF....WEBP layout", () => {
    const bytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x12, 0x34, 0x56, 0x78, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(magicBytesValid(bytes, "image/webp")).toBe(true);
  });

  it("rejects a RIFF container that isn't WEBP", () => {
    const bytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x12, 0x34, 0x56, 0x78, 0x41, 0x56, 0x49, 0x20,
    ]);
    expect(magicBytesValid(bytes, "image/webp")).toBe(false);
  });
});

describe("magicBytesValid — case + unknown MIMEs", () => {
  it("normalizes MIME case (caller may pass mixed case)", () => {
    const pdf = new TextEncoder().encode("%PDF-1.4");
    expect(magicBytesValid(pdf, "Application/PDF")).toBe(true);
  });

  it("returns true for an unknown MIME — allowlist already gates which mimes reach this check", () => {
    expect(magicBytesValid(new Uint8Array([0x00]), "application/octet-stream")).toBe(true);
  });
});
