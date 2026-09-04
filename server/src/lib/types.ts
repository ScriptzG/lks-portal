// SQLite (used for local dev) has no native Prisma enum support, so the schema
// stores these as plain strings. These union types are the single source of
// truth for the allowed values at the application boundary.

export type Role = "admin" | "client";
export type CompanyStatus = "active" | "inactive" | "prospect";
export type WebsiteStatus = "live" | "draft" | "pending_review";
export type DeploymentStatus = "pending" | "building" | "live" | "failed" | "rolled_back";
export type DeploymentTrigger = "admin_publish" | "client_publish" | "rollback";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled";
export type FieldType = "text" | "textarea" | "image" | "color" | "link" | "background";
export type NotificationType =
  | "invite_sent"
  | "publish_requested"
  | "deploy_succeeded"
  | "deploy_failed"
  | "payment_overdue"
  | "support_request"
  | "message_received"
  | "ticket_created"
  | "ticket_reply"
  | "general";
