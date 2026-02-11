// Simple in-memory cache for video data
const videoCache = new Map<string, { videos: any[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function getCachedVideos(userId: string) {
  const cached = videoCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.videos;
  }
  return null;
}

export function setCachedVideos(userId: string, videos: any[]) {
  videoCache.set(userId, { videos, timestamp: Date.now() });
}

export function invalidateCache(userId: string) {
  videoCache.delete(userId);
}
