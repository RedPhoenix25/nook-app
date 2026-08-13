-- Disable transactions for this migration since ALTER TYPE cannot run in a transaction block
COMMIT;

ALTER TYPE note_type ADD VALUE IF NOT EXISTS 'audio';
