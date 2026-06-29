/** Notification shapes (see /docs/api-guidelines.md → Notifications). */

import type { Pagination } from "@/types/shift";

export type NotificationChannel = "in_app" | "push" | "sms";
export type NotificationPriority = "low" | "normal" | "high" | "urgent";

/**
 * `data.kind` discriminates the payload so the UI can route a tap to the right
 * screen. Unknown kinds fall through to a no-op (the feed still renders).
 */
export type NotificationKind =
  | "verification_decision"
  | "application_decision"
  | "shift_moderation"
  /** Business side: a worker applied to one of the business's shifts. */
  | "new_applicant";

export type NotificationData = {
  kind?: NotificationKind | string;
  /** application_decision: "accepted" | "rejected"; verification: "verified" | "rejected". */
  status?: string;
  shift_id?: string;
  /** new_applicant: the application that was created. */
  application_id?: string;
  [key: string]: unknown;
};

export type AppNotification = {
  id: string;
  type: NotificationChannel;
  priority: NotificationPriority;
  title: string;
  body: string;
  data: NotificationData | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

/** `GET /notifications` — paginated feed plus the live unread total. */
export type NotificationFeed = {
  items: AppNotification[];
  unread_count: number;
  pagination: Pagination;
};
