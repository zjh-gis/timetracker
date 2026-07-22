CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "user" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "expiresAt" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");

CREATE TABLE IF NOT EXISTS "account" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("providerId", "accountId")
);
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

CREATE TABLE IF NOT EXISTS "time_sync_state" (
  "user_id" uuid PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "revision" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "time_categories" (
  "user_id" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "id" text NOT NULL,
  "name" text NOT NULL,
  "color" text NOT NULL,
  "is_primary_work" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  PRIMARY KEY ("user_id", "id")
);

CREATE TABLE IF NOT EXISTS "time_tasks" (
  "user_id" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "id" text NOT NULL,
  "name" text NOT NULL,
  "category_id" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  PRIMARY KEY ("user_id", "id")
);
CREATE INDEX IF NOT EXISTS "time_tasks_user_category_idx" ON "time_tasks" ("user_id", "category_id");

CREATE TABLE IF NOT EXISTS "time_entries" (
  "user_id" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "id" text NOT NULL,
  "date" date NOT NULL,
  "started_at" timestamptz,
  "ended_at" timestamptz,
  "duration_seconds" integer NOT NULL CHECK ("duration_seconds" >= 0),
  "title" text NOT NULL,
  "task_id" text,
  "category_id" text NOT NULL,
  "note" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "deleted_at" timestamptz,
  PRIMARY KEY ("user_id", "id")
);
CREATE INDEX IF NOT EXISTS "time_entries_user_date_idx" ON "time_entries" ("user_id", "date");
CREATE INDEX IF NOT EXISTS "time_entries_user_updated_idx" ON "time_entries" ("user_id", "updated_at");

CREATE TABLE IF NOT EXISTS "time_active_timers" (
  "user_id" uuid PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "task_id" text NOT NULL,
  "title" text NOT NULL,
  "category_id" text NOT NULL,
  "note" text NOT NULL DEFAULT '',
  "started_at" timestamptz NOT NULL,
  "running_since" timestamptz,
  "accumulated_seconds" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "schema_migrations" (
  "name" text PRIMARY KEY,
  "applied_at" timestamptz NOT NULL DEFAULT now()
);
INSERT INTO "schema_migrations" ("name") VALUES ('0001_initial') ON CONFLICT DO NOTHING;
