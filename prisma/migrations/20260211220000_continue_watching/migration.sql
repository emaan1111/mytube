CREATE TABLE "ContinueWatching" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "channelId" TEXT NOT NULL,
    "channelTitle" TEXT NOT NULL,
    "publishedAt" TEXT NOT NULL,
    "duration" TEXT,
    "isShort" BOOLEAN NOT NULL DEFAULT false,
    "lastWatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContinueWatching_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContinueWatching_userId_videoId_key" ON "ContinueWatching"("userId", "videoId");
CREATE INDEX "ContinueWatching_userId_lastWatchedAt_idx" ON "ContinueWatching"("userId", "lastWatchedAt");

ALTER TABLE "ContinueWatching" ADD CONSTRAINT "ContinueWatching_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
