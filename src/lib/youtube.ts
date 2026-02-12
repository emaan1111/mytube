const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export class YouTubeQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YouTubeQuotaError";
  }
}

// Helper to build auth params - prefer OAuth token, fallback to API key
function getAuthParams(accessToken?: string | null): string {
  if (accessToken) {
    return ""; // Will use Authorization header instead
  }
  if (YOUTUBE_API_KEY) {
    return `&key=${YOUTUBE_API_KEY}`;
  }
  throw new Error("No YouTube authentication available");
}

function getAuthHeaders(accessToken?: string | null): HeadersInit {
  if (accessToken) {
    return { Authorization: `Bearer ${accessToken}` };
  }
  return {};
}

async function youtubeApiFetch(url: string, accessToken?: string | null): Promise<Response> {
  // Add API key to URL if not using OAuth
  const authParam = accessToken ? "" : (YOUTUBE_API_KEY ? `&key=${YOUTUBE_API_KEY}` : "");
  const finalUrl = url.includes("?") ? `${url}${authParam}` : `${url}?${authParam.slice(1)}`;
  
  return fetch(finalUrl, {
    headers: getAuthHeaders(accessToken),
  });
}

async function checkQuotaError(response: Response): Promise<void> {
  if (response.status === 403) {
    const errorData = await response.json();
    if (errorData?.error?.errors?.[0]?.reason === "quotaExceeded") {
      throw new YouTubeQuotaError("YouTube API quota exceeded. Please try again tomorrow.");
    }
  }
}

export interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberCount?: string;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  viewCount?: string;
  duration?: string;
}

export interface ChannelVideosPage {
  playlistId: string | null;
  videos: YouTubeVideo[];
  nextPageToken: string | null;
}

export async function searchChannels(query: string, accessToken?: string | null): Promise<YouTubeChannel[]> {
  const response = await youtubeApiFetch(
    `${YOUTUBE_API_BASE}/search?part=snippet&type=channel&q=${encodeURIComponent(
      query
    )}&maxResults=10`,
    accessToken
  );

  if (!response.ok) {
    await checkQuotaError(response);
    throw new Error("Failed to search channels");
  }

  const data = await response.json();

  return data.items.map((item: any) => ({
    id: item.snippet.channelId,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnail: item.snippet.thumbnails.default.url,
  }));
}

export async function getChannelDetails(
  channelId: string,
  accessToken?: string | null
): Promise<YouTubeChannel | null> {
  const response = await youtubeApiFetch(
    `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&id=${channelId}`,
    accessToken
  );

  if (!response.ok) {
    await checkQuotaError(response);
    throw new Error("Failed to get channel details");
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    return null;
  }

  const channel = data.items[0];
  return {
    id: channel.id,
    title: channel.snippet.title,
    description: channel.snippet.description,
    thumbnail: channel.snippet.thumbnails.default.url,
    subscriberCount: channel.statistics.subscriberCount,
  };
}

export async function getChannelVideos(
  channelId: string,
  maxResults: number = 10,
  accessToken?: string | null
): Promise<YouTubeVideo[]> {
  const page = await getChannelVideosPage(channelId, maxResults, null, null, accessToken);
  return page.videos;
}

// Parse ISO 8601 duration and check if 3 minutes or less (Shorts limit)
function isShortDuration(duration: string): boolean {
  if (!duration) return false;
  
  // Parse PT#H#M#S, PT#M#S, or PT#S format (ISO 8601 duration)
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return false;
  
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  
  // YouTube Shorts are 3 minutes (180 seconds) or less
  return totalSeconds <= 180;
}

export async function getVideosFromChannels(
  channelIds: string[],
  videosPerChannel: number = 5
): Promise<YouTubeVideo[]> {
  // Fetch all channels in parallel for much faster loading
  const videoPromises = channelIds.map((channelId) =>
    getChannelVideos(channelId, videosPerChannel).catch((error) => {
      console.error(`Failed to get videos for channel ${channelId}:`, error);
      return [] as YouTubeVideo[];
    })
  );

  const videoArrays = await Promise.all(videoPromises);
  const allVideos = videoArrays.flat();

  // Sort by publish date (newest first)
  return allVideos.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export async function getChannelVideosPage(
  channelId: string,
  maxResults: number = 10,
  pageToken?: string | null,
  playlistId?: string | null,
  accessToken?: string | null
): Promise<ChannelVideosPage> {
  let uploadsPlaylistId = playlistId ?? null;

  if (!uploadsPlaylistId) {
    const channelResponse = await youtubeApiFetch(
      `${YOUTUBE_API_BASE}/channels?part=contentDetails&id=${channelId}`,
      accessToken
    );

    if (!channelResponse.ok) {
      // Check for quota error first (need to clone response to read body twice)
      if (channelResponse.status === 403) {
        const errorData = await channelResponse.json();
        if (errorData?.error?.errors?.[0]?.reason === "quotaExceeded") {
          throw new YouTubeQuotaError("YouTube API quota exceeded");
        }
        throw new Error(`Failed to get channel details: ${JSON.stringify(errorData)}`);
      }
      throw new Error(`Failed to get channel details: ${channelResponse.status}`);
    }

    const channelData = await channelResponse.json();

    if (!channelData.items || channelData.items.length === 0) {
      return { playlistId: null, videos: [], nextPageToken: null };
    }

    uploadsPlaylistId =
      channelData.items[0].contentDetails.relatedPlaylists.uploads;
  }

  const pageTokenParam = pageToken ? `&pageToken=${pageToken}` : "";
  const videosResponse = await youtubeApiFetch(
    `${YOUTUBE_API_BASE}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}${pageTokenParam}`,
    accessToken
  );

  if (!videosResponse.ok) {
    await checkQuotaError(videosResponse);
    throw new Error("Failed to get channel videos");
  }

  const videosData = await videosResponse.json();
  const items = videosData.items ?? [];

  const videoIds = items
    .map((item: any) => item.snippet.resourceId.videoId)
    .join(",");

  let durations: Record<string, string> = {};
  if (videoIds.length > 0) {
    const detailsResponse = await youtubeApiFetch(
      `${YOUTUBE_API_BASE}/videos?part=contentDetails&id=${videoIds}`,
      accessToken
    );

    if (detailsResponse.ok) {
      const detailsData = await detailsResponse.json();
      durations = detailsData.items.reduce((acc: Record<string, string>, item: any) => {
        acc[item.id] = item.contentDetails.duration;
        return acc;
      }, {});
    }
  }

  const videos = items.map((item: any) => {
    const videoId = item.snippet.resourceId.videoId;
    const duration = durations[videoId] || "";

    return {
      id: videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail:
        item.snippet.thumbnails.high?.url ||
        item.snippet.thumbnails.default?.url,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      duration,
      isShort: isShortDuration(duration),
    };
  });

  return {
    playlistId: uploadsPlaylistId,
    videos,
    nextPageToken: videosData.nextPageToken ?? null,
  };
}
