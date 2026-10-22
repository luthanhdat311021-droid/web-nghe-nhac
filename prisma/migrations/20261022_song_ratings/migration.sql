-- Additive migration: song ratings (Music Pro only, enforced in the API).
CREATE TABLE IF NOT EXISTS "song_ratings" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "songId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL, "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "song_ratings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "song_ratings_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "song_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "song_ratings_songId_fkey" FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "song_ratings_userId_songId_key" ON "song_ratings"("userId", "songId");
CREATE INDEX IF NOT EXISTS "song_ratings_songId_updatedAt_idx" ON "song_ratings"("songId", "updatedAt" DESC);
