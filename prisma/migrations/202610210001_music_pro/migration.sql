ALTER TABLE "users" ADD COLUMN "proExpiresAt" TIMESTAMP(3);

CREATE TABLE "payment_orders" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "code" TEXT NOT NULL,
  "amount" INTEGER NOT NULL DEFAULT 50000, "status" TEXT NOT NULL DEFAULT 'PENDING',
  "transactionId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL, "paidAt" TIMESTAMP(3),
  CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "payment_orders_code_key" ON "payment_orders"("code");
CREATE UNIQUE INDEX "payment_orders_transactionId_key" ON "payment_orders"("transactionId");
CREATE INDEX "payment_orders_userId_createdAt_idx" ON "payment_orders"("userId", "createdAt");

CREATE TABLE "daily_usage" (
  "userId" TEXT NOT NULL, "day" TEXT NOT NULL, "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "daily_usage_pkey" PRIMARY KEY ("userId", "day"),
  CONSTRAINT "daily_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "playback_sessions" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "songId" TEXT NOT NULL, "adRequired" BOOLEAN NOT NULL DEFAULT false,
  "readyAt" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3),
  CONSTRAINT "playback_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "playback_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "playback_sessions_userId_expiresAt_idx" ON "playback_sessions"("userId", "expiresAt");
