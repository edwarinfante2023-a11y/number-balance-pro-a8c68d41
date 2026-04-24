DO $$
BEGIN
    -- Ensure the publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Add the draws table to the realtime publication
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'draws'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE draws;
    END IF;
END $$;
