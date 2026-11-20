CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL UNIQUE CHECK (username <> '' AND username = lower(trim(username))),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('developer', 'manager')),
  is_banned INTEGER NOT NULL DEFAULT 0 CHECK (is_banned IN (0, 1))
);

CREATE TRIGGER IF NOT EXISTS user_immutable_id
BEFORE UPDATE OF id ON "user"
FOR EACH ROW WHEN NEW.id <> OLD.id
BEGIN
  SELECT RAISE(ABORT, 'user id is immutable');
END;

INSERT INTO "user" (id, username, password_hash, role, is_banned)
VALUES (
  'aaac2910-f26c-4188-94a2-838a2c5ac09f',
  'sam',
  'scrypt$v1$fe7a675b3a2372bfaa84ed650e6d26b3$e576a9bfbcb562244ab9ce6d24b469e1557cf2480af68d12fd3b3b37576e6d7b',
  'developer',
  0
)
ON CONFLICT (username) DO NOTHING;
