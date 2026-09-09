CREATE TABLE `file_shares` (
	`slug` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`downloads_remaining` integer NOT NULL,
	`uploaded_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
