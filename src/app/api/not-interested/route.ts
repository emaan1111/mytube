import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - List all not interested video IDs for the user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notInterested = await prisma.notInterested.findMany({
      where: { userId: session.user.id },
      select: { videoId: true },
    });

    return NextResponse.json(notInterested.map((n) => n.videoId));
  } catch (error) {
    console.error("Failed to get not interested list:", error);
    return NextResponse.json(
      { error: "Failed to get not interested list" },
      { status: 500 }
    );
  }
}

// POST - Mark a video as not interested
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: "videoId is required" },
        { status: 400 }
      );
    }

    await prisma.notInterested.upsert({
      where: {
        userId_videoId: {
          userId: session.user.id,
          videoId,
        },
      },
      update: {},
      create: {
        userId: session.user.id,
        videoId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to mark as not interested:", error);
    return NextResponse.json(
      { error: "Failed to mark as not interested" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a video from not interested
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("videoId");

    if (!videoId) {
      return NextResponse.json(
        { error: "videoId is required" },
        { status: 400 }
      );
    }

    await prisma.notInterested.deleteMany({
      where: {
        userId: session.user.id,
        videoId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove from not interested:", error);
    return NextResponse.json(
      { error: "Failed to remove from not interested" },
      { status: 500 }
    );
  }
}
