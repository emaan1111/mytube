import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getChannelVideosPage, YouTubeQuotaError } from "@/lib/youtube";

// Helper to determine if a video is a Short based on duration
function isShortVideo(duration: string): boolean {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return false;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  return totalSeconds <= 180;
}

// Refresh all enabled channels, fetching only new videos since the last check
export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get all enabled channels
    const channels = await prisma.channel.findMany({
      where: { userId, isEnabled: true },
    });

    if (channels.length === 0) {
      return NextResponse.json({ totalNew: 0, channels: 0 });
    }

    let totalNew = 0;
    let quotaExceeded = false;

    // Refresh each channel in parallel
    const results = await Promise.allSettled(
      channels.map(async (channel) => {
        // Find the most recent video we have for this channel
        const latestVideo = await prisma.video.findFirst({
          where: { userId, channelId: channel.channelId },
          orderBy: { publishedAt: "desc" },
          select: { videoId: true, publishedAt: true },
        });

        // Get existing video IDs to skip duplicates
        const existingVideos = await prisma.video.findMany({
          where: { userId, channelId: channel.channelId },
          select: { videoId: true },
        });
        const existingVideoIds = new Set(existingVideos.map((v) => v.videoId));

        let pageToken: string | null = null;
        let playlistId = channel.playlistId;
        const newVideos: any[] = [];
        let reachedExisting = false;

        // Fetch pages until we hit videos we already have
        while (!reachedExisting) {
          const page = await getChannelVideosPage(
            channel.channelId,
            50,
            pageToken,
            playlistId
          );

          // Cache playlist ID
          if (page.playlistId && !channel.playlistId) {
            await prisma.channel.update({
              where: { id: channel.id },
              data: { playlistId: page.playlistId },
            });
            playlistId = page.playlistId;
          }

          if (page.videos.length === 0) break;

          for (const video of page.videos) {
            // Stop if we've reached a video we already have
            if (existingVideoIds.has(video.id)) {
              reachedExisting = true;
              break;
            }

            newVideos.push({
              videoId: video.id,
              title: video.title,
              description: video.description || null,
              thumbnail: video.thumbnail,
              channelId: video.channelId,
              channelTitle: video.channelTitle,
              publishedAt: new Date(video.publishedAt),
              duration: video.duration || null,
              isShort: video.duration ? isShortVideo(video.duration) : false,
              userId,
              dbChannelId: channel.id,
            });
          }

          pageToken = page.nextPageToken;
          if (!pageToken) break;
        }

        // Insert new videos
        if (newVideos.length > 0) {
          await prisma.video.createMany({
            data: newVideos,
            skipDuplicates: true,
          });
        }

        // Update last fetched time
        await prisma.channel.update({
          where: { id: channel.id },
          data: { lastFetched: new Date() },
        });

        return newVideos.length;
      })
    );

    // Tally results
    for (const result of results) {
      if (result.status === "fulfilled") {
        totalNew += result.value;
      } else if (
        result.reason instanceof YouTubeQuotaError
      ) {
        quotaExceeded = true;
      }
    }

    return NextResponse.json({
      totalNew,
      channels: channels.length,
      ...(quotaExceeded && { quotaExceeded: true }),
    });
  } catch (error) {
    console.error("Refresh all channels error:", error);

    if (error instanceof YouTubeQuotaError) {
      return NextResponse.json(
        { error: "YouTube API quota exceeded.", quotaExceeded: true },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to refresh channels" },
      { status: 500 }
    );
  }
}
