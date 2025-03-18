import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import ThemeToggle from './ThemeToggle';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { getRecommendedVideos, trackVideoView, getUserWatchHistory } from '../services/recommendationService';
import YouTubePlayer from './YouTubePlayer';

// Mock data for videos
const MOCK_VIDEOS = [
  {
    id: 1,
    title: 'How to Build a React App in 10 Minutes',
    thumbnail: 'https://i.imgur.com/8TePgDQ.jpg',
    channel: 'CodeMaster',
    views: '120K views',
    timestamp: '2 days ago',
  },  
  {
    id: 2,
    title: 'Learn Tailwind CSS - Full Course for Beginners',
    thumbnail: 'https://i.imgur.com/JR0SMXw.jpg',
    channel: 'CSS Wizards',
    views: '85K views',
    timestamp: '1 week ago',
  },
  {
    id: 3,
    title: 'JavaScript ES6 Features You Need to Know',
    thumbnail: 'https://i.imgur.com/QNaImSS.jpg',
    channel: 'JS Enthusiast',
    views: '230K views',
    timestamp: '3 weeks ago',
  },
  {
    id: 4,
    title: 'Building a Full-Stack App with Supabase',
    thumbnail: 'https://i.imgur.com/7YT3Nkl.jpg',
    channel: 'Supabase Official',
    views: '45K views',
    timestamp: '5 days ago',
  },
  {
    id: 5,
    title: 'UI/UX Design Principles for Developers',
    thumbnail: 'https://i.imgur.com/KLDBTvv.jpg',
    channel: 'Design Matters',
    views: '78K views',
    timestamp: '2 weeks ago',
  },
  {
    id: 6,
    title: 'Advanced React Hooks Tutorial',
    thumbnail: 'https://i.imgur.com/9YQjlfi.jpg',
    channel: 'React Masters',
    views: '112K views',
    timestamp: '4 days ago',
  },
  {
    id: 7,
    title: 'Building Responsive Layouts with Flexbox',
    thumbnail: 'https://i.imgur.com/VXmFJDr.jpg',
    channel: 'CSS Wizards',
    views: '67K views',
    timestamp: '1 month ago',
  },
  {
    id: 8,
    title: 'State Management in React Applications',
    thumbnail: 'https://i.imgur.com/QNaImSS.jpg',
    channel: 'React Masters',
    views: '95K views',
    timestamp: '2 weeks ago',
  },
];

// Mock data for sidebar categories
const SIDEBAR_ITEMS = [
  { id: 1, name: 'Home', icon: '🏠' },
  { id: 2, name: 'Trending', icon: '🔥' },
  { id: 3, name: 'Subscriptions', icon: '📥' },
  { id: 4, name: 'Library', icon: '📚' },
  { id: 5, name: 'History', icon: '⏱️' },
  { id: 6, name: 'Your Videos', icon: '🎬' },
  { id: 7, name: 'Watch Later', icon: '⏰' },
  { id: 8, name: 'Liked Videos', icon: '👍' },
];

const VideoCard = ({ video, onVideoClick }) => {
  // Ensure we have all required fields with fallbacks
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [channelLoading, setChannelLoading] = useState(false);
  
  // Process channel information with better fallbacks
  let channelName = 'Unknown Channel';
  if (video.channel_name) {
    channelName = video.channel_name;
  } else if (video.channel) {
    channelName = video.channel;
  }
  
  const videoData = {
    id: video.id,
    title: video.title || 'Untitled Video',
    thumbnail: video.thumbnail || 'https://i.imgur.com/8TePgDQ.jpg', // Default thumbnail
    channel: channelName,
    views: video.views || '0 views',
    timestamp: video.timestamp || 'Unknown time'
  };

  // Reset loading state when video changes
  useEffect(() => {
    setImageLoading(true);
    setImageError(false);
  }, [video.id]);

  return (
    <Card 
      className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
      onClick={() => onVideoClick(video)}
    >
      <div className="aspect-video overflow-hidden bg-muted relative">
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <img 
          src={videoData.thumbnail} 
          alt={videoData.title} 
          className={`w-full h-full object-cover transition-transform duration-300 hover:scale-105 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={() => setImageLoading(false)}
          onError={(e) => {
            setImageError(true);
            setImageLoading(false);
            // Try different YouTube thumbnail formats in sequence
            if (videoData.id && typeof videoData.id === 'string' && videoData.id.length >= 11) {
              // First try hqdefault
              e.target.src = `https://i.ytimg.com/vi/${videoData.id}/hqdefault.jpg`;
              // If that fails, the onError will fire again and we'll try mqdefault
              e.target.onerror = () => {
                e.target.src = `https://i.ytimg.com/vi/${videoData.id}/mqdefault.jpg`;
                // If that fails too, use our default image
                e.target.onerror = () => {
                  e.target.src = 'https://i.imgur.com/8TePgDQ.jpg';
                  e.target.onerror = null; // Prevent infinite loop
                };
              };
            } else {
              // Fallback to a default thumbnail
              e.target.src = 'https://i.imgur.com/8TePgDQ.jpg';
              e.target.onerror = null; // Prevent infinite loop
            }
          }}
        />
      </div>
      <CardContent className="p-3">
        <h3 className="font-medium line-clamp-2 text-sm mb-1">{videoData.title}</h3>
        <p className="text-muted-foreground text-xs">{videoData.channel}</p>
        <div className="flex text-xs text-muted-foreground mt-1">
          <span>{videoData.views}</span>
          <span className="mx-1">•</span>
          <span>{videoData.timestamp}</span>
        </div>
      </CardContent>
    </Card>
  );
};

const HomePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [recommendedVideos, setRecommendedVideos] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [watchHistory, setWatchHistory] = useState([]);
  const [watchHistoryLoading, setWatchHistoryLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoTransitioning, setVideoTransitioning] = useState(false);

  useEffect(() => {
    // Check for active session on component mount
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUser(user);
      } else {
        // Redirect to signin if no active session
        navigate('/signin');
      }
      setLoading(false);
    };

    getUser();

    // Set up auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          navigate('/signin');
        } else if (session && event === 'SIGNED_IN') {
          setUser(session.user);
        }
      }
    );

    // Cleanup listener on unmount
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);
  
  // Load watch history and recommendations when user changes
  useEffect(() => {
    const loadUserData = async () => {
      if (user) {
        try {
          // Load user's watch history
          setWatchHistoryLoading(true);
          const history = await getUserWatchHistory(user.id);
          setWatchHistory(history);
          setWatchHistoryLoading(false);
          
          // Get recommendations from API
          setRecommendationsLoading(true);
          const recommendationsResponse = await getRecommendedVideos(null, 8, 1);
          
          // Check if we got valid recommendations back
          if (recommendationsResponse && recommendationsResponse.results && 
              Array.isArray(recommendationsResponse.results) && 
              recommendationsResponse.results.length > 0) {
            console.log('Received recommendations:', recommendationsResponse.results);
            setRecommendedVideos(recommendationsResponse.results);
          } else {
            // If no valid recommendations, fall back to mock data
            console.log('No valid recommendations returned, using mock data');
            setRecommendedVideos(MOCK_VIDEOS);
          }
          setRecommendationsLoading(false);
        } catch (error) {
          console.error('Error loading user data:', error);
          // Fall back to mock data on error
          setRecommendedVideos(MOCK_VIDEOS);
          setWatchHistoryLoading(false);
          setRecommendationsLoading(false);
        }
      }
    };
    
    loadUserData();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      // Navigation handled by auth state listener
    } catch (error) {
      console.error('Error signing out:', error.message);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  
  // Helper function to ensure we have a valid YouTube video ID
  const getYouTubeVideoId = (video) => {
    if (!video) return null;
    
    // If the video object has an id property that looks like a YouTube ID, use it directly
    if (video.id && typeof video.id === 'string' && video.id.length >= 11) {
      return video.id;
    }
    
    // If the video has a link property that contains a YouTube URL, extract the ID
    if (video.link && typeof video.link === 'string') {
      const match = video.link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // For mock videos with numeric IDs, return a default YouTube ID
    if (typeof video.id === 'number') {
      // Map of mock video IDs to actual YouTube video IDs
      const mockIdMap = {
        1: 'dQw4w9WgXcQ', // Rick Astley - Never Gonna Give You Up
        2: 'jNQXAC9IVRw', // Me at the zoo
        3: 'TcMBFSGVi1c', // Avengers: Endgame Trailer
        4: '8jPQjjsBbIc', // Supabase in 100 Seconds
        5: 'c0bsKc4tiuY', // UI/UX Design Tutorial
        6: 'TNhaISOUy6Q', // React Hooks Tutorial
        7: 'K74l26pE4YA', // CSS Flexbox Tutorial
        8: 'zuRd_Eneuk8'  // React State Management
      };
      return mockIdMap[video.id] || 'dQw4w9WgXcQ';
    }
    
    // Default fallback
    return null;
  };

  const handleVideoClick = async (video) => {
    // Set transition state to trigger animation
    setVideoTransitioning(true);
    
    // Short delay to allow transition to start
    setTimeout(() => {
      // Set the selected video
      setSelectedVideo(video);
      setVideoTransitioning(false);
    }, 300);
    
    if (user) {
      try {
        // Track this view in the user's history
        await trackVideoView(user.id, video);
        
        // Update local watch history
        const updatedHistory = await getUserWatchHistory(user.id);
        setWatchHistory(updatedHistory);
        
        // Get new recommendations based on the selected video
        const videoId = getYouTubeVideoId(video);
        
        if (videoId) {
          try {
            // Use the YouTube video ID for recommendations
            setRecommendationsLoading(true);
            const newRecommendationsResponse = await getRecommendedVideos(videoId, 8, 1);
            
            // Check if we got valid recommendations back
            if (newRecommendationsResponse && newRecommendationsResponse.results && 
                Array.isArray(newRecommendationsResponse.results) && 
                newRecommendationsResponse.results.length > 0) {
              setRecommendedVideos(newRecommendationsResponse.results);
            } else {
              // If no valid recommendations, fall back to mock data
              console.log('No valid recommendations returned for video ID:', videoId);
              setRecommendedVideos(MOCK_VIDEOS);
            }
            setRecommendationsLoading(false);
          } catch (recError) {
            console.error('Error getting recommendations:', recError);
            // Fall back to mock data on error
            setRecommendedVideos(MOCK_VIDEOS);
            setRecommendationsLoading(false);
          }
        } else {
          // If no valid video ID, use null to get general recommendations
          setRecommendationsLoading(true);
          const newRecommendationsResponse = await getRecommendedVideos(null, 8, 1);
          if (newRecommendationsResponse && newRecommendationsResponse.results && 
              Array.isArray(newRecommendationsResponse.results) && 
              newRecommendationsResponse.results.length > 0) {
            setRecommendedVideos(newRecommendationsResponse.results);
          } else {
            setRecommendedVideos(MOCK_VIDEOS);
          }
          setRecommendationsLoading(false);
        }
      } catch (error) {
        console.error('Error handling video click:', error);
        setRecommendationsLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-xl">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="mr-2">
            <span className="text-xl">☰</span>
          </Button>
          <div className="flex items-center">
            <span className="text-primary text-xl font-bold">YUGI</span>
          </div>
        </div>
        
        <div className="flex-1 max-w-2xl mx-4">
          <div className="relative flex items-center">
            <Input
              type="search"
              placeholder="Search"
              className="w-full rounded-r-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button className="rounded-l-none" variant="secondary">
              🔍
            </Button>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <div className="flex items-center space-x-2">
            <span className="text-sm hidden sm:inline">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 h-[calc(100vh-57px)] bg-background border-r border-border sticky top-[57px] overflow-y-auto`}>
          <nav className="p-2">
            <ul className="space-y-1">
              {SIDEBAR_ITEMS.map((item) => (
                <li key={item.id}>
                  <Button 
                    variant="ghost" 
                    className={`w-full justify-${sidebarOpen ? 'start' : 'center'} px-3 py-2`}
                  >
                    <span className="text-xl mr-3">{item.icon}</span>
                    {sidebarOpen && <span>{item.name}</span>}
                  </Button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 p-4 ${sidebarOpen ? 'ml-0' : 'ml-0'} transition-all duration-300`}>
          <div className={`transition-opacity duration-300 ${videoTransitioning ? 'opacity-0' : 'opacity-100'}`}>
            {selectedVideo ? (
              <div className="mb-6">
                <Button 
                  variant="ghost" 
                  className="mb-4" 
                  onClick={() => {
                    setVideoTransitioning(true);
                    setTimeout(() => {
                      setSelectedVideo(null);
                      setVideoTransitioning(false);
                    }, 300);
                  }}
                >
                  ← Back to recommendations
                </Button>
                
                <div className="aspect-video w-full max-w-4xl mx-auto bg-muted mb-4">
                  <YouTubePlayer 
                    videoId={getYouTubeVideoId(selectedVideo)} 
                    opts={{
                      height: '100%',
                      width: '100%',
                      playerVars: {
                        autoplay: 1,
                      },
                    }}
                  />
                </div>
                
                <div className="max-w-4xl mx-auto">
                  <h1 className="text-2xl font-bold mb-2">{selectedVideo.title}</h1>
                  <p className="text-muted-foreground mb-4">{selectedVideo.channel} • {selectedVideo.views} • {selectedVideo.timestamp}</p>
                  
                  <div className="border-t border-border pt-4 mt-6">
                    <h2 className="text-xl font-bold mb-4">More recommendations</h2>
                    {recommendationsLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {recommendedVideos.slice(0, 4).map((video) => (
                          <VideoCard key={video.id} video={video} onVideoClick={handleVideoClick} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-4">Recommended for you</h2>
                {recommendationsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {(recommendedVideos.length > 0 ? recommendedVideos : MOCK_VIDEOS).map((video) => (
                      <VideoCard key={video.id} video={video} onVideoClick={handleVideoClick} />
                    ))}
                  </div>
                )}
                
                {watchHistory.length > 0 && (
                  <div className="mt-8">
                    <h2 className="text-xl font-bold mb-4">Recently watched</h2>
                    {watchHistoryLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {watchHistory.slice(0, 4).map((video) => (
                          <VideoCard key={video.id} video={video} onVideoClick={handleVideoClick} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default HomePage;