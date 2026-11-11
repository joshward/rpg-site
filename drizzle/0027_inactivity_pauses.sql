CREATE TABLE "inactivity_pauses" (
	"guild_id" text NOT NULL,
	"discord_user_id" text NOT NULL,
	"target_month" text NOT NULL,
	"previous_sessions_per_month" integer NOT NULL,
	"paused_at" timestamp DEFAULT now() NOT NULL,
	"threshold" integer NOT NULL,
	"evidence" jsonb NOT NULL,
	"dm_status" text NOT NULL,
	"dm_finished_at" timestamp,
	CONSTRAINT "inactivity_pauses_guild_id_discord_user_id_target_month_pk" PRIMARY KEY("guild_id","discord_user_id","target_month")
);
--> statement-breakpoint
ALTER TABLE "inactivity_pauses" ADD CONSTRAINT "inactivity_pauses_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;