-- Backfill admin "Last active" for users from before it was tracked: the latest session or
-- practice timestamp we have. Only fills nulls, so it never overwrites live tracking.
UPDATE "user" u
SET "last_active_at" = a.last_seen
FROM (
	SELECT user_id, max(ts) AS last_seen
	FROM (
		SELECT "user_id", greatest("created_at", "updated_at") AS ts FROM "session"
		UNION ALL
		SELECT "user_id", greatest("started_at", "completed_at", "updated_at") FROM "practice_session"
	) t
	GROUP BY user_id
) a
WHERE a.user_id = u."id" AND u."last_active_at" IS NULL;
