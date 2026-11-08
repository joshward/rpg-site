CREATE TABLE "inactivity_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"discord_user_id" text NOT NULL,
	"original_added_at" timestamp NOT NULL,
	"reliable_from" integer NOT NULL,
	"reliable_through" integer NOT NULL,
	"discord_joined_at" text NOT NULL,
	"evidence" text NOT NULL,
	"reviewed_by" text NOT NULL,
	"reviewed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "availability_submissions" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "availability_submissions" ADD COLUMN "completion_source" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "inactivity_threshold" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "inactivity_reviews" ADD CONSTRAINT "inactivity_reviews_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;