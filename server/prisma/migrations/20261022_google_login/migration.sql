-- Additive migration: preserve all existing users and password sign-ins.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleSubject" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_googleSubject_key" ON "users"("googleSubject");
