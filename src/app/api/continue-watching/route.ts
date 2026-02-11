import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items = await prisma.continueWatching.findMany({
      where: { userId: session.user.id },
      orderBy: { lastWatchedAt: "desc" },
      take: 50,
    });

    const videos = items.map((item) => ({
      id: item.videoId,
      title: item.title,
      description: item.description || "",
      thumbnail: item.thumbnail || "",
      channelId: item.channelId,
      channelTitle: item.channelTitle,
      publishedAt: item.publishedAt,
      duration: item.duration || "",
      isShort: item.isShort,
      lastWatchedAt: item.lastWatchedAt.toISOString(),
    }));

    return NextResponse.json(videos);
  } catch (error) {
    console.error("Continue watching GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch continue watching" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const video = body?.video;

    if (!video?.id || !video?.title || !video?.channelId || !video?.channelTitle || !video?.publishedAt) {
      return NextResponse.json({ error: "Video data required" }, { status: 400 });
    }

    await prisma.continueWatching.upsert({
      where: {
        userId_videoId: {
          userId: session.user.id,
          videoId: video.id,
        },
      },
      update: {
        title: video.title,
        description: video.description || "",
        thumbnail: video.thumbnail || "",
        channelId: video.channelId,
        channelTitle: video.channelTitle,
        publishedAt: video.publishedAt,
        duration: video.duration || "",
        isShort: !!video.isShort,
        lastWatchedAt: new Date(),
      },
      create: {
        videoId: video.id,
        title: video.title,
        description: video.description || "",
        thumbnail: video.thumbnail || "",
        channelId: video.channelId,
        channelTitle: video.channelTitle,
        publishedAt: video.publishedAt,
        duration: video.duration || "",
        isShort: !!video.isShort,
        userId: session.user.id,
        lastWatchedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Continue watching POST error:", error);
    return NextResponse.json(
      { error: "Failed to save continue watching" },
      { status: 500 }
    );
  }
}
