CREATE TABLE "availability_days" (
	"id" text PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"day" integer NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "availability_days_submissionId_day_unique" UNIQUE("submission_id","day")
);
--> statement-breakpoint
CREATE TABLE "availability_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "availability_submissions_guildId_userId_year_month_unique" UNIQUE("guild_id","user_id","year","month")
);
--> statement-breakpoint
ALTER TABLE "availability_days" ADD CONSTRAINT "availability_days_submission_id_availability_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."availability_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_submissions" ADD CONSTRAINT "availability_submissions_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_submissions" ADD CONSTRAINT "availability_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;