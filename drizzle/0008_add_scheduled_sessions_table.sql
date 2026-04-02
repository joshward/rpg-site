CREATE TABLE "scheduled_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"game_id" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"day" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scheduled_sessions_guildId_year_month_day_unique" UNIQUE("guild_id","year","month","day")
);
--> statement-breakpoint
ALTER TABLE "scheduled_sessions" ADD CONSTRAINT "scheduled_sessions_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_sessions" ADD CONSTRAINT "scheduled_sessions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;