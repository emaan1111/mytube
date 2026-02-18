"use client";

import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { Clock, Check, ListPlus, EyeOff } from "lucide-react";
import { useState, memo } from "react";

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  isShort?: boolean;
  duration?: string;
  viewCount?: string;
  inWatchLater?: boolean;
}

// Helper to detect if a video is likely a Short
export function isShortVideo(video: Video): boolean {
  // First check the isShort flag from API (based on duration)
  if (video.isShort === true) return true;
  
  // Fallback: check for hashtags in title/description
  const title = video.title.toLowerCase();
  const description = video.description.toLowerCase();
  return (
    title.includes("#shorts") ||
    title.includes("#short") ||
    description.includes("#shorts")
  );
}

// Format duration from ISO 8601 to readable format (e.g., "12:34")
function formatDuration(duration?: string): string {
  if (!duration) return "";
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Format view count (e.g., "1.2M views")
function formatViewCount(viewCount?: string): string {
  if (!viewCount) return "";
  const count = parseInt(viewCount, 10);
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1).replace(/\.0$/, "")}M views`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}K views`;
  }
  return `${count} views`;
}

export const VideoCard = memo(function VideoCard({ 
  video, 
  isShort = false,
  onWatchLaterToggle,
  showRemoveWatchLater = false,
  onVideoSelect,
  onAddToQueue,
  canQueue = false,
  onNotInterested,
}: { 
  video: Video; 
  isShort?: boolean;
  onWatchLaterToggle?: (video: Video, add: boolean) => void;
  showRemoveWatchLater?: boolean;
  onVideoSelect?: (video: Video) => void;
  onAddToQueue?: (video: Video) => void;
  canQueue?: boolean;
  onNotInterested?: (video: Video) => void;
}) {
  const [isInWatchLater, setIsInWatchLater] = useState(video.inWatchLater || false);
  const [isAdding, setIsAdding] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  const openVideo = () => {
    onVideoSelect?.(video);
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToQueue?.(video);
  };

  const handleNotInterested = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch("/api/not-interested", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.id }),
      });
      setIsHidden(true);
      onNotInterested?.(video);
    } catch (error) {
      console.error("Failed to mark as not interested:", error);
    }
  };

  const handleWatchLater = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAdding) return;
    
    setIsAdding(true);
    try {
      if (isInWatchLater || showRemoveWatchLater) {
        // Remove from watch later
        await fetch(`/api/watch-later?videoId=${video.id}`, { method: "DELETE" });
        setIsInWatchLater(false);
        onWatchLaterToggle?.(video, false);
      } else {
        // Add to watch later
        await fetch("/api/watch-later", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ video }),
        });
        setIsInWatchLater(true);
        onWatchLaterToggle?.(video, true);
      }
    } catch (error) {
      console.error("Failed to update watch later:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const formattedDuration = formatDuration(video.duration);
  const timeAgo = formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true });

  // Hide if marked as not interested
  if (isHidden) {
    return null;
  }

  if (isShort) {
    // Shorts card - vertical style like YouTube
    return (
      <div
        className="group cursor-pointer relative"
      >
        <div 
          onClick={openVideo}
          className="relative aspect-[9/16] rounded-xl overflow-hidden bg-gray-800"
        >
          <Image
            src={video.thumbnail}
            alt={video.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-200"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          {/* Watch Later button */}
          <button
            onClick={handleWatchLater}
            className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black/90 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
            title={isInWatchLater || showRemoveWatchLater ? "Remove from Watch Later" : "Add to Watch Later"}
          >
            {isInWatchLater || showRemoveWatchLater ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Clock className="w-4 h-4 text-white" />
            )}
          </button>
          {canQueue && (
            <button
              onClick={handleAddToQueue}
              className="absolute top-2 right-12 p-1.5 bg-black/70 hover:bg-black/90 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
              title="Add to queue"
            >
              <ListPlus className="w-4 h-4 text-white" />
            </button>
          )}
          {/* Not Interested button */}
          <button
            onClick={handleNotInterested}
            className="absolute top-2 left-2 p-1.5 bg-black/70 hover:bg-red-600/90 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
            title="Not interested"
          >
            <EyeOff className="w-4 h-4 text-white" />
          </button>
          
          <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-white text-sm font-medium line-clamp-2">{video.title}</p>
          </div>
        </div>
        <div className="mt-2 px-1">
          <h3 className="text-white text-sm font-medium line-clamp-2 leading-tight">
            {video.title}
          </h3>
          <p className="text-gray-400 text-xs mt-1">{video.channelTitle}</p>
        </div>
      </div>
    );
  }

  // Regular video card - YouTube style
  return (
    <div
      className="group cursor-pointer"
    >
      {/* Thumbnail */}
      <div 
        onClick={openVideo}
        className="relative aspect-video rounded-xl overflow-hidden bg-gray-800"
      >
        <Image
          src={video.thumbnail}
          alt={video.title}
          fill
          className="object-cover group-hover:rounded-none transition-all duration-200"
        />
        {/* Duration badge */}
        {formattedDuration && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-medium px-1.5 py-0.5 rounded">
            {formattedDuration}
          </div>
        )}
        {/* Watch Later button */}
        <button
          onClick={handleWatchLater}
          className="absolute top-2 right-2 p-2 bg-black/70 hover:bg-black/90 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title={isInWatchLater || showRemoveWatchLater ? "Remove from Watch Later" : "Add to Watch Later"}
        >
          {isInWatchLater || showRemoveWatchLater ? (
            <Check className="w-5 h-5 text-green-400" />
          ) : (
            <Clock className="w-5 h-5 text-white" />
          )}
        </button>
        {canQueue && (
          <button
            onClick={handleAddToQueue}
            className="absolute top-2 right-12 p-2 bg-black/70 hover:bg-black/90 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
            title="Add to queue"
          >
            <ListPlus className="w-5 h-5 text-white" />
          </button>
        )}
        {/* Not Interested button */}
        <button
          onClick={handleNotInterested}
          className="absolute top-2 left-2 p-2 bg-black/70 hover:bg-red-600/90 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title="Not interested"
        >
          <EyeOff className="w-5 h-5 text-white" />
        </button>
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
      </div>
      
      {/* Video info */}
      <div onClick={openVideo} className="flex gap-3 mt-3">
        {/* Channel avatar placeholder */}
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm font-medium">
          {video.channelTitle.charAt(0).toUpperCase()}
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="text-black font-medium text-sm leading-tight line-clamp-2 group-hover:text-gray-700">
            {video.title}
          </h3>
          
          {/* Channel name */}
          <p className="text-gray-600 text-sm mt-1 hover:text-gray-800 line-clamp-1">
            {video.channelTitle}
          </p>
          
          {/* Views and time */}
          <p className="text-gray-600 text-sm">
            {video.viewCount && <span>{formatViewCount(video.viewCount)} • </span>}
            {timeAgo}
          </p>
        </div>
      </div>
    </div>
  );
});

