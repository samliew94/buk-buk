ALTER TABLE web_push_subscription ADD COLUMN user_id TEXT REFERENCES "user"(id) ON DELETE CASCADE;

CREATE INDEX web_push_subscription_user_id ON web_push_subscription (user_id);

CREATE TRIGGER user_deregister_web_push_on_ban
AFTER UPDATE OF is_banned ON "user"
FOR EACH ROW WHEN NEW.is_banned = 1
BEGIN
  DELETE FROM web_push_subscription WHERE user_id = NEW.id;
END;
