CREATE TABLE `config` (
	`key` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ingestion` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`at` text NOT NULL,
	`status` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`source` text NOT NULL,
	`url` text NOT NULL,
	`price_micros` integer,
	`currency` text NOT NULL,
	`condition` text NOT NULL,
	`availability` text NOT NULL,
	`verification` text NOT NULL,
	`observed_at` text,
	`data` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `listing_product` ON `listings` (`product_id`);--> statement-breakpoint
CREATE INDEX `listing_price` ON `listings` (`currency`,`price_micros`);--> statement-breakpoint
CREATE TABLE `observations` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`at` text NOT NULL,
	`price_micros` integer,
	`availability` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `observation_listing` ON `observations` (`listing_id`,`at`);--> statement-breakpoint
CREATE TABLE `personal` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_categories` (
	`product_id` text NOT NULL,
	`category` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_product` ON `product_categories` (`product_id`,`category`);--> statement-breakpoint
CREATE INDEX `category_lookup` ON `product_categories` (`category`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`fingerprint` text NOT NULL,
	`brand` text NOT NULL,
	`type` text NOT NULL,
	`generation` text NOT NULL,
	`region` text NOT NULL,
	`year` integer,
	`status` text NOT NULL,
	`confidence` text NOT NULL,
	`search` text NOT NULL,
	`data` text NOT NULL,
	`added_at` text NOT NULL,
	`observed_at` text NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_identity` ON `products` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `products_type` ON `products` (`type`);--> statement-breakpoint
CREATE INDEX `products_updated` ON `products` (`observed_at`);
--> statement-breakpoint
CREATE VIRTUAL TABLE product_search USING fts5(product_id UNINDEXED, search, tokenize='unicode61');
--> statement-breakpoint
CREATE TRIGGER products_search_insert AFTER INSERT ON products BEGIN INSERT INTO product_search(product_id,search) VALUES (new.id,new.search); END;
--> statement-breakpoint
CREATE TRIGGER products_search_update AFTER UPDATE OF search ON products BEGIN DELETE FROM product_search WHERE product_id=old.id; INSERT INTO product_search(product_id,search) VALUES (new.id,new.search); END;
--> statement-breakpoint
CREATE TRIGGER products_search_delete AFTER DELETE ON products BEGIN DELETE FROM product_search WHERE product_id=old.id; END;
