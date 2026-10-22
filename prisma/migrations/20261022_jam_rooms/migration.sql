-- Additive migration: Jam listening rooms.
CREATE TABLE IF NOT EXISTS "jam_rooms" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "hostId" TEXT NOT NULL, "songId" TEXT,
  "positionSec" DOUBLE PRECISION NOT NULL DEFAULT 0, "isPlaying" BOOLEAN NOT NULL DEFAULT false,
  "stateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "pendingSongIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "endedAt" TIMESTAMP(3),
  CONSTRAINT "jam_rooms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "jam_rooms_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "jam_rooms_code_key" ON "jam_rooms"("code");
CREATE INDEX IF NOT EXISTS "jam_rooms_hostId_endedAt_idx" ON "jam_rooms"("hostId", "endedAt");

CREATE TABLE IF NOT EXISTS "jam_members" (
  "roomId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "jam_members_pkey" PRIMARY KEY ("roomId", "userId"),
  CONSTRAINT "jam_members_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "jam_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "jam_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "jam_messages" (
  "id" TEXT NOT NULL, "roomId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'chat', "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "jam_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "jam_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "jam_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "jam_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "jam_messages_roomId_createdAt_idx" ON "jam_messages"("roomId", "createdAt");
