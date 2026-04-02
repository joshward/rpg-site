ALTER TABLE "availability_submissions" DROP CONSTRAINT "availability_submissions_guildId_userId_year_month_unique";--> statement-breakpoint
ALTER TABLE "availability_submissions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_submissions" ADD COLUMN "discord_user_id" text;--> statement-breakpoint

UPDATE "availability_submissions"
SET "discord_user_id" = "accounts"."account_id"
FROM "accounts"
WHERE "availability_submissions"."user_id" = "accounts"."user_id"
AND "accounts"."provider_id" = 'discord';--> statement-breakpoint

DELETE FROM "availability_submissions" WHERE "discord_user_id" IS NULL;--> statement-breakpoint

ALTER TABLE "availability_submissions" ALTER COLUMN "discord_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_submissions" ADD CONSTRAINT "availability_submissions_guildId_discordUserId_year_month_unique" UNIQUE("guild_id","discord_user_id","year","month");
