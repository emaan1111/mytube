"use client";

import { useState } from "react";
import Image from "next/image";
import { Search, Plus, X, Loader2, RefreshCw, Download, Clock, CheckCircle, AlertCircle } from "lucide-react";

interface Channel {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  thumbnail?: string;
  lastFetched?: string;
  videoCount?: number;
}

interface SearchResult {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
}

interface FetchStatus {
  channelId: string;
  loading: boolean;
  message?: string;
  error?: boolean;
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
  const [fetchStatus, setFetchStatus] = useState<Record<string, FetchStatus>>({});
  const [fetchAllStatus, setFetchAllStatus] = useState<{ loading: boolean; message?: string } | null>(null);

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

  const fetchVideosForChannel = async (channelId: string, months: number, refresh: boolean = false) => {
    setFetchStatus(prev => ({
      ...prev,
      [channelId]: { channelId, loading: true, message: refresh ? "Refreshing..." : `Fetching ${months} month(s)...` }
    }));

    try {
      const response = await fetch(`/api/channels/${channelId}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months, refresh }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch videos");
      }

      setFetchStatus(prev => ({
        ...prev,
        [channelId]: { 
          channelId, 
          loading: false, 
          message: data.message || `Added ${data.newVideosAdded} videos`,
          error: false
        }
      }));

      // Clear status after 5 seconds
      setTimeout(() => {
        setFetchStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[channelId];
          return newStatus;
        });
      }, 5000);

      onChannelRemoved(); // Refresh channel list to update video counts
    } catch (error: any) {
      setFetchStatus(prev => ({
        ...prev,
        [channelId]: { 
          channelId, 
          loading: false, 
          message: error.message || "Failed to fetch",
          error: true
        }
      }));
    }
  };

  const fetchAllChannels = async (months: number, refresh: boolean = false) => {
    setFetchAllStatus({ loading: true, message: refresh ? "Refreshing all channels..." : `Fetching ${months} month(s) for all channels...` });
    
    let totalNew = 0;
    let errors = 0;

    for (const channel of channels) {
      try {
        const response = await fetch(`/api/channels/${channel.channelId}/fetch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ months, refresh }),
        });

        const data = await response.json();

        if (response.ok) {
          totalNew += data.newVideosAdded || 0;
        } else {
          errors++;
        }
      } catch {
        errors++;
      }
    }

    setFetchAllStatus({ 
      loading: false, 
      message: `Done! Added ${totalNew} videos${errors > 0 ? ` (${errors} errors)` : ''}`
    });

    setTimeout(() => setFetchAllStatus(null), 5000);
    onChannelRemoved(); // Refresh
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
    <div className="space-y-6">
      {/* Bulk Actions */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Fetch Videos</h2>
        <p className="text-gray-400 text-sm mb-4">
          Fetch videos from YouTube and save them to your database. This uses your API quota.
        </p>
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => fetchAllChannels(1)}
            disabled={fetchAllStatus?.loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Last Month (All)
          </button>
          <button
            onClick={() => fetchAllChannels(3)}
            disabled={fetchAllStatus?.loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Last 3 Months (All)
          </button>
          <button
            onClick={() => fetchAllChannels(6)}
            disabled={fetchAllStatus?.loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Last 6 Months (All)
          </button>
          <button
            onClick={() => fetchAllChannels(0, true)}
            disabled={fetchAllStatus?.loading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Latest (All)
          </button>
        </div>

        {fetchAllStatus && (
          <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
            fetchAllStatus.loading ? "bg-blue-900/50 text-blue-300" : "bg-green-900/50 text-green-300"
          }`}>
            {fetchAllStatus.loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {fetchAllStatus.message}
          </div>
        )}
      </div>

      {/* Channel List */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Your Channels ({channels.length})</h2>
        <div className="space-y-3">
          {channels.map((channel) => {
            const status = fetchStatus[channel.channelId];
            
            return (
              <div
                key={channel.id}
                className="p-4 bg-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  {channel.thumbnail && (
                    <Image
                      src={channel.thumbnail}
                      alt={channel.title}
                      width={56}
                      height={56}
                      className="rounded-full"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{channel.title}</p>
                    <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                      {channel.videoCount !== undefined && (
                        <span>{channel.videoCount} videos</span>
                      )}
                      {channel.lastFetched && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(channel.lastFetched).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeChannel(channel.channelId)}
                    disabled={removing === channel.channelId}
                    className="p-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                    title="Remove channel"
                  >
                    {removing === channel.channelId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Individual channel fetch controls */}
                <div className="mt-3 pt-3 border-t border-gray-600 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500 mr-2">Fetch:</span>
                  <button
                    onClick={() => fetchVideosForChannel(channel.channelId, 1)}
                    disabled={status?.loading}
                    className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white rounded transition-colors"
                  >
                    1 mo
                  </button>
                  <button
                    onClick={() => fetchVideosForChannel(channel.channelId, 3)}
                    disabled={status?.loading}
                    className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white rounded transition-colors"
                  >
                    3 mo
                  </button>
                  <button
                    onClick={() => fetchVideosForChannel(channel.channelId, 6)}
                    disabled={status?.loading}
                    className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white rounded transition-colors"
                  >
                    6 mo
                  </button>
                  <button
                    onClick={() => fetchVideosForChannel(channel.channelId, 12)}
                    disabled={status?.loading}
                    className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white rounded transition-colors"
                  >
                    1 yr
                  </button>
                  <button
                    onClick={() => fetchVideosForChannel(channel.channelId, 0, true)}
                    disabled={status?.loading}
                    className="px-2 py-1 text-xs bg-green-700 hover:bg-green-600 disabled:bg-gray-700 text-white rounded transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    New
                  </button>
                  
                  {status && (
                    <span className={`ml-2 text-xs flex items-center gap-1 ${
                      status.loading ? "text-blue-400" : status.error ? "text-red-400" : "text-green-400"
                    }`}>
                      {status.loading && <Loader2 className="w-3 h-3 animate-spin" />}
                      {!status.loading && status.error && <AlertCircle className="w-3 h-3" />}
                      {!status.loading && !status.error && <CheckCircle className="w-3 h-3" />}
                      {status.message}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
