/**
 * Very rough User-Agent parsing — good enough to tell a user which device is
 * which in the sessions list. No external dep; handles the common desktop +
 * mobile browsers and falls back to a generic label.
 *
 * If/when we need fidelity (e.g. "Chrome 139.0.6783.77" with OS minor version)
 * replace this with ua-parser-js or similar.
 */

export type DeviceLabel = {
  browser: string;
  os: string;
  label: string; // composite: "Safari on macOS"
};

const BROWSERS: Array<{ name: string; re: RegExp }> = [
  { name: "Edge",    re: /Edg\/\d/i },
  { name: "Chrome",  re: /Chrome\/\d/i },
  { name: "Firefox", re: /Firefox\/\d/i },
  { name: "Safari",  re: /Safari\/\d/i },
];

const OSES: Array<{ name: string; re: RegExp }> = [
  { name: "iOS",      re: /iPhone|iPad|iPod/i },
  { name: "macOS",    re: /Macintosh|Mac OS X/i },
  { name: "Android",  re: /Android/i },
  { name: "Windows",  re: /Windows/i },
  { name: "Linux",    re: /Linux/i },
];

export function formatUserAgent(ua: string | null | undefined): DeviceLabel {
  if (!ua || typeof ua !== "string") {
    return { browser: "Unknown browser", os: "Unknown device", label: "Unknown device" };
  }
  // Chrome UA also contains "Safari/..." — test Chrome first.
  const browser = BROWSERS.find((b) => b.re.test(ua))?.name ?? "Unknown browser";
  const os = OSES.find((o) => o.re.test(ua))?.name ?? "Unknown OS";
  return { browser, os, label: `${browser} on ${os}` };
}
