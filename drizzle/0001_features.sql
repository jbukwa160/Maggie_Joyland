CREATE TABLE `blog_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title_bg` text NOT NULL,
	`title_en` text DEFAULT '' NOT NULL,
	`excerpt_bg` text DEFAULT '' NOT NULL,
	`excerpt_en` text DEFAULT '' NOT NULL,
	`body_bg` text DEFAULT '' NOT NULL,
	`body_en` text DEFAULT '' NOT NULL,
	`cover` text DEFAULT '' NOT NULL,
	`cover_color` text DEFAULT 'pink' NOT NULL,
	`topic` text DEFAULT '' NOT NULL,
	`meta_title_bg` text DEFAULT '' NOT NULL,
	`meta_title_en` text DEFAULT '' NOT NULL,
	`meta_description_bg` text DEFAULT '' NOT NULL,
	`meta_description_en` text DEFAULT '' NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_posts_slug_unique` ON `blog_posts` (`slug`);--> statement-breakpoint
CREATE TABLE `blog_redirects` (
	`old_slug` text PRIMARY KEY NOT NULL,
	`post_id` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `blog_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`page` text DEFAULT '' NOT NULL,
	`ip` text DEFAULT '' NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`locale` text DEFAULT 'bg' NOT NULL,
	`user_id` integer,
	`status` text DEFAULT 'open' NOT NULL,
	`unread_admin` integer DEFAULT 0 NOT NULL,
	`unread_visitor` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_message_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_conversations_token_hash_unique` ON `chat_conversations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `chat_conversations_last_idx` ON `chat_conversations` (`last_message_at`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` integer NOT NULL,
	`sender` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_messages_conversation_idx` ON `chat_messages` (`conversation_id`,`id`);--> statement-breakpoint
CREATE TABLE `gift_items` (
	`section_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`section_id`, `product_id`),
	FOREIGN KEY (`section_id`) REFERENCES `gift_sections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `gift_sections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title_bg` text NOT NULL,
	`title_en` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`first_at` integer NOT NULL,
	`locked_until` integer
);
--> statement-breakpoint
CREATE TABLE `manufacturers` (
	`brand` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`eu_name` text DEFAULT '' NOT NULL,
	`eu_address` text DEFAULT '' NOT NULL,
	`eu_email` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `price_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `categories` ADD `parent_id` integer;--> statement-breakpoint
ALTER TABLE `categories` ADD `icon` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD `color` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `points_earned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `points_used` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `points_discount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `points_credited` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `age_min` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `age_max` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `age_source` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `audience` text DEFAULT 'girls' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `audience_source` text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `warnings` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `warnings_source` text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `batch` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `passport_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `original` text;--> statement-breakpoint
ALTER TABLE `products` ADD `is_custom` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `promotions` ADD `brand` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `points` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `session_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `last_login_at` integer;