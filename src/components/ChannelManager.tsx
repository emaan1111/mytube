"use client";

import { useState } from "react";
import Image from "next/image";
import { Search, Plus, X, Loader2 } from "lucide-react";

interface Channel {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  thumbnail?: string;
}

interface SearchResult {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
}

export function ChannelSearch({
  onChannelAdded,
}: {
  onChannelAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const searchChannels = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/channels/search?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const addChannel = async (channelId: string) => {
    setAdding(channelId);
    try {
      const response = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });

      if (response.ok) {
        onChannelAdded();
        setResults(results.filter((r) => r.id !== channelId));
      }
    } catch (error) {
      console.error("Add channel failed:", error);
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-semibold text-white mb-4">Add Channel</h2>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchChannels()}
            placeholder="Search for YouTube channels..."
            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-red-500 focus:outline-none"
          />
        </div>
        <button
          onClick={searchChannels}
          disabled={loading}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Search className="w-5 h-5" />
          )}
          Search
        </button>
      </div>

      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.map((channel) => (
            <div
              key={channel.id}
              className="flex items-center gap-4 p-3 bg-gray-700 rounded-lg"
            >
              {channel.thumbnail && (
                <Image
                  src={channel.thumbnail}
                  alt={channel.title}
                  width={48}
                  height={48}
                  className="rounded-full"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">
                  {channel.title}
                </p>
                <p className="text-gray-400 text-sm truncate">
                  {channel.description}
                </p>
              </div>
              <button
                onClick={() => addChannel(channel.id)}
                disabled={adding === channel.id}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {adding === channel.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChannelList({
  channels,
  onChannelRemoved,
}: {
  channels: Channel[];
  onChannelRemoved: () => void;
}) {
  const [removing, setRemoving] = useState<string | null>(null);

  const removeChannel = async (channelId: string) => {
    setRemoving(channelId);
    try {
      await fetch(`/api/channels?channelId=${channelId}`, {
        method: "DELETE",
      });
      onChannelRemoved();
    } catch (error) {
      console.error("Remove channel failed:", error);
    } finally {
      setRemoving(null);
    }
  };

  if (channels.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-400">No channels added yet</p>
        <p className="text-gray-500 text-sm mt-2">
          Search for channels above to add them to your feed
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-semibold text-white mb-4">Your Channels</h2>
      <div className="space-y-2">
        {channels.map((channel) => (
          <div
            key={channel.id}
            className="flex items-center gap-4 p-3 bg-gray-700 rounded-lg"
          >
            {channel.thumbnail && (
              <Image
                src={channel.thumbnail}
                alt={channel.title}
                width={48}
                height={48}
                className="rounded-full"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{channel.title}</p>
              {channel.description && (
                <p className="text-gray-400 text-sm truncate">
                  {channel.description}
                </p>
              )}
            </div>
            <button
              onClick={() => removeChannel(channel.channelId)}
              disabled={removing === channel.channelId}
              className="p-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
            >
              {removing === channel.channelId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
