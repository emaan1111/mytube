// Simple in-memory cache for video data
type ChannelState = {
  playlistId: string | null;
  nextPageToken: string | null;
  exhausted: boolean;
};

type VideoCacheEntry = {
  videos: any[];
  timestamp: number;
  channelStates: Record<string, ChannelState>;
};

const videoCache = new Map<string, VideoCacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function getCachedVideos(userId: string) {
  const cached = videoCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached;
  }
  return null;
}

export function setCachedVideos(
  userId: string,
  videos: any[],
  channelStates: Record<string, ChannelState>
) {
  videoCache.set(userId, { videos, timestamp: Date.now(), channelStates });
}

export function invalidateCache(userId: string) {
  videoCache.delete(userId);
}
