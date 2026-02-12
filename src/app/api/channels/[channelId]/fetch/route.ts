import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getChannelVideosPage, YouTubeQuotaError } from "@/lib/youtube";

// Fetch videos for a specific channel within a date range
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { channelId } = await params;
    const body = await request.json();
    const { months = 1, refresh = false } = body;

    // Get the channel from database
    const channel = await prisma.channel.findFirst({
      where: { userId, channelId },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Calculate date range
    const now = new Date();
    let fetchUntilDate: Date;
    let fetchFromDate: Date | null = null;

    if (refresh) {
      // Refresh mode: get videos newer than the most recent one we have
      const latestVideo = await prisma.video.findFirst({
        where: { userId, channelId },
        orderBy: { publishedAt: "desc" },
      });

      if (latestVideo) {
        fetchFromDate = latestVideo.publishedAt;
      }
      fetchUntilDate = new Date(0); // Fetch all the way back if no videos
    } else {
      // Duration mode: fetch videos from the last N months
      fetchUntilDate = new Date(now);
      fetchUntilDate.setMonth(fetchUntilDate.getMonth() - months);
    }

    // Get existing videos to know what we already have
    const existingVideos = await prisma.video.findMany({
      where: { userId, channelId },
      select: { videoId: true, publishedAt: true },
    });
    const existingVideoIds = new Set(existingVideos.map((v) => v.videoId));
    
    // Find the oldest video we have (to know where to stop fetching for historical data)
    const oldestExisting = existingVideos.length > 0
      ? existingVideos.reduce((oldest, v) => 
          v.publishedAt < oldest.publishedAt ? v : oldest
        )
      : null;

    let pageToken: string | null = null;
    let playlistId = channel.playlistId;
    let totalFetched = 0;
    let totalNew = 0;
    let reachedExisting = false;
    let reachedDateLimit = false;
    const newVideos: any[] = [];

    // Fetch videos page by page until we reach our criteria
    while (!reachedExisting && !reachedDateLimit) {
      const page = await getChannelVideosPage(
        channelId,
        50, // Max allowed by YouTube API
        pageToken,
        playlistId
      );

      // Save the playlist ID for future use
      if (page.playlistId && !channel.playlistId) {
        await prisma.channel.update({
          where: { id: channel.id },
          data: { playlistId: page.playlistId },
        });
        playlistId = page.playlistId;
      }

      if (page.videos.length === 0) {
        break;
      }

      for (const video of page.videos) {
        const publishedAt = new Date(video.publishedAt);
        totalFetched++;

        // Check if we've reached our date limit
        if (!refresh && publishedAt < fetchUntilDate) {
          reachedDateLimit = true;
          break;
        }

        // In refresh mode, stop if we hit a video we already have
        if (refresh && existingVideoIds.has(video.id)) {
          reachedExisting = true;
          break;
        }

        // For historical fetch, skip videos we already have but continue
        if (!refresh && existingVideoIds.has(video.id)) {
          continue;
        }

        // For historical fetch, stop if we've reached our oldest existing video's date
        // (we already have everything from that point forward)
        if (!refresh && oldestExisting && publishedAt >= oldestExisting.publishedAt) {
          // We're in the range we already have, skip
          if (existingVideoIds.has(video.id)) {
            continue;
          }
        }

        newVideos.push({
          videoId: video.id,
          title: video.title,
          description: video.description || null,
          thumbnail: video.thumbnail,
          channelId: video.channelId,
          channelTitle: video.channelTitle,
          publishedAt,
          duration: video.duration || null,
          isShort: video.duration ? isShortVideo(video.duration) : false,
          userId,
          dbChannelId: channel.id,
        });
        totalNew++;
      }

      pageToken = page.nextPageToken;
      if (!pageToken) {
        break;
      }
    }

    // Insert new videos in batches
    if (newVideos.length > 0) {
      // Use createMany with skipDuplicates to handle any race conditions
      await prisma.video.createMany({
        data: newVideos,
        skipDuplicates: true,
      });
    }

    // Update last fetched time
    await prisma.channel.update({
      where: { id: channel.id },
      data: { lastFetched: now },
    });

    return NextResponse.json({
      success: true,
      channelId,
      totalFetched,
      newVideosAdded: totalNew,
      message: refresh
        ? `Refreshed: Added ${totalNew} new videos`
        : `Fetched ${totalNew} videos from the last ${months} month(s)`,
    });
  } catch (error) {
    console.error("Fetch videos error:", error);

    if (error instanceof YouTubeQuotaError) {
      return NextResponse.json(
        { error: "YouTube API quota exceeded. Please try again tomorrow.", quotaExceeded: true },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch videos" },
      { status: 500 }
    );
  }
}

// Helper to determine if a video is a Short based on duration
function isShortVideo(duration: string): boolean {
  // Parse ISO 8601 duration (e.g., "PT1M30S", "PT45S", "PT3M")
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return false;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  return totalSeconds <= 180; // 3 minutes or less = Short
}
