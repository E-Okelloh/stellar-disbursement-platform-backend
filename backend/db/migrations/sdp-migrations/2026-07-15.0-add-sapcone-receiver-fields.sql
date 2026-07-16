-- +migrate Up
ALTER TABLE receivers ADD COLUMN recipient_name TEXT;
ALTER TABLE receivers ADD COLUMN currency_type TEXT;

-- +migrate Down
ALTER TABLE receivers DROP COLUMN IF EXISTS recipient_name;
ALTER TABLE receivers DROP COLUMN IF EXISTS currency_type;
