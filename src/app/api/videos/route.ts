import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVideosFromChannels } from "@/lib/youtube";
import { getCachedVideos, setCachedVideos } from "@/lib/cache";

const VIDEOS_PER_PAGE = 12;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const type = searchParams.get("type") || "all"; // "all", "videos", "shorts"

  // Check cache first (for all videos)
  let allVideos = getCachedVideos(userId);
  
  if (!allVideos) {
    const channels = await prisma.channel.findMany({
      where: { userId },
      select: { channelId: true },
    });

    if (channels.length === 0) {
      return NextResponse.json({ videos: [], hasMore: false, total: 0 });
    }

    const channelIds = channels.map((c) => c.channelId);

    try {
      // Fetch more videos per channel for infinite scroll
      allVideos = await getVideosFromChannels(channelIds, 20);
      
      // Cache the results
      setCachedVideos(userId, allVideos);
    } catch (error) {
      console.error("Videos fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch videos" },
        { status: 500 }
      );
    }
  }

  // Filter by type if specified
  let filteredVideos = allVideos;
  if (type === "videos") {
    filteredVideos = allVideos.filter((v: any) => !v.isShort);
  } else if (type === "shorts") {
    filteredVideos = allVideos.filter((v: any) => v.isShort);
  }

  // Paginate
  const startIndex = (page - 1) * VIDEOS_PER_PAGE;
  const endIndex = startIndex + VIDEOS_PER_PAGE;
  const paginatedVideos = filteredVideos.slice(startIndex, endIndex);
  const hasMore = endIndex < filteredVideos.length;

  return NextResponse.json({
    videos: paginatedVideos,
    hasMore,
    total: filteredVideos.length,
    page,
  });
}
