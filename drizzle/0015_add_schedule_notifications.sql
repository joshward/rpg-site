CREATE TABLE "schedule_notification_sends" (
	"id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"game_id" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"schedule_fingerprint" text NOT NULL,
	"sent_by_discord_user_id" text NOT NULL,
	"outcome" text NOT NULL,
	"error" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "schedule_notification_channel_id" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "schedule_notification_channel_name" text;--> statement-breakpoint
ALTER TABLE "schedule_notification_sends" ADD CONSTRAINT "schedule_notification_sends_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_notification_sends" ADD CONSTRAINT "schedule_notification_sends_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sns_game_month_sent_at_idx" ON "schedule_notification_sends" USING btree ("game_id","year","month","sent_at");--> statement-breakpoint
CREATE INDEX "sns_guild_month_idx" ON "schedule_notification_sends" USING btree ("guild_id","year","month");