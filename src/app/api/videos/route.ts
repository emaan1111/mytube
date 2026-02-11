import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getChannelVideosPage } from "@/lib/youtube";
import { getCachedVideos, setCachedVideos } from "@/lib/cache";

const VIDEOS_PER_PAGE = 12;
const PAGE_SIZE_PER_CHANNEL = 20;
const MAX_ROUNDS_PER_REQUEST = 3;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const type = searchParams.get("type") || "all"; // "all", "videos", "shorts"

  const channels = await prisma.channel.findMany({
    where: { userId },
    select: { channelId: true },
  });

  if (channels.length === 0) {
    return NextResponse.json({ videos: [], hasMore: false, total: 0 });
  }

  const channelIds = channels.map((c) => c.channelId);

  const mergeUniqueById = (base: any[], next: any[]) => {
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const video of [...base, ...next]) {
      if (!seen.has(video.id)) {
        seen.add(video.id);
        merged.push(video);
      }
    }
    return merged;
  };

  const fetchNextPages = async (
    channelStates: Record<
      string,
      { playlistId: string | null; nextPageToken: string | null; exhausted: boolean }
    >
  ) => {
    const promises = channelIds.map(async (channelId) => {
      const state = channelStates[channelId] ?? {
        playlistId: null,
        nextPageToken: null,
        exhausted: false,
      };

      if (state.exhausted) {
        return { channelId, state, videos: [] as any[] };
      }

      try {
        const page = await getChannelVideosPage(
          channelId,
          PAGE_SIZE_PER_CHANNEL,
          state.nextPageToken,
          state.playlistId
        );

        const nextState = {
          playlistId: page.playlistId,
          nextPageToken: page.nextPageToken,
          exhausted: !page.nextPageToken,
        };

        return { channelId, state: nextState, videos: page.videos };
      } catch (error) {
        console.error(`Videos fetch error for channel ${channelId}:`, error);
        return { channelId, state, videos: [] as any[] };
      }
    });

    const results = await Promise.all(promises);
    const nextStates = { ...channelStates };
    const newVideos: any[] = [];

    for (const result of results) {
      nextStates[result.channelId] = result.state;
      newVideos.push(...result.videos);
    }

    return { nextStates, newVideos };
  };

  const cached = getCachedVideos(userId);
  let allVideos = cached?.videos ?? [];
  let channelStates =
    cached?.channelStates ??
    channelIds.reduce(
      (acc, channelId) => {
        acc[channelId] = { playlistId: null, nextPageToken: null, exhausted: false };
        return acc;
      },
      {} as Record<
        string,
        { playlistId: string | null; nextPageToken: string | null; exhausted: boolean }
      >
    );

  if (allVideos.length === 0) {
    const initial = await fetchNextPages(channelStates);
    channelStates = initial.nextStates;
    allVideos = mergeUniqueById(allVideos, initial.newVideos);
    allVideos = allVideos.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
    setCachedVideos(userId, allVideos, channelStates);
  }

  const filterByType = (videos: any[]) => {
    if (type === "videos") return videos.filter((v: any) => !v.isShort);
    if (type === "shorts") return videos.filter((v: any) => v.isShort);
    return videos;
  };

  let filteredVideos = filterByType(allVideos);

  const targetEndIndex = page * VIDEOS_PER_PAGE;
  let rounds = 0;
  const hasMoreChannels = () =>
    Object.values(channelStates).some((state) => !state.exhausted);

  while (
    filteredVideos.length <= targetEndIndex &&
    hasMoreChannels() &&
    rounds < MAX_ROUNDS_PER_REQUEST
  ) {
    const next = await fetchNextPages(channelStates);
    channelStates = next.nextStates;
    if (next.newVideos.length === 0) {
      break;
    }
    allVideos = mergeUniqueById(allVideos, next.newVideos).sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
    filteredVideos = filterByType(allVideos);
    rounds += 1;
    setCachedVideos(userId, allVideos, channelStates);
  }

  // Paginate
  const startIndex = (page - 1) * VIDEOS_PER_PAGE;
  const endIndex = startIndex + VIDEOS_PER_PAGE;
  const paginatedVideos = filteredVideos.slice(startIndex, endIndex);
  const hasMore = endIndex < filteredVideos.length || hasMoreChannels();

  return NextResponse.json({
    videos: paginatedVideos,
    hasMore,
    total: filteredVideos.length,
    page,
  });
}
