from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
import os
import pandas as pd
import numpy as np
import json
import time
from functools import wraps
import threading
# Import the recommendation function from the recommendation module
from src.services.recommendation import hybrid_recommendation, df, cosine_sim

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# We're now importing df and cosine_sim from recommendation.py

# Store user watch history
user_watch_history = {}

# API response cache with improved structure and memory management
from collections import OrderedDict

class APICache(OrderedDict):
    def __init__(self, capacity=1000):
        super().__init__()
        self.capacity = capacity

    def get(self, key):
        if key not in self:
            return None
        self.move_to_end(key)
        return self[key]

    def put(self, key, value):
        if key in self:
            self.move_to_end(key)
        self[key] = value
        if len(self) > self.capacity:
            self.popitem(last=False)

api_cache = APICache()
API_CACHE_EXPIRATION = 600  # 10 minutes - increased cache duration

# Background processing lock to prevent multiple heavy operations
processing_lock = threading.Lock()

# Improved caching decorator for API responses
def cache_response(expiration=API_CACHE_EXPIRATION):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Create a more specific cache key from the request URL and relevant query parameters
            # This avoids cache misses due to irrelevant parameters
            base_url = request.path
            query_params = {}
            
            # Only include relevant parameters in the cache key
            relevant_params = ['video_id', 'limit', 'page']
            for param in relevant_params:
                if param in request.args:
                    query_params[param] = request.args.get(param)
            
            # Create a deterministic cache key
            cache_key = f"{base_url}?{json.dumps(query_params, sort_keys=True)}"
            current_time = time.time()
            
            # Return cached response if available and not expired
            if cache_key in api_cache:
                cache_entry = api_cache[cache_key]
                if current_time - cache_entry['timestamp'] < expiration:
                    response = make_response(cache_entry['data'])
                    response.headers['X-Cache'] = 'HIT'
                    return response
            
            # Generate the response if not in cache or expired
            response = f(*args, **kwargs)
            
            # Cache the response
            api_cache[cache_key] = {
                'data': response.get_data(),
                'timestamp': current_time
            }
            
            # Clean up old cache entries periodically (only do this 10% of the time to reduce overhead)
            if hash(cache_key) % 10 == 0:
                for key in list(api_cache.keys()):
                    if current_time - api_cache[key]['timestamp'] > expiration:
                        del api_cache[key]
                    
            response.headers['X-Cache'] = 'MISS'
            return response
        return decorated_function
    return decorator

# We're now importing hybrid_recommendation from recommendation.py

