ALTER TABLE "availability_submissions" ADD COLUMN "write_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_submissions" ADD COLUMN "partial_write_version" integer;--> statement-breakpoint
ALTER TABLE "inactivity_guild_tracking" ADD COLUMN "last_census_started_at" timestamp;--> statement-breakpoint
-- Every row update advances the revision, including writes by a rolled-back app
-- that does not know about partial completion provenance. Equal timestamps must
-- never make an old full save look like a still-known partial edit.
CREATE FUNCTION "public"."advance_availability_submission_write_version"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.write_version := OLD.write_version + 1;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "availability_submissions_advance_write_version"
BEFORE UPDATE ON "public"."availability_submissions"
FOR EACH ROW EXECUTE FUNCTION "public"."advance_availability_submission_write_version"();