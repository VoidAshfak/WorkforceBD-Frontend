import type {
  AvailabilityDay,
  AvailabilitySlot,
  Gender,
} from "@/lib/validation/worker";

/**
 * Presentation metadata for the worker onboarding wizard. Kept apart from the
 * API contract so copy/emoji can change freely without touching validation or
 * network code. Values must still match the API's accepted enums.
 */

export const GENDER_OPTIONS: { value: Gender; label: string; emoji: string }[] = [
  { value: "male", label: "Male", emoji: "👨" },
  { value: "female", label: "Female", emoji: "👩" },
  { value: "other", label: "Other", emoji: "🌈" },
  { value: "prefer_not_to_say", label: "Rather not say", emoji: "🤐" },
];

export const DAY_OPTIONS: {
  value: AvailabilityDay;
  label: string;
  hint: string;
  emoji: string;
}[] = [
  { value: "weekdays", label: "Weekdays", hint: "Mon – Fri", emoji: "📅" },
  { value: "weekends", label: "Weekends", hint: "Sat – Sun", emoji: "🎉" },
];

export const SLOT_OPTIONS: {
  value: AvailabilitySlot;
  label: string;
  hint: string;
  emoji: string;
}[] = [
  { value: "morning", label: "Morning", hint: "6am – 12pm", emoji: "☀️" },
  { value: "evening", label: "Evening", hint: "12pm – 8pm", emoji: "🌇" },
  { value: "night", label: "Night", hint: "8pm – 2am", emoji: "🌙" },
];

/* ----------------------------- Business --------------------------------- */

/** Common BD business types (free-text values; the API stores the string). */
export const BUSINESS_TYPE_OPTIONS: { value: string; label: string; emoji: string }[] = [
  { value: "Restaurant & Cafe", label: "Restaurant & Cafe", emoji: "🍽️" },
  { value: "Events & Wedding", label: "Events & Wedding", emoji: "🎉" },
  { value: "Hotel & Hospitality", label: "Hotel", emoji: "🏨" },
  { value: "Retail & Shop", label: "Retail", emoji: "🛍️" },
  { value: "Corporate & Office", label: "Corporate", emoji: "🏢" },
  { value: "Other", label: "Other", emoji: "✨" },
];

/** Perk/attire toggles a business advertises to workers (step 3). */
export const BUSINESS_PERK_OPTIONS: {
  key: "meal_included" | "transport_support" | "female_friendly" | "uniform_required";
  label: string;
  hint: string;
  emoji: string;
}[] = [
  { key: "meal_included", label: "Meal included", hint: "You provide food on shift", emoji: "🍽️" },
  { key: "transport_support", label: "Transport support", hint: "You help with travel", emoji: "🚌" },
  { key: "female_friendly", label: "Female friendly", hint: "Safe, welcoming for women", emoji: "💜" },
  { key: "uniform_required", label: "Uniform required", hint: "Workers wear a dress code", emoji: "👔" },
];

/** Picks a playful emoji for a skill by keyword, with a safe default. */
export function skillEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("bar")) return "🍸";
  if (n.includes("waiter") || n.includes("food")) return "🍽️";
  if (n.includes("promot") || n.includes("activation")) return "📣";
  if (n.includes("event")) return "🎪";
  if (n.includes("production")) return "🎬";
  if (n.includes("clean") || n.includes("support")) return "🧹";
  if (n.includes("security")) return "🛡️";
  if (n.includes("reception") || n.includes("host")) return "🛎️";
  return "⭐";
}
