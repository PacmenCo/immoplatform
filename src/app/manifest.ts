import type { MetadataRoute } from "next";

// Next 16 serves this as /manifest.webmanifest. Keep it a pure, server-safe
// module — no client-only imports. Values here are mirrored (where relevant)
// by layout.tsx metadata/viewport exports; don't duplicate unnecessarily.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Immo — Real-estate certificates",
    short_name: "Immo",
    description:
      "EPC, asbestos, electrical and fuel-tank certification for Belgian real-estate agents. One dashboard, one invoice, one team.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    // Matches --color-brand in src/app/globals.css
    background_color: "#ffffff",
    theme_color: "#0f172a",
    lang: "en",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "New assignment",
        short_name: "New",
        description: "Create a new certificate assignment",
        url: "/dashboard/assignments/new",
        icons: [{ src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "Assignments",
        short_name: "Assignments",
        description: "View your assignments",
        url: "/dashboard/assignments",
        icons: [{ src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" }],
      },
    ],
  };
}
