import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - fetch all continue watching videos
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.continueWatching.findMany({
    where: { userId: session.user.id },
    orderBy: { lastWatchedAt: "desc" },
  });

  const videos = items.map((item) => ({
    id: item.videoId,
    title: item.title,
    description: item.description || "",
    thumbnail: item.thumbnail || "",
    channelId: item.channelId,
    channelTitle: item.channelTitle,
    publishedAt: item.publishedAt,
    duration: item.duration,
    isShort: item.isShort,
    lastWatchedAt: item.lastWatchedAt,
  }));

  return NextResponse.json(videos);
}

// POST - upsert a continue watching record
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { video } = body;

  if (!video || !video.id) {
    return NextResponse.json({ error: "Video data required" }, { status: 400 });
  }

  const record = await prisma.continueWatching.upsert({
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
      isShort: video.isShort || false,
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
      isShort: video.isShort || false,
      userId: session.user.id,
      lastWatchedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, id: record.id });
}
