// GENERATED — do not edit. Run `npm run i18n:codegen`.
//
// Augments `use-intl`'s `AppConfig` so every `t('ns.key')` lookup is
// compile-checked against the EN source-of-truth catalog. Adding a new
// namespace is just `messages/en/<ns>.json` + re-running codegen — both
// the runtime `NAMESPACES` array (in `src/i18n/_generated/namespaces.ts`)
// and this type augmentation are derived from the same glob. The `Locale`
// union is derived from `src/i18n/routing.ts` — adding a locale there
// flows here on the next codegen run.

import type authMessages from "../../messages/en/auth.json";
import type calendarMessages from "../../messages/en/calendar.json";
import type commonMessages from "../../messages/en/common.json";
import type dashboardMessages from "../../messages/en/dashboard.json";
import type emailsMessages from "../../messages/en/emails.json";
import type errorsMessages from "../../messages/en/errors.json";
import type homeMessages from "../../messages/en/home.json";
import type legalMessages from "../../messages/en/legal.json";
import type servicesMessages from "../../messages/en/services.json";

declare module "use-intl" {
  interface AppConfig {
    Messages: {
    auth: typeof authMessages;
    calendar: typeof calendarMessages;
    common: typeof commonMessages;
    dashboard: typeof dashboardMessages;
    emails: typeof emailsMessages;
    errors: typeof errorsMessages;
    home: typeof homeMessages;
    legal: typeof legalMessages;
    services: typeof servicesMessages;
    };
    Locale: "en" | "nl-BE";
  }
}
