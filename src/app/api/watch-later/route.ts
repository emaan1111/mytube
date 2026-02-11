import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - fetch all watch later videos
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const watchLater = await prisma.watchLater.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  // Transform to match video format
  const videos = watchLater.map((item) => ({
    id: item.videoId,
    title: item.title,
    description: item.description || "",
    thumbnail: item.thumbnail || "",
    channelId: item.channelId,
    channelTitle: item.channelTitle,
    publishedAt: item.publishedAt,
    duration: item.duration,
    isShort: item.isShort,
    inWatchLater: true,
  }));

  return NextResponse.json(videos);
}

// POST - add video to watch later
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

  try {
    const watchLater = await prisma.watchLater.create({
      data: {
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
      },
    });

    return NextResponse.json({ success: true, id: watchLater.id });
  } catch (error: any) {
    // Handle duplicate
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Already in Watch Later" },
        { status: 409 }
      );
    }
    throw error;
  }
}

// DELETE - remove video from watch later
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json({ error: "Video ID required" }, { status: 400 });
  }

  await prisma.watchLater.deleteMany({
    where: {
      userId: session.user.id,
      videoId,
    },
  });

  return NextResponse.json({ success: true });
}
