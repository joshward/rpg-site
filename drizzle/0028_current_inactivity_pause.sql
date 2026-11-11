ALTER TABLE "member_preferences" ADD COLUMN "inactivity_pause_month" text;
--> statement-breakpoint
-- An old deployed app can still write preferences during rollout/rollback.
-- Never let a later voluntary save inherit an earlier automation marker.
CREATE FUNCTION clear_current_inactivity_pause() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sessions_per_month IS DISTINCT FROM 0 THEN
    NEW.inactivity_pause_month := NULL;
  ELSIF TG_OP = 'UPDATE' AND NEW.inactivity_pause_month IS NOT DISTINCT FROM OLD.inactivity_pause_month THEN
    NEW.inactivity_pause_month := NULL;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER clear_current_inactivity_pause
BEFORE INSERT OR UPDATE OF sessions_per_month, inactivity_pause_month ON member_preferences
FOR EACH ROW EXECUTE FUNCTION clear_current_inactivity_pause();