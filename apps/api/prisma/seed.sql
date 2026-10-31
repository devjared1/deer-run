-- SQL equivalent of prisma/seed.js, for running directly in the Supabase SQL Editor.
-- Safe to re-run: existing settings and tee time slots are left untouched, and events are
-- only inserted when the TournamentEvent table is empty.
--
-- IDs are generated with gen_random_uuid() because the Prisma cuid() default does not exist
-- at the database level (same approach as crypto.randomUUID() in the Pages Functions).

BEGIN;

-- Course settings
INSERT INTO "CourseSettings" (
  "id", "publicBookingDays", "memberBookingDays", "pricePerPlayerCents",
  "firstTeeTime", "lastTeeTime", "intervalMinutes"
)
VALUES ('singleton', 7, 14, 4500, '07:30', '17:00', 10)
ON CONFLICT ("id") DO NOTHING;

-- Tee time slots for the next 30 days (today + 29), from firstTeeTime to lastTeeTime
-- inclusive at intervalMinutes. "Today" is the course's local date (America/Chicago),
-- not the database's UTC date.
INSERT INTO "TeeTimeSlot" ("id", "date", "startTime", "maxPlayers", "memberOnly")
SELECT
  gen_random_uuid()::text,
  d.day,
  to_char(t.slot, 'HH24:MI'),
  4,
  false
FROM "CourseSettings" s
CROSS JOIN LATERAL (
  SELECT ((now() AT TIME ZONE 'America/Chicago')::date + n) AS day
  FROM generate_series(0, 29) AS n
) d
CROSS JOIN LATERAL generate_series(
  d.day + s."firstTeeTime"::time,
  d.day + s."lastTeeTime"::time,
  make_interval(mins => s."intervalMinutes")
) AS t(slot)
WHERE s."id" = 'singleton'
ON CONFLICT ("date", "startTime") DO NOTHING;

-- Tournament events (only if none exist yet)
INSERT INTO "TournamentEvent" (
  "id", "name", "description", "eventDate", "startTime", "format",
  "entry", "spotsTotal", "memberOnly", "featured", "past"
)
SELECT gen_random_uuid()::text, e.*
FROM (VALUES
  ('Spring Opener Scramble',
   'Kick off the season with Deer Run''s annual Spring Opener. Four-person teams, best-ball format. Prizes for all flight winners.',
   TIMESTAMP '2027-03-20 00:00:00', '8:00 AM', '4-Person Scramble', 2500, NULL::integer, false, true, false),
  ('Member Invitational',
   'Annual member-only invitational with individual stroke play. Low gross and net winners in two flights.',
   TIMESTAMP '2027-04-17 00:00:00', '7:30 AM', 'Individual Stroke', 1500, NULL, true, false, false),
  ('Lawrence County Charity Open',
   'Benefiting the Lawrence County Boys & Girls Club. Two-person best ball. Includes cookout lunch, silent auction, and prizes.',
   TIMESTAMP '2027-05-15 00:00:00', '9:00 AM', 'Best Ball', 5000, 80, false, true, false),
  ('Junior Summer Classic',
   'Annual junior tournament open to all youth golfers. Multiple age divisions. Parent / junior division available.',
   TIMESTAMP '2027-06-12 00:00:00', '8:00 AM', 'Individual Stroke', 1000, NULL, false, false, false),
  ('Independence Day Scramble',
   'Celebrate the 4th on the fairways. Three-person scramble, cookout included with registration.',
   TIMESTAMP '2027-07-04 00:00:00', '7:30 AM', '3-Person Scramble', 2000, 36, false, false, false),
  ('Fall Member Classic',
   'End-of-season member event using Stableford scoring. Fall foliage along the Bankhead Forest makes this round one of the most scenic.',
   TIMESTAMP '2027-09-25 00:00:00', '8:00 AM', 'Stableford', NULL::integer, NULL, true, false, false),
  ('New Year Scramble',
   'Sold-out field of 120 players. Congratulations to Team Parker for their -14 winning score.',
   TIMESTAMP '2025-01-18 00:00:00', '10:00 AM', '4-Person Scramble', 2000, NULL, false, false, true),
  ('Valentine''s Day Couples',
   'Mixed couples best-ball format — 28 teams competed. Overall winners: John & Sarah Whitfield with a -8 round.',
   TIMESTAMP '2025-02-15 00:00:00', '9:00 AM', 'Best Ball', 3000, NULL, false, false, true)
) AS e(name, description, event_date, start_time, format, entry, spots_total, member_only, featured, past)
WHERE NOT EXISTS (SELECT 1 FROM "TournamentEvent");

COMMIT;

-- Quick check after running:
-- SELECT (SELECT count(*) FROM "CourseSettings")  AS settings,
--        (SELECT count(*) FROM "TeeTimeSlot")     AS slots,     -- expect 1740 (30 days x 58)
--        (SELECT count(*) FROM "TournamentEvent") AS events;    -- expect 8
