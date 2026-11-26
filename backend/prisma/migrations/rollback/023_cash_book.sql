-- Rollback for ../023_cash_book.sql (apply manually; not part of the forward migration set)
-- Shift movements recorded after 023 exist only in cash_book_entries; they are copied
-- back into pos_session_transactions before the cash book tables are dropped.
-- The image_entity_type value 'cash_book_entry' cannot be dropped from the enum and is left in place.

INSERT INTO pos_session_transactions (pos_session_id, transaction_type, amount, reason, created_at)
SELECT e.pos_session_id,
       CASE WHEN e.direction = 'in' THEN 'cash_in' ELSE 'cash_out' END,
       CASE WHEN e.direction = 'in' THEN e.amount ELSE -e.amount END,
       e.note,
       e.entry_date
FROM cash_book_entries e
JOIN cash_book_categories c ON c.id = e.category_id
WHERE e.pos_session_id IS NOT NULL
  AND e.status = 'posted'
  AND c.code IN ('shift_cash_in', 'shift_cash_out', 'transfer_in', 'transfer_out')
  AND (e.source_type IS DISTINCT FROM 'pos_session_transaction');

COMMENT ON TABLE pos_session_transactions IS NULL;

DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE resource = 'cash_book');
DELETE FROM permissions WHERE resource = 'cash_book';

DROP TABLE IF EXISTS cash_book_entries;
DROP TABLE IF EXISTS cash_book_method_accounts;
DROP TABLE IF EXISTS cash_book_categories;
DROP TABLE IF EXISTS cash_book_accounts;