export function VideoGrid({ 
  videos, 
  isShorts = false,
  onWatchLaterToggle,
  showRemoveWatchLater = false,
  onVideoSelect,
  onAddToQueue,
  canQueue = false,
  onNotInterested,
}: { 
  videos: Video[]; 
  isShorts?: boolean;
  onWatchLaterToggle?: (video: Video, add: boolean) => void;
  showRemoveWatchLater?: boolean;
  onVideoSelect?: (video: Video) => void;
  onAddToQueue?: (video: Video) => void;
  canQueue?: boolean;
  onNotInterested?: (video: Video) => void;
}) {
  if (videos.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-lg">
          {isShorts ? "No Shorts to display" : "No videos to display"}
        </p>
        <p className="text-gray-500 mt-2">
          Add some channels to see their latest {isShorts ? "Shorts" : "videos"} here
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        isShorts
          ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
          : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8"
      }
    >
      {videos.map((video) => (
        <VideoCard 
          key={video.id} 
          video={video} 
          isShort={isShorts}
          onWatchLaterToggle={onWatchLaterToggle}
          showRemoveWatchLater={showRemoveWatchLater}
          onVideoSelect={onVideoSelect}
          onAddToQueue={onAddToQueue}
          canQueue={canQueue}
          onNotInterested={onNotInterested}
        />
      ))}
    </div>
  );
}
