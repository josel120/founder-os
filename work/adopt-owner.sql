BEGIN;
LOCK TABLE "user", idea, problem IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE changed integer;
BEGIN
  IF (SELECT count(*) FROM "user") <> 1 OR NOT EXISTS (
    SELECT 1 FROM "user" WHERE id = 'lYeu26mysyLc9Hg6WpzaREJThpRpUipB'
      AND lower(email) = 'josegomez120@gmail.com'
  ) THEN RAISE EXCEPTION 'Owner inventory changed'; END IF;
  UPDATE idea SET owner_id = 'lYeu26mysyLc9Hg6WpzaREJThpRpUipB'
    WHERE owner_id IS NULL AND problem_id IS NULL
    AND id IN ('482bce3a-6ae5-4eb5-8f96-0c43fa0751f1', 'a4fe649b-9166-49f9-b75b-45a8dcd608be');
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 2 THEN RAISE EXCEPTION 'Unexpected adoption count'; END IF;
END $$;
COMMIT;
SELECT count(*) AS total_ideas,
  count(*) FILTER (WHERE owner_id = 'lYeu26mysyLc9Hg6WpzaREJThpRpUipB') AS owned_ideas
FROM idea;
