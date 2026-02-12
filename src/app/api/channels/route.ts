import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getChannelDetails } from "@/lib/youtube";
import { invalidateCache } from "@/lib/cache";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channels = await prisma.channel.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { videos: true }
      }
    }
  });

  // Transform to include video count
  const channelsWithCount = channels.map(channel => ({
    ...channel,
    videoCount: channel._count.videos,
    _count: undefined,
  }));

  return NextResponse.json(channelsWithCount);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { channelId } = await request.json();

  if (!channelId) {
    return NextResponse.json(
      { error: "Channel ID is required" },
      { status: 400 }
    );
  }

  // Check if channel already exists for this user
  const existingChannel = await prisma.channel.findUnique({
    where: {
      userId_channelId: {
        userId: session.user.id,
        channelId,
      },
    },
  });

  if (existingChannel) {
    return NextResponse.json(
      { error: "Channel already added" },
      { status: 400 }
    );
  }

  // Get channel details from YouTube
  const channelDetails = await getChannelDetails(channelId);

  if (!channelDetails) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const channel = await prisma.channel.create({
    data: {
      channelId,
      title: channelDetails.title,
      description: channelDetails.description,
      thumbnail: channelDetails.thumbnail,
      userId: session.user.id,
    },
  });

  // Invalidate video cache so new channel videos appear
  invalidateCache(session.user.id);

  return NextResponse.json(channel);
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");

  if (!channelId) {
    return NextResponse.json(
      { error: "Channel ID is required" },
      { status: 400 }
    );
  }

  await prisma.channel.deleteMany({
    where: {
      userId: session.user.id,
      channelId,
    },
  });

  // Invalidate video cache
  invalidateCache(session.user.id);

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { channelId, isEnabled } = await request.json();

  if (!channelId || typeof isEnabled !== "boolean") {
    return NextResponse.json(
      { error: "Channel ID and isEnabled are required" },
      { status: 400 }
    );
  }

  const result = await prisma.channel.updateMany({
    where: {
      userId: session.user.id,
      channelId,
    },
    data: {
      isEnabled,
    },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  invalidateCache(session.user.id);

  return NextResponse.json({ success: true });
}
