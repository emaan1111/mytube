import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VIDEOS_PER_PAGE = 24;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const type = searchParams.get("type") || "all"; // "all", "videos", "shorts"
    const channelFilter = searchParams.get("channel") || null;

    // Get enabled channels
    const enabledChannels = await prisma.channel.findMany({
      where: { userId, isEnabled: true },
      select: { channelId: true },
    });

    if (enabledChannels.length === 0) {
      return NextResponse.json({
        videos: [],
        hasMore: false,
        total: 0,
      });
    }

    const enabledChannelIds = enabledChannels.map((c) => c.channelId);

    // Get not interested video IDs to exclude
    const notInterested = await prisma.notInterested.findMany({
      where: { userId },
      select: { videoId: true },
    });
    const notInterestedIds = notInterested.map((n) => n.videoId);

    // Build the where clause
    const whereClause: any = {
      userId,
      channelId: channelFilter 
        ? channelFilter 
        : { in: enabledChannelIds },
    };

    // Exclude not interested videos
    if (notInterestedIds.length > 0) {
      whereClause.videoId = { notIn: notInterestedIds };
    }

    // Filter by type (shorts vs regular videos)
    if (type === "videos") {
      whereClause.isShort = false;
    } else if (type === "shorts") {
      whereClause.isShort = true;
    }

    // Get total count
    const total = await prisma.video.count({ where: whereClause });

    // Get paginated videos
    const skip = (page - 1) * VIDEOS_PER_PAGE;
    const videos = await prisma.video.findMany({
      where: whereClause,
      orderBy: { publishedAt: "desc" },
      skip,
      take: VIDEOS_PER_PAGE,
      select: {
        videoId: true,
        title: true,
        description: true,
        thumbnail: true,
        channelId: true,
        channelTitle: true,
        publishedAt: true,
        duration: true,
        isShort: true,
      },
    });

    // Transform to match the expected format
    const formattedVideos = videos.map((v) => ({
      id: v.videoId,
      title: v.title,
      description: v.description || "",
      thumbnail: v.thumbnail || "",
      channelId: v.channelId,
      channelTitle: v.channelTitle,
      publishedAt: v.publishedAt.toISOString(),
      duration: v.duration,
      isShort: v.isShort,
    }));

    const hasMore = skip + videos.length < total;

    return NextResponse.json({
      videos: formattedVideos,
      hasMore,
      total,
      page,
    });
  } catch (error) {
    console.error("Videos API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch videos" },
      { status: 500 }
    );
  }
}