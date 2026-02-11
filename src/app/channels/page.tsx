"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { ChannelSearch, ChannelList } from "@/components/ChannelManager";
import { Loader2 } from "lucide-react";

interface Channel {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  thumbnail?: string;
}

export default function ChannelsPage() {
  const { data: session, status } = useSession();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchChannels();
    } else {
      setLoading(false);
    }
  }, [session]);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/channels");
      const data = await response.json();
      setChannels(data);
    } catch (error) {
      console.error("Failed to fetch channels:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Loader2 className="w-12 h-12 text-red-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
        <h1 className="text-2xl font-bold text-white mb-4">
          Sign in to manage your channels
        </h1>
        <p className="text-gray-400">
          You need to be signed in to add and manage channels.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-white mb-8">Manage Channels</h1>

      <div className="space-y-8">
        <ChannelSearch onChannelAdded={fetchChannels} />
        <ChannelList channels={channels} onChannelRemoved={fetchChannels} />
      </div>
    </div>
  );
}
