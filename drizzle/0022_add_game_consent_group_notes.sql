CREATE TABLE "game_consent_group_notes" (
	"game_id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_consent_group_notes_revision_check" CHECK ("game_consent_group_notes"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "game_consent_topic_group_notes" (
	"game_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_consent_topic_group_notes_game_id_topic_id_pk" PRIMARY KEY("game_id","topic_id"),
	CONSTRAINT "game_consent_topic_group_notes_revision_check" CHECK ("game_consent_topic_group_notes"."revision" > 0)
);
--> statement-breakpoint
-- Referenced composite key must exist before adding the same-guild foreign keys.
ALTER TABLE "games" ADD CONSTRAINT "games_guild_id_id_unique" UNIQUE("guild_id","id");--> statement-breakpoint
ALTER TABLE "game_consent_group_notes" ADD CONSTRAINT "game_consent_group_notes_game_same_guild_fk" FOREIGN KEY ("guild_id","game_id") REFERENCES "public"."games"("guild_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_consent_topic_group_notes" ADD CONSTRAINT "game_consent_topic_notes_game_same_guild_fk" FOREIGN KEY ("guild_id","game_id") REFERENCES "public"."games"("guild_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_consent_topic_group_notes" ADD CONSTRAINT "game_consent_topic_notes_topic_same_guild_fk" FOREIGN KEY ("guild_id","topic_id") REFERENCES "public"."consent_topics"("guild_id","id") ON DELETE cascade ON UPDATE no action;