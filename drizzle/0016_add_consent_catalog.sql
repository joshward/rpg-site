CREATE TABLE "consent_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"parent_topic_id" text,
	"owner_discord_user_id" text,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "consent_topics_guild_id_id_unique" UNIQUE("guild_id","id")
);
--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "consent_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "consent_guidance" text;--> statement-breakpoint
ALTER TABLE "consent_topics" ADD CONSTRAINT "consent_topics_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_topics" ADD CONSTRAINT "consent_topics_parent_same_guild_fk" FOREIGN KEY ("guild_id","parent_topic_id") REFERENCES "public"."consent_topics"("guild_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_topics_guild_idx" ON "consent_topics" USING btree ("guild_id");