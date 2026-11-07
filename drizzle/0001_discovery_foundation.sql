CREATE TABLE catalog_write_guards (id TEXT PRIMARY KEY NOT NULL, valid INTEGER NOT NULL CHECK(valid=1));
--> statement-breakpoint
CREATE TABLE discovery_jobs (id TEXT PRIMARY KEY NOT NULL, source TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL, query TEXT NOT NULL, page INTEGER NOT NULL DEFAULT 1, attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, next_at TEXT, data TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX discovery_job_due ON discovery_jobs(status,next_at);
--> statement-breakpoint
CREATE INDEX discovery_job_source ON discovery_jobs(source,updated_at);
--> statement-breakpoint
CREATE UNIQUE INDEX discovery_job_one_open ON discovery_jobs(source,category) WHERE status IN ('queued','running','retry','review');
--> statement-breakpoint
CREATE TABLE source_health (id TEXT PRIMARY KEY NOT NULL, failures INTEGER NOT NULL DEFAULT 0, last_success TEXT, last_error TEXT, retry_after TEXT, data TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE match_reviews (id TEXT PRIMARY KEY NOT NULL,left_id TEXT NOT NULL,right_id TEXT NOT NULL,outcome TEXT NOT NULL,score INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',at TEXT NOT NULL,data TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX review_status ON match_reviews(status,at);
--> statement-breakpoint
CREATE INDEX listing_status ON listings(availability,verification,observed_at);
--> statement-breakpoint
CREATE INDEX product_archived_updated ON products(archived,observed_at,id);
--> statement-breakpoint
CREATE INDEX product_category_browse ON product_categories(category,product_id);
