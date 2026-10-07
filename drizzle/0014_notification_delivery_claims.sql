ALTER TABLE notification_deliveries ADD COLUMN attempted_at TEXT;

UPDATE notification_deliveries
SET attempted_at = COALESCE(sent_at, created_at, CURRENT_TIMESTAMP);

CREATE TABLE notification_recipient_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  delivery_id INTEGER NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  attempted_at TEXT,
  sent_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (delivery_id) REFERENCES notification_deliveries(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX notification_recipient_deliveries_unique
ON notification_recipient_deliveries(delivery_id, recipient);
