CREATE TABLE "consent_checklists" (
	"guild_id" text NOT NULL,
	"discord_user_id" text NOT NULL,
	"overall_note" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "consent_checklists_guild_id_discord_user_id_pk" PRIMARY KEY("guild_id","discord_user_id")
);
--> statement-breakpoint
CREATE TABLE "consent_responses" (
	"guild_id" text NOT NULL,
	"discord_user_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"answer" text,
	"heads_up" boolean DEFAULT false NOT NULL,
	"note" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "consent_responses_guild_id_discord_user_id_topic_id_pk" PRIMARY KEY("guild_id","discord_user_id","topic_id"),
	CONSTRAINT "consent_responses_answer_check" CHECK ("consent_responses"."answer" IS NULL OR "consent_responses"."answer" IN ('enthusiastic', 'veil', 'line')),
	CONSTRAINT "consent_responses_heads_up_check" CHECK (NOT "consent_responses"."heads_up" OR ("consent_responses"."answer" IS NOT NULL AND "consent_responses"."answer" IN ('enthusiastic', 'veil')))
);
--> statement-breakpoint
ALTER TABLE "consent_checklists" ADD CONSTRAINT "consent_checklists_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_responses" ADD CONSTRAINT "consent_responses_topic_same_guild_fk" FOREIGN KEY ("guild_id","topic_id") REFERENCES "public"."consent_topics"("guild_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_responses_guild_topic_idx" ON "consent_responses" USING btree ("guild_id","topic_id");