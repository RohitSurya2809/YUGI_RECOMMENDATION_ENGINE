import React, { useState } from 'react';
import YouTube from 'react-youtube';
import { Button } from "@/components/ui/button";

/**
 * YouTubePlayer component for embedding YouTube videos
 * @param {Object} props - Component props
 * @param {string} props.videoId - YouTube video ID
 * @param {Object} props.opts - YouTube player options
 * @returns {JSX.Element} YouTube player component
 */
const YouTubePlayer = ({ videoId, opts = {} }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Default options for the YouTube player
  const defaultOpts = {
    height: '100%',
    width: '100%',
    playerVars: {
      // https://developers.google.com/youtube/player_parameters
      autoplay: 1,
      modestbranding: 1,
      rel: 0,
    },
  };

  // Merge default options with provided options
  const playerOpts = { ...defaultOpts, ...opts };

  // Handle player ready event
  const onReady = (event) => {
    // Access to player in all event handlers via event.target
    setLoading(false);
    console.log('YouTube Player is ready');
  };

  // Handle player state changes
  const onStateChange = (event) => {
    // You can handle different states here
    // 0: ended, 1: playing, 2: paused, 3: buffering, 5: video cued
    if (event.data === 3) {
      setLoading(true); // Show loading state when buffering
    } else if (event.data === 1 || event.data === 2) {
      setLoading(false); // Hide loading when playing or paused
    }
    console.log('Player state changed:', event.data);
  };

  // Handle player errors
  const onError = (event) => {
    setError(true);
    setLoading(false);
    console.error('YouTube Player Error:', event.data);
  };

  return (
    <div className="youtube-player-container w-full h-full relative">
      {videoId ? (
        <>
          <YouTube
            videoId={videoId}
            opts={playerOpts}
            onReady={onReady}
            onStateChange={onStateChange}
            onError={onError}
            className="w-full h-full"
          />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80">
              <div className="text-destructive text-xl mb-2">⚠️</div>
              <p className="text-destructive">Error loading video</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={() => setError(false)}
              >
                Try Again
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center w-full h-full bg-muted text-muted-foreground">
          No video selected
        </div>
      )}
    </div>
  );
};

export default YouTubePlayer;