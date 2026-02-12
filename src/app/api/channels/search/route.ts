import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getUserYouTubeToken } from "@/lib/auth";
import { searchChannels } from "@/lib/youtube";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  try {
    // Get user's OAuth token if logged in (uses their quota)
    const session = await getServerSession(authOptions);
    const accessToken = session?.user?.id 
      ? await getUserYouTubeToken(session.user.id) 
      : null;

    const channels = await searchChannels(query, accessToken);
    return NextResponse.json(channels);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search channels" },
      { status: 500 }
    );
  }
}
