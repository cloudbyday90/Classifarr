-- Recover existing committed confirmations without scanning an actor's full audit history.
CREATE INDEX IF NOT EXISTS idx_audit_log_media_identity_receipt
    ON audit_log (user_id, (metadata ->> 'reviewId'))
    WHERE action = 'media_identity_confirmed';
