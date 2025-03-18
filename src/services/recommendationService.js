/**
 * Service for handling video recommendations and user watch history
 * This service communicates with the Python recommendation engine API
 */

/**
 * Get recommended videos based on a video ID or get general recommendations
 * @param {string|null} videoId - The ID of the video to base recommendations on (optional)
 * @param {number} limit - The number of recommendations to retrieve
 * @param {number} page - The page number for pagination (default: 1)
 * @returns {Promise<Object>} - A promise that resolves to an object with results and pagination info
 */
export const getRecommendedVideos = async (videoId = null, limit = 8, page = 1) => {
  try {
    // Build the API URL with query parameters
    const url = new URL('http://localhost:5000/api/recommendations');
    
    // Add query parameters if provided
    if (videoId) {
      url.searchParams.append('video_id', videoId);
    }
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('page', page.toString());
    
    // Make the API request with a timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Handle the new response format with pagination
    if (data && data.results) {
      return data;
    } else if (Array.isArray(data)) {
      // Handle backward compatibility with old API format
      return { results: data, pagination: { page: 1, limit, total_results: data.length } };
    } else {
      return { results: [], pagination: { page: 1, limit, total_results: 0 } };
    }
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return { results: [], pagination: { page: 1, limit, total_results: 0 } };
  }
};

/**
 * Track when a user views a video
 * @param {string} userId - The ID of the user
 * @param {Object} video - The video object that was viewed
 * @returns {Promise<boolean>} - A promise that resolves to true if successful
 */
export const trackVideoView = async (userId, video) => {
  try {
    const response = await fetch('http://localhost:5000/api/track-view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        video: video,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error tracking video view:', error);
    return false;
  }
};

/**
 * Get a user's watch history
 * @param {string} userId - The ID of the user
 * @param {number} limit - The maximum number of history items to retrieve
 * @returns {Promise<Array>} - A promise that resolves to an array of video objects
 */
export const getUserWatchHistory = async (userId, limit = 20) => {
  try {
    // Build the API URL with query parameters
    const url = new URL('http://localhost:5000/api/watch-history');
    url.searchParams.append('user_id', userId);
    url.searchParams.append('limit', limit.toString());
    
    // Make the API request
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching watch history:', error);
    return [];
  }
};