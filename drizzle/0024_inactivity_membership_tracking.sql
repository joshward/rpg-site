CREATE TABLE "inactivity_guild_tracking" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"initialized_at" timestamp NOT NULL,
	"schedule_fallback_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "inactivity_member_tracking" (
	"guild_id" text NOT NULL,
	"discord_user_id" text NOT NULL,
	"first_eligible_at" timestamp NOT NULL,
	"addition_source" text NOT NULL,
	"first_observed_at" timestamp NOT NULL,
	"last_observed_at" timestamp NOT NULL,
	"has_access" boolean NOT NULL,
	"access_since" timestamp NOT NULL,
	"discord_joined_at" text,
	CONSTRAINT "inactivity_member_tracking_guild_id_discord_user_id_pk" PRIMARY KEY("guild_id","discord_user_id")
);
--> statement-breakpoint
ALTER TABLE "inactivity_guild_tracking" ADD CONSTRAINT "inactivity_guild_tracking_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inactivity_member_tracking" ADD CONSTRAINT "inactivity_member_tracking_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;