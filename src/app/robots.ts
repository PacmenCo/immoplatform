import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard/",
        "/api/",
        "/onboarding/",
        "/no-access",
        "/verify-email",
        "/reset-password",
        "/forgot-password",
        "/invites/",
        "/designs/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
