/**
 * Provider-agnostic event payload — produced once by `buildEventPayload`,
 * consumed by the Google + Outlook service impls. Each provider translates
 * into its own REST shape (colorId for Google, `MessageStream` / Windows
 * timezone for Outlook). Keep this type free of SDK types so the payload
 * builder stays pure + unit-testable.
 */
export type EventPayload = {
  title: string;
  descriptionHtml: string;
  location: string;
  start: Date;
  end: Date;
  /** IANA zone (e.g. "Europe/Brussels"). Providers map as needed. */
  timeZone: string;
  /** Minutes before start for the first popup reminder. */
  reminderMinutes: number;
};

export type CalendarAction = "create" | "update" | "cancel";

export type CalendarProvider = "google" | "outlook";
