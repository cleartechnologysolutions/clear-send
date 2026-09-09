import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const fileShares = sqliteTable("file_shares", {
  slug: text("slug").primaryKey(),
  objectKey: text("object_key").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  fileSize: integer("file_size").notNull(),
  downloadsRemaining: integer("downloads_remaining").notNull(),
  uploadedAt: integer("uploaded_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});
