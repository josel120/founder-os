SELECT id, email FROM "user";
SELECT count(*) AS ideas FROM idea;
SELECT count(*) AS problems FROM problem;
SELECT column_name FROM information_schema.columns WHERE table_name = 'idea' AND column_name = 'owner_id';
