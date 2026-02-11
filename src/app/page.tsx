"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useRef, useCallback } from "react";
import { VideoGrid } from "@/components/VideoCard";
import {
  Loader2,
  Youtube,
  Film,
  Zap,
  Clock,
  X,
  Play,
  ListOrdered,
  SkipForward,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  isShort?: boolean;
  inWatchLater?: boolean;
  lastWatchedAt?: string;
  duration?: string;
}

interface Channel {
  id: string;
  channelId: string;
  title: string;
  thumbnail: string | null;
  isEnabled: boolean;
}

type TabType = "videos" | "shorts" | "watchLater" | "continue";

export default function Home() {
  const { data: session, status } = useSession();
  const [videos, setVideos] = useState<Video[]>([]);
  const [shorts, setShorts] = useState<Video[]>([]);
  const [watchLater, setWatchLater] = useState<Video[]>([]);
  const [continueWatching, setContinueWatching] = useState<Video[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("videos");
  const [videosPage, setVideosPage] = useState(1);
  const [shortsPage, setShortsPage] = useState(1);
  const [hasMoreVideos, setHasMoreVideos] = useState(true);
  const [hasMoreShorts, setHasMoreShorts] = useState(true);
  const [channelHasMore, setChannelHasMore] = useState<Record<string, boolean>>({});
  const [totalVideos, setTotalVideos] = useState(0);
  const [totalShorts, setTotalShorts] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [queueMode, setQueueMode] = useState(false);
  const [playQueue, setPlayQueue] = useState<Video[]>([]);
  const [filterNewThisWeek, setFilterNewThisWeek] = useState(false);
  const [filterUnder10Min, setFilterUnder10Min] = useState(false);
  const [filterUnwatchedOnly, setFilterUnwatchedOnly] = useState(false);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);

  const parseJsonSafe = async (response: Response): Promise<unknown | null> => {
    const raw = await response.text();
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error("Invalid JSON response:", error);
      return null;
    }
  };

  const fetchVideos = async (page: number, type: "videos" | "shorts", append = false) => {
    isFetchingRef.current = true;
    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const response = await fetch(`/api/videos?page=${page}&type=${type}`);
      const data = await parseJsonSafe(response);

      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data
            ? String(data.error)
            : "Failed to fetch videos";
        throw new Error(
          `${message} (status ${response.status} ${response.statusText})`
        );
      }

      if (!data || typeof data !== "object") {
        throw new Error("Invalid videos response payload");
      }

      const responseData = data as Record<string, unknown>;
      const videosData = Array.isArray(responseData.videos) ? responseData.videos : [];
      const hasMoreData = typeof responseData.hasMore === "boolean" ? responseData.hasMore : false;
      const channelHasMoreData =
        responseData.channelHasMore && typeof responseData.channelHasMore === "object"
          ? (responseData.channelHasMore as Record<string, boolean>)
          : {};
      const totalData = typeof responseData.total === "number" ? responseData.total : videosData.length;
      
      const mergeUniqueById = (prev: Video[], next: Video[]) => {
        const seen = new Set<string>();
        const merged: Video[] = [];
        for (const video of [...prev, ...next]) {
          if (!seen.has(video.id)) {
            seen.add(video.id);
            merged.push(video);
          }
        }
        return merged;
      };

      if (type === "videos") {
        setVideos(prev => append ? mergeUniqueById(prev, videosData) : videosData);
        setHasMoreVideos(hasMoreData);
        setChannelHasMore(channelHasMoreData);
        setTotalVideos(totalData);
      } else {
        setShorts(prev => append ? mergeUniqueById(prev, videosData) : videosData);
        setHasMoreShorts(hasMoreData);
        setChannelHasMore(channelHasMoreData);
        setTotalShorts(totalData);
      }
    } catch (error) {
      console.error("Failed to fetch videos:", error);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchWatchLater = async () => {
    try {
      const response = await fetch("/api/watch-later");
      const data = await response.json();
      setWatchLater(data);
    } catch (error) {
      console.error("Failed to fetch watch later:", error);
    }
  };

  const parseDurationSeconds = (duration?: string): number | null => {
    if (!duration) return null;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return null;
    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseInt(match[3] || "0", 10);
    return hours * 3600 + minutes * 60 + seconds;
  };

  const isNewThisWeek = (publishedAt: string): boolean => {
    const published = new Date(publishedAt);
    if (Number.isNaN(published.getTime())) return false;
    const diffMs = Date.now() - published.getTime();
    return diffMs <= 7 * 24 * 60 * 60 * 1000;
  };

  const fetchContinueWatching = async () => {
    try {
      const response = await fetch("/api/continue-watching", { cache: "no-store" });

      if (!response.ok) {
        console.error(
          "Failed to fetch continue watching:",
          response.status,
          response.statusText
        );
        setContinueWatching([]);
        return;
      }

      const data = await parseJsonSafe(response);
      setContinueWatching(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch continue watching:", error);
      setContinueWatching([]);
    }
  };

  const fetchChannels = async () => {
    try {
      const response = await fetch("/api/channels");
      const data = await response.json();
      setChannels(data);
    } catch (error) {
      console.error("Failed to fetch channels:", error);
    }
  };

  const handleChannelEnabledToggle = async (
    channelId: string,
    isEnabled: boolean
  ) => {
    try {
      const response = await fetch("/api/channels", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channelId, isEnabled }),
      });

      if (!response.ok) {
        const errorData = await parseJsonSafe(response);
        const message =
          errorData && typeof errorData === "object" && "error" in errorData
            ? String(errorData.error)
            : "Failed to update channel";
        throw new Error(
          `${message} (status ${response.status} ${response.statusText})`
        );
      }

      setChannels((prev) =>
        prev.map((channel) =>
          channel.channelId === channelId ? { ...channel, isEnabled } : channel
        )
      );

      if (!isEnabled && selectedChannel === channelId) {
        setSelectedChannel(null);
      }

      setVideosPage(1);
      setShortsPage(1);
      fetchVideos(1, "videos");
      fetchVideos(1, "shorts");
    } catch (error) {
      console.error("Failed to toggle channel:", error);
    }
  };

  // Initial load
  useEffect(() => {
    if (session) {
      fetchVideos(1, "videos");
      fetchVideos(1, "shorts");
      fetchWatchLater();
      fetchContinueWatching();
      fetchChannels();
    } else {
      setLoading(false);
    }
  }, [session]);

  // Handle watch later toggle
  const handleWatchLaterToggle = (video: Video, add: boolean) => {
    if (add) {
      setWatchLater(prev => [{ ...video, inWatchLater: true }, ...prev]);
    } else {
      setWatchLater(prev => prev.filter(v => v.id !== video.id));
    }
  };

  // Load more when scrolling
  const loadMore = useCallback(() => {
    if (
      loadingMore ||
      isFetchingRef.current ||
      activeTab === "watchLater" ||
      activeTab === "continue"
    )
      return;

    const canLoadVideos = selectedChannel
      ? channelHasMore[selectedChannel] ?? false
      : hasMoreVideos;
    const canLoadShorts = selectedChannel
      ? channelHasMore[selectedChannel] ?? false
      : hasMoreShorts;

    if (activeTab === "videos" && canLoadVideos) {
      const nextPage = videosPage + 1;
      setVideosPage(nextPage);
      isFetchingRef.current = true;
      fetchVideos(nextPage, "videos", true);
    } else if (activeTab === "shorts" && canLoadShorts) {
      const nextPage = shortsPage + 1;
      setShortsPage(nextPage);
      isFetchingRef.current = true;
      fetchVideos(nextPage, "shorts", true);
    }
  }, [
    activeTab,
    channelHasMore,
    hasMoreShorts,
    hasMoreVideos,
    loadingMore,
    selectedChannel,
    shortsPage,
    videosPage,
  ]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && !isFetchingRef.current) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMore, loading, loadingMore]);

  const enabledChannelIds = new Set(
    channels
      .filter((channel) => channel.isEnabled)
      .map((channel) => channel.channelId)
  );
  const hasEnabledChannels = channels.some((channel) => channel.isEnabled);

  // Filter videos by selected/enabled channels
  const filterByChannel = (videoList: Video[]) => {
    if (channels.length === 0) {
      if (!selectedChannel) return videoList;
      return videoList.filter((video) => video.channelId === selectedChannel);
    }

    const enabledOnly = videoList.filter((video) =>
      enabledChannelIds.has(video.channelId)
    );

    if (!selectedChannel) return enabledOnly;
    return enabledOnly.filter((video) => video.channelId === selectedChannel);
  };

  const filteredVideos = filterByChannel(videos);
  const filteredShorts = filterByChannel(shorts);
  const filteredWatchLater = filterByChannel(watchLater);
  const filteredContinue = filterByChannel(continueWatching);

  const watchedSet = new Set(continueWatching.map((video) => video.id));

  const applySmartFilters = (videoList: Video[]) => {
    let next = videoList;

    if (filterNewThisWeek) {
      next = next.filter((video) => isNewThisWeek(video.publishedAt));
    }

    if (filterUnder10Min) {
      next = next.filter((video) => {
        const seconds = parseDurationSeconds(video.duration);
        return seconds !== null && seconds <= 600;
      });
    }

    if (filterUnwatchedOnly && activeTab !== "continue") {
      next = next.filter((video) => !watchedSet.has(video.id));
    }

    return next;
  };

  const currentVideos = applySmartFilters(
    activeTab === "videos"
      ? filteredVideos
      : activeTab === "shorts"
        ? filteredShorts
        : activeTab === "watchLater"
          ? filteredWatchLater
          : filteredContinue
  );
  const hasMore = activeTab === "videos"
    ? (selectedChannel ? channelHasMore[selectedChannel] ?? false : hasMoreVideos)
    : activeTab === "shorts"
      ? (selectedChannel ? channelHasMore[selectedChannel] ?? false : hasMoreShorts)
      : false;
  const total =
    activeTab === "videos"
      ? filteredVideos.length
      : activeTab === "shorts"
        ? filteredShorts.length
        : activeTab === "watchLater"
          ? filteredWatchLater.length
          : filteredContinue.length;

  const closePlayer = useCallback(() => {
    setSelectedVideo(null);
  }, []);

  const playNextInQueue = useCallback(() => {
    setPlayQueue((prev) => {
      if (prev.length === 0) {
        setSelectedVideo(null);
        return prev;
      }

      const [nextVideo, ...rest] = prev;
      setSelectedVideo(nextVideo);
      return rest;
    });
  }, []);

  const startQueue = useCallback(() => {
    if (selectedVideo || playQueue.length === 0) {
      return;
    }
    playNextInQueue();
  }, [selectedVideo, playQueue.length, playNextInQueue]);

  const handleVideoSelect = useCallback(
    (video: Video) => {
      if (!queueMode) {
        setSelectedVideo(video);
        return;
      }

      if (!selectedVideo) {
        setSelectedVideo(video);
        return;
      }

      if (selectedVideo.id === video.id) {
        return;
      }

      setPlayQueue((prev) => {
        if (prev.some((queuedVideo) => queuedVideo.id === video.id)) {
          return prev;
        }
        return [...prev, video];
      });
    },
    [queueMode, selectedVideo]
  );

  const handleAddToQueue = useCallback(
    (video: Video) => {
      if (!queueMode) return;
      if (selectedVideo?.id === video.id) return;

      setPlayQueue((prev) => {
        if (prev.some((queuedVideo) => queuedVideo.id === video.id)) {
          return prev;
        }
        return [...prev, video];
      });
    },
    [queueMode, selectedVideo]
  );

  useEffect(() => {
    if (!selectedVideo) return;

    try {
      void fetch("/api/continue-watching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video: selectedVideo }),
        keepalive: true,
      });
    } catch (error) {
      console.error("Failed to record continue watching:", error);
    }

    setContinueWatching((prev) => {
      const seen = new Set<string>();
      const next = [
        { ...selectedVideo, lastWatchedAt: new Date().toISOString() },
        ...prev,
      ].filter((video) => {
        if (seen.has(video.id)) return false;
        seen.add(video.id);
        return true;
      });
      return next;
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePlayer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedVideo, closePlayer]);

  if (status === "loading" || (loading && videos.length === 0 && shorts.length === 0)) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Loader2 className="w-12 h-12 text-red-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
        <Youtube className="w-24 h-24 text-red-500 mb-6" />
        <h1 className="text-4xl font-bold text-white mb-4 text-center">
          Welcome to MyTube
        </h1>
        <p className="text-gray-400 text-lg mb-8 text-center max-w-md">
          Your personal YouTube experience. Sign in to add your favorite
          channels and view only the content you care about.
        </p>
        <p className="text-gray-500 text-sm">
          Sign in with Google to get started
        </p>
      </div>
    );
  }

  return (
    <div className="flex max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8 gap-6">
      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">Your Feed</h1>
            {selectedChannel && (
              <button
                onClick={() => setSelectedChannel(null)}
                className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
                Clear filter
              </button>
            )}
          </div>
          <Link
            href="/channels"
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
          >
            Manage Channels
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-gray-700">
          <button
            onClick={() => setActiveTab("videos")}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
              activeTab === "videos"
                ? "text-red-500 border-b-2 border-red-500"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Film className="w-5 h-5" />
            Videos
            {filteredVideos.length > 0 && (
              <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                {filteredVideos.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("shorts")}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
              activeTab === "shorts"
                ? "text-red-500 border-b-2 border-red-500"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Zap className="w-5 h-5" />
            Shorts
            {filteredShorts.length > 0 && (
              <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                {filteredShorts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("watchLater")}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
              activeTab === "watchLater"
                ? "text-red-500 border-b-2 border-red-500"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Clock className="w-5 h-5" />
            Watch Later
            {filteredWatchLater.length > 0 && (
              <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                {filteredWatchLater.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("continue")}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
              activeTab === "continue"
                ? "text-red-500 border-b-2 border-red-500"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Play className="w-5 h-5" />
            Continue
            {filteredContinue.length > 0 && (
              <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                {filteredContinue.length}
              </span>
            )}
          </button>
        </div>

        {/* Smart Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilterNewThisWeek((prev) => !prev)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              filterNewThisWeek
                ? "bg-red-600 text-white border-red-600"
                : "text-gray-300 border-gray-700 hover:border-gray-500"
            }`}
          >
            New this week
          </button>
          <button
            onClick={() => setFilterUnder10Min((prev) => !prev)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              filterUnder10Min
                ? "bg-red-600 text-white border-red-600"
                : "text-gray-300 border-gray-700 hover:border-gray-500"
            }`}
          >
            Under 10 minutes
          </button>
          <button
            onClick={() =>
              setQueueMode((prev) => {
                if (prev) {
                  setPlayQueue([]);
                }
                return !prev;
              })
            }
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors flex items-center gap-1 ${
              queueMode
                ? "bg-red-600 text-white border-red-600"
                : "text-gray-300 border-gray-700 hover:border-gray-500"
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            Queue mode
          </button>
          <button
            onClick={() => setFilterUnwatchedOnly((prev) => !prev)}
            disabled={activeTab === "continue"}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              activeTab === "continue"
                ? "text-gray-500 border-gray-800 cursor-not-allowed"
                : filterUnwatchedOnly
                  ? "bg-red-600 text-white border-red-600"
                  : "text-gray-300 border-gray-700 hover:border-gray-500"
            }`}
          >
            Unwatched only
          </button>
        </div>

        {queueMode && (
          <div className="mb-6 rounded-xl border border-gray-700 bg-gray-900/60 p-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-300">
              Queue: <span className="font-semibold text-white">{playQueue.length}</span> upcoming
            </span>
            {!selectedVideo && playQueue.length > 0 && (
              <button
                onClick={startQueue}
                className="px-3 py-1.5 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Start queue
              </button>
            )}
            {selectedVideo && playQueue.length > 0 && (
              <button
                onClick={playNextInQueue}
                className="px-3 py-1.5 text-sm rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors flex items-center gap-1"
              >
                <SkipForward className="w-4 h-4" />
                Next ({playQueue.length})
              </button>
            )}
            {playQueue.length > 0 && (
              <button
                onClick={() => setPlayQueue([])}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-600 text-gray-300 hover:text-white hover:border-gray-500 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Clear queue
              </button>
            )}
          </div>
        )}

        {currentVideos.length === 0 && !loading ? (
          <div className="text-center py-16">
            {selectedChannel ? (
              <>
                <Youtube className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">
                  No {activeTab === "shorts" ? "Shorts" : activeTab === "continue" ? "videos" : "videos"} from this channel
                </p>
                <button
                  onClick={() => setSelectedChannel(null)}
                  className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Show all channels
                </button>
              </>
            ) : activeTab === "watchLater" ? (
              <>
                <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No videos in Watch Later</p>
                <p className="text-gray-500 mt-2 mb-6">
                  Hover over videos and click the clock icon to save them for later
                </p>
              </>
            ) : activeTab === "continue" ? (
              <>
                <Play className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">Nothing to continue</p>
                <p className="text-gray-500 mt-2 mb-6">
                  Start watching videos and they will appear here
                </p>
              </>
            ) : (
              <>
                <Youtube className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">
                  {channels.length > 0 && !hasEnabledChannels
                    ? "All channels are unticked"
                    : activeTab === "videos"
                      ? "No videos in your feed"
                      : "No Shorts in your feed"}
                </p>
                <p className="text-gray-500 mt-2 mb-6">
                  {channels.length > 0 && !hasEnabledChannels
                    ? "Tick at least one channel from the right sidebar to see content."
                    : `Add some channels to start seeing their ${
                        activeTab === "videos" ? "videos" : "Shorts"
                      } here`}
                </p>
                <Link
                  href="/channels"
                  className="inline-block px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Add Channels
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            <VideoGrid 
              videos={currentVideos} 
              isShorts={activeTab === "shorts"}
              onWatchLaterToggle={handleWatchLaterToggle}
              showRemoveWatchLater={activeTab === "watchLater"}
              onVideoSelect={handleVideoSelect}
              onAddToQueue={handleAddToQueue}
              canQueue={queueMode}
            />
            
            {/* Load more trigger */}
            {activeTab !== "watchLater" && activeTab !== "continue" && (
              <div ref={loadMoreRef} className="py-8 flex justify-center">
                {loadingMore && (
                  <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                )}
                {!hasMore && currentVideos.length > 0 && (
                  <p className="text-gray-500">No more {activeTab} to load</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Right Sidebar - Channels */}
      {channels.length > 0 && (
        <div className="hidden lg:block w-72 flex-shrink-0">
          <div className="sticky top-24 bg-gray-900 rounded-2xl p-5 shadow-xl border border-gray-700">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">Your Channels</h2>
              <span className="text-xs text-gray-300 bg-gray-700 px-2.5 py-1 rounded-full font-medium">
                {channels.filter((c) => c.isEnabled).length}/{channels.length}
              </span>
            </div>
            
            <div className="space-y-1.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1 scrollbar-thin">
              {/* All Channels option */}
              <button
                onClick={() => setSelectedChannel(null)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                  !selectedChannel
                    ? "bg-red-600 text-white"
                    : "bg-gray-800 hover:bg-gray-700 text-white"
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  !selectedChannel ? "bg-red-700" : "bg-gray-700"
                }`}>
                  <Youtube className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium">
                  All Channels
                </span>
              </button>
              
              <div className="h-px bg-gray-700 my-3" />
              
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className={`group flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 ${
                    selectedChannel === channel.channelId
                      ? "bg-red-600 text-white"
                      : channel.isEnabled
                        ? "bg-gray-800 hover:bg-gray-700 text-white"
                        : "bg-gray-800/50 text-gray-500"
                  }`}
                >
                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleChannelEnabledToggle(channel.channelId, !channel.isEnabled)}
                    className={`relative w-12 h-7 rounded-full transition-all duration-300 flex-shrink-0 border-2 ${
                      channel.isEnabled 
                        ? "bg-green-500 border-green-400" 
                        : "bg-gray-500 border-gray-400"
                    }`}
                    aria-label={`Toggle ${channel.title}`}
                  >
                    <span 
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-lg transition-all duration-300 ${
                        channel.isEnabled ? "left-5" : "left-0.5"
                      }`}
                    />
                  </button>
                  
                  {/* Channel Info */}
                  <button
                    onClick={() => channel.isEnabled && setSelectedChannel(channel.channelId)}
                    disabled={!channel.isEnabled}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed"
                  >
                    <div className="relative flex-shrink-0">
                      {channel.thumbnail ? (
                        <Image
                          src={channel.thumbnail}
                          alt={channel.title}
                          width={36}
                          height={36}
                          className={`rounded-full transition-all ${
                            channel.isEnabled ? "" : "grayscale opacity-50"
                          }`}
                        />
                      ) : (
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                          channel.isEnabled
                            ? "bg-gray-600 text-white"
                            : "bg-gray-700 text-gray-500"
                        }`}>
                          {channel.title.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className={`text-sm font-medium truncate ${
                      !channel.isEnabled ? "line-through text-gray-500" : ""
                    }`}>
                      {channel.title}
                    </span>
                  </button>
                </div>
              ))}
            </div>
            
            {/* Manage Channels Link */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <Link 
                href="/channels" 
                className="flex items-center justify-center gap-2 w-full py-2.5 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-all duration-200"
              >
                <span>Manage Channels</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}

      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={closePlayer}
        >
          <div
            className="relative w-full max-w-5xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={closePlayer}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
              aria-label="Close player"
            >
              <X className="w-7 h-7" />
            </button>
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${selectedVideo.id}?autoplay=1&rel=0`}
                title={selectedVideo.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="mt-3">
              <h2 className="text-white text-lg font-semibold line-clamp-2">
                {selectedVideo.title}
              </h2>
              <p className="text-gray-300 text-sm mt-1">{selectedVideo.channelTitle}</p>
              {queueMode && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {playQueue.length} in queue
                  </span>
                  {playQueue.length > 0 && (
                    <button
                      onClick={playNextInQueue}
                      className="px-2.5 py-1 text-xs rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                    >
                      Play next
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