@app.route('/api/recommendations', methods=['GET'])
@cache_response(expiration=600)  # Cache recommendations for 10 minutes
def get_recommendations():
    # Extract and validate parameters
    video_id = request.args.get('video_id')
    try:
        top_n = min(int(request.args.get('limit', 5)), 20)  # Limit max recommendations to 20
        page = max(int(request.args.get('page', 1)), 1)  # Pagination support, default to page 1
    except ValueError:
        return jsonify({"error": "Invalid parameters"}), 400
    
    # Calculate offset for pagination
    offset = (page - 1) * top_n
    
    # Use a processing lock to prevent multiple heavy operations at once
    with processing_lock:
        if not video_id:
            # If no video_id is provided, return random recommendations with pagination
            # Pre-filter the dataset to avoid processing the entire dataframe
            filtered_df = df.dropna(subset=['v_id', 'v_title']).sample(min(top_n * 2, len(df)))
            
            # Apply pagination
            recommendations = [
                {
                    "id": row['v_id'],
                    "title": row['v_title'],
                    "link": "https://www.youtube.com/watch?v=" + row['v_id'],
                    "description": row['v_description'][:200] if pd.notna(row['v_description']) else "",  # Limit description length
                    "tags": row['tags'] if pd.notna(row['tags']) else "",
                    "category": row['category_id'],
                    "thumbnail": f"https://img.youtube.com/vi/{row['v_id']}/mqdefault.jpg",
                    "channel": row['channel_name'] if 'channel_name' in row and pd.notna(row['channel_name']) else "YouTube Creator",
                    "views": f"{(hash(row['v_id']) % 200) + 10}K views",
                    "timestamp": f"{(hash(row['v_id']) % 30) + 1} days ago"
                }
                for _, row in filtered_df.iloc[offset:offset+top_n].iterrows()
            ]
        else:
            # Check if the video_id exists in our dataset
            if not df[df['v_id'] == video_id].empty:
                try:
                    # Get recommendations based on the video_id from our dataset
                    raw_recommendations = hybrid_recommendation(video_id, top_n * 2)  # Get more recommendations for pagination
                    
                    # Apply pagination to raw recommendations
                    paginated_recommendations = raw_recommendations[offset:offset+top_n] if offset < len(raw_recommendations) else []
                    
                    # Format the recommendations for the frontend
                    recommendations = []
                    for rec in paginated_recommendations:
                        if isinstance(rec, dict) and "error" in rec:
                            return jsonify({"error": rec["error"]}), 404
                        
                        # Create a new dict to avoid modifying the original
                        formatted_rec = rec.copy()
                        
                        # Add data for frontend display
                        formatted_rec["thumbnail"] = f"https://img.youtube.com/vi/{rec['id']}/mqdefault.jpg"
                        
                        # Get channel name from recommendation or dataset if available
                        if 'channel_name' in rec and rec['channel_name']:
                            formatted_rec["channel"] = rec['channel_name']
                        else:
                            # Use vectorized operations for better performance
                            video_data = df[df['v_id'] == rec['id']]
                            if not video_data.empty and 'channel_name' in video_data.columns and pd.notna(video_data['channel_name'].iloc[0]):
                                formatted_rec["channel"] = video_data['channel_name'].iloc[0]
                            else:
                                formatted_rec["channel"] = "YouTube Creator"
                        
                        # Remove channel_name to avoid duplication
                        if 'channel_name' in formatted_rec:
                            del formatted_rec['channel_name']
                        
                        # Limit description length to reduce payload size
                        if 'description' in formatted_rec and formatted_rec['description']:
                            formatted_rec["description"] = formatted_rec["description"][:200]
                            
                        formatted_rec["views"] = f"{(hash(rec['id']) % 200) + 10}K views"
                        formatted_rec["timestamp"] = f"{(hash(rec['id']) % 30) + 1} days ago"
                        recommendations.append(formatted_rec)
                except Exception as e:
                    print(f"Error generating recommendations: {e}")
                    # Fall back to random recommendations on error
                    filtered_df = df.dropna(subset=['v_id', 'v_title']).sample(min(top_n * 2, len(df)))
                    recommendations = [
                        {
                            "id": row['v_id'],
                            "title": row['v_title'],
                            "link": "https://www.youtube.com/watch?v=" + row['v_id'],
                            "description": row['v_description'][:200] if pd.notna(row['v_description']) else "",
                            "tags": row['tags'] if pd.notna(row['tags']) else "",
                            "category": row['category_id'],
                            "thumbnail": f"https://img.youtube.com/vi/{row['v_id']}/mqdefault.jpg",
                            "channel": row['channel_name'] if 'channel_name' in row and pd.notna(row['channel_name']) else "YouTube Creator",
                            "views": f"{(hash(row['v_id']) % 200) + 10}K views",
                            "timestamp": f"{(hash(row['v_id']) % 30) + 1} days ago"
                        }
                        for _, row in filtered_df.iloc[offset:offset+top_n].iterrows()
                    ]
            else:
                # If the video_id is not in our dataset, return random recommendations
                print(f"Video ID {video_id} not found in dataset, returning random recommendations")
                filtered_df = df.dropna(subset=['v_id', 'v_title']).sample(min(top_n * 2, len(df)))
                recommendations = [
                    {
                        "id": row['v_id'],
                        "title": row['v_title'],
                        "link": "https://www.youtube.com/watch?v=" + row['v_id'],
                        "description": row['v_description'][:200] if pd.notna(row['v_description']) else "",
                        "tags": row['tags'] if pd.notna(row['tags']) else "",
                        "category": row['category_id'],
                        "thumbnail": f"https://img.youtube.com/vi/{row['v_id']}/mqdefault.jpg",
                        "channel": row['channel_name'] if 'channel_name' in row and pd.notna(row['channel_name']) else "YouTube Creator",
                        "views": f"{(hash(row['v_id']) % 200) + 10}K views",
                        "timestamp": f"{(hash(row['v_id']) % 30) + 1} days ago"
                    }
                    for _, row in filtered_df.iloc[offset:offset+top_n].iterrows()
                ]
    
    # Add pagination metadata
    response = {
        "results": recommendations,
        "pagination": {
            "page": page,
            "limit": top_n,
            "total_results": len(recommendations)
        }
    }
    
    return jsonify(response)

@app.route('/api/track-view', methods=['POST'])
def track_view():
    data = request.json
    user_id = data.get('user_id')
    video = data.get('video')
    
    if not user_id or not video or not video.get('id'):
        return jsonify({"error": "Missing required parameters"}), 400
    
    # Store the view in the user's watch history
    if user_id not in user_watch_history:
        user_watch_history[user_id] = []
    
    # Check if the video is already in the history
    if not any(v.get('id') == video['id'] for v in user_watch_history[user_id]):
        video['watched_at'] = pd.Timestamp.now().isoformat()
        user_watch_history[user_id].append(video)
        
        # Keep only the most recent 20 videos
        user_watch_history[user_id] = sorted(
            user_watch_history[user_id],
            key=lambda x: x.get('watched_at', ''),
            reverse=True
        )[:20]
    
    return jsonify({"success": True})

@app.route('/api/watch-history', methods=['GET'])
def get_watch_history():
    user_id = request.args.get('user_id')
    limit = int(request.args.get('limit', 20))
    
    if not user_id:
        return jsonify({"error": "Missing user_id parameter"}), 400
    
    # Get the user's watch history
    history = user_watch_history.get(user_id, [])
    
    return jsonify(history[:limit])

if __name__ == '__main__':
    app.run(debug=True, port=5000)