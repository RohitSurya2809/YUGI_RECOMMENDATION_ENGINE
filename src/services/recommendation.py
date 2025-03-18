import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer
from surprise import Dataset, Reader, SVD
from surprise.model_selection import train_test_split
import torch
import functools
import time
from collections import defaultdict

# Load the dataset
df = pd.read_csv('data/YT_data.csv')

# Data Preprocessing
df = df.dropna(subset=['v_id', 'v_title', 'v_description', 'tags', 'category_id'])
df['content'] = df['v_title'] + ' ' + df['v_description'] + ' ' + df['tags']

# Generate YouTube Video Link
df['video_link'] = "https://www.youtube.com/watch?v=" + df['v_id']

# Convert categorical features
df['category_id'] = df['category_id'].astype(str)


# TF-IDF Vectorization for Content-Based Filtering
tfidf = TfidfVectorizer(stop_words='english')
tfidf_matrix = tfidf.fit_transform(df['content'])


# Sentence Transformer for Semantic Similarity with batch processing
model = SentenceTransformer('all-MiniLM-L6-v2')
# Process embeddings in batches for better performance
batch_size = 32
embeddings = []
for i in range(0, len(df), batch_size):
    batch = df['content'].iloc[i:i+batch_size].tolist()
    batch_embeddings = model.encode(batch, batch_size=batch_size, show_progress_bar=False)
    embeddings.extend(batch_embeddings)
df['embeddings'] = embeddings


# Compute cosine similarity
cosine_sim = cosine_similarity(tfidf_matrix, tfidf_matrix)

# Enhanced cache management with LRU implementation
from collections import OrderedDict

class LRUCache(OrderedDict):
    def __init__(self, capacity):
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

# Initialize LRU cache with improved memory management
recommendation_cache = LRUCache(500)
CACHE_EXPIRATION = 600  # 10 minutes


# Collaborative Filtering using SVD
reader = Reader(rating_scale=(0, 5))
data = Dataset.load_from_df(df[['v_id', 'v_title', 'engagement_rate']], reader)
trainset, testset = train_test_split(data, test_size=0.2)


svd = SVD()
svd.fit(trainset)


# Define sensitive content categories that should be handled carefully
# These are example category IDs that might correspond to political or AI content
# Adjust these based on your actual dataset categories
SENSITIVE_CATEGORIES = {
    # Example category IDs - update these based on your actual data
    'POLITICAL': ['22', '25', '29'],  # News, politics related categories
    'AI': ['28', '24', '27'],         # Science, tech related categories
    'EDUCATION': ['27', '26', '23'],  # Education related categories
    'ENTERTAINMENT': ['23', '24', '10'] # Entertainment related categories
}

# Define category compatibility matrix - which categories should be shown together
# Higher values mean more compatible, lower values mean less compatible
CATEGORY_COMPATIBILITY = {
    # Political content should mostly stay with political content
    '22': {'22': 1.0, '25': 0.9, '29': 0.9, '28': 0.4, '24': 0.4, '27': 0.5, '23': 0.3},
    '25': {'22': 0.9, '25': 1.0, '29': 0.9, '28': 0.4, '24': 0.4, '27': 0.5, '23': 0.3},
    '29': {'22': 0.9, '25': 0.9, '29': 1.0, '28': 0.4, '24': 0.4, '27': 0.5, '23': 0.3},
    
    # AI/Tech content should mostly stay with tech content
    '28': {'28': 1.0, '24': 0.9, '27': 0.8, '22': 0.4, '25': 0.4, '29': 0.4, '23': 0.6},
    '24': {'28': 0.9, '24': 1.0, '27': 0.8, '22': 0.4, '25': 0.4, '29': 0.4, '23': 0.6},
    
    # Education content is more compatible with tech than politics
    '27': {'27': 1.0, '28': 0.8, '24': 0.8, '22': 0.5, '25': 0.5, '29': 0.5, '23': 0.7},
    
    # Entertainment is generally compatible with most categories
    '23': {'23': 1.0, '27': 0.7, '28': 0.6, '24': 0.6, '22': 0.3, '25': 0.3, '29': 0.3}
}

@functools.lru_cache(maxsize=100)
def get_video_category(video_id, df=df):
    """Get the category of a video with caching for performance"""
    try:
        video_data = df[df['v_id'] == video_id]
        if not video_data.empty:
            return video_data.iloc[0]['category_id']
    except Exception as e:
        print(f"Error getting video category: {e}")
    return None

def hybrid_recommendation(video_id, top_n=5, df=df, cosine_sim=cosine_sim): # Pass df and cosine_sim to the function
    """
    Provides hybrid recommendations (content-based + collaborative filtering).


    Args:
        video_id (str): The ID of the video for which to generate recommendations.
        top_n (int, optional): The number of recommendations to generate. Defaults to 5.
        df (pd.DataFrame, optional): The DataFrame containing video data. Defaults to the global df.
        cosine_sim (np.ndarray, optional): The cosine similarity matrix. Defaults to the global cosine_sim.


    Returns:
        list: A list of recommended video objects with details.
    """
    # Check cache first for better performance
    cache_key = f"{video_id}_{top_n}"
    current_time = time.time()
    
    if cache_key in recommendation_cache:
        cache_entry = recommendation_cache[cache_key]
        # Return cached results if they haven't expired
        if current_time - cache_entry['timestamp'] < CACHE_EXPIRATION:
            return cache_entry['recommendations']
    
    try:
        idx = df[df['v_id'] == video_id].index[0]
    except IndexError:
        return [{"error": "Video ID not found!"}]
    
    # Get the category and channel of the current video for better recommendations
    current_video_category = df.iloc[idx]['category_id']
    current_video_channel = df.iloc[idx]['channel_name'] if 'channel_name' in df.columns else None
    current_video_channel_id = df.iloc[idx]['channel_id'] if 'channel_id' in df.columns else None
    
    # Check if current video is in a sensitive category
    is_political = current_video_category in SENSITIVE_CATEGORIES['POLITICAL']
    is_ai = current_video_category in SENSITIVE_CATEGORIES['AI']
    
    # For sensitive categories, we'll be more careful with recommendations
    sensitive_content = is_political or is_ai
    
    # Content-Based Recommendations
    content_scores = list(enumerate(cosine_sim[idx]))
    content_scores = sorted(content_scores, key=lambda x: x[1], reverse=True)
    content_recommendations = [
        {
            "id": df.iloc[i[0]]['v_id'],
            "title": df.iloc[i[0]]['v_title'],
            "link": df.iloc[i[0]]['video_link'],
            "description": df.iloc[i[0]]['v_description'],
            "tags": df.iloc[i[0]]['tags'],
            "category": df.iloc[i[0]]['category_id'],
            "channel_name": df.iloc[i[0]]['channel_name'] if 'channel_name' in df.columns else None,
            "channel_id": df.iloc[i[0]]['channel_id'] if 'channel_id' in df.columns else None,
            "score": float(i[1])
        } 
        for i in content_scores[1:top_n*2] # Get more candidates for better diversity
    ]
    
    # Boost scores for videos from the same channel
    if current_video_channel or current_video_channel_id:
        for rec in content_recommendations:
            # Boost score for videos from the same channel
            if (current_video_channel and rec['channel_name'] == current_video_channel) or \
               (current_video_channel_id and rec['channel_id'] == current_video_channel_id):
                rec['score'] *= 1.5  # 50% boost for same channel
    
    # Boost scores for videos in the same category
    for rec in content_recommendations:
        if rec['category'] == current_video_category:
            rec['score'] *= 1.3  # 30% boost for same category
        
        # Handle sensitive content categories with improved compatibility matrix
        if current_video_category in CATEGORY_COMPATIBILITY:
            # Get compatibility score between current video category and recommendation category
            compatibility = CATEGORY_COMPATIBILITY.get(current_video_category, {}).get(rec['category'], 0.5)
            # Apply compatibility score to recommendation score
            rec['score'] *= compatibility
        else:
            # If watching AI content, reduce score of political content
            if is_ai and rec['category'] in SENSITIVE_CATEGORIES['POLITICAL']:
                rec['score'] *= 0.3  # 70% reduction for political content when watching AI
            
            # If watching political content, reduce score of unrelated categories
            if is_political and rec['category'] not in SENSITIVE_CATEGORIES['POLITICAL']:
                # Allow some related content but reduce score of completely unrelated content
                if rec['category'] not in SENSITIVE_CATEGORIES['AI']:
                    rec['score'] *= 0.5  # 50% reduction for non-political content
    
    # Re-sort content recommendations by the adjusted scores
    content_recommendations = sorted(content_recommendations, key=lambda x: x['score'], reverse=True)[:top_n]
    
    # Improved Collaborative Filtering with better targeting
    # First try to get videos from the same channel
    same_channel_df = pd.DataFrame()
    if current_video_channel and 'channel_name' in df.columns:
        same_channel_df = df[df['channel_name'] == current_video_channel]
    elif current_video_channel_id and 'channel_id' in df.columns:
        same_channel_df = df[df['channel_id'] == current_video_channel_id]
    
    # Then try to get videos from the same category
    same_category_df = df[df['category_id'] == current_video_category]
    
    # Prioritize recommendations in this order: same channel, same category, then general
    if len(same_channel_df) >= top_n//2:
        # If we have enough videos from the same channel, use those for half the recommendations
        channel_filtered_df = same_channel_df.sort_values('engagement_rate', ascending=False).head(top_n)
        category_filtered_df = same_category_df.sort_values('engagement_rate', ascending=False).head(top_n)
        # Combine channel and category dataframes for more diversity
        filtered_df = pd.concat([channel_filtered_df, category_filtered_df]).drop_duplicates(subset=['v_id']).head(top_n * 2)
    elif len(same_category_df) >= top_n:
        # If we have enough videos in the same category, use those
        filtered_df = same_category_df.sort_values('engagement_rate', ascending=False).head(top_n * 2)
    else:
        # Otherwise, use the whole dataset but prioritize engagement
        filtered_df = df.sort_values('engagement_rate', ascending=False).head(top_n * 2)
    
    # Create collaborative filtering recommendations with improved scoring
    svd_recommendations = [
        {
            "id": row['v_id'],
            "title": row['v_title'],
            "link": "https://www.youtube.com/watch?v=" + row['v_id'],
            "description": row['v_description'],
            "tags": row['tags'],
            "category": row['category_id'],
            "channel_name": row['channel_name'] if 'channel_name' in filtered_df.columns else None,
            "channel_id": row['channel_id'] if 'channel_id' in filtered_df.columns else None,
            "score": float(row['engagement_rate']) / 5.0
        }
        for _, row in filtered_df.sample(min(top_n, len(filtered_df))).iterrows()
    ]
    
    # Apply the same boosting to collaborative filtering recommendations
    for rec in svd_recommendations:
        # Boost score for videos from the same channel
        if (current_video_channel and rec['channel_name'] == current_video_channel) or \
           (current_video_channel_id and rec['channel_id'] == current_video_channel_id):
            rec['score'] *= 1.5
        # Boost score for videos in the same category
        if rec['category'] == current_video_category:
            rec['score'] *= 1.3
            
        # Handle sensitive content categories for collaborative filtering too
        if sensitive_content:
            # If watching AI content, reduce score of political content
            if is_ai and rec['category'] in SENSITIVE_CATEGORIES['POLITICAL']:
                rec['score'] *= 0.3  # 70% reduction for political content when watching AI
            
            # If watching political content, reduce score of unrelated categories
            if is_political and rec['category'] not in SENSITIVE_CATEGORIES['POLITICAL']:
                # Allow some related content but reduce score of completely unrelated content
                if rec['category'] not in SENSITIVE_CATEGORIES['AI']:
                    rec['score'] *= 0.5  # 50% reduction for non-political content
    
    # Combine recommendations and remove duplicates
    # Weight content-based recommendations higher (70%) than collaborative (30%)
    all_recommendations = content_recommendations + svd_recommendations
    unique_recommendations = []
    seen_ids = set()
    
    # First add some content-based recommendations to ensure diversity
    content_count = 0
    for rec in content_recommendations:
        if rec["id"] not in seen_ids and rec["id"] != video_id and content_count < (top_n * 0.7):
            seen_ids.add(rec["id"])
            unique_recommendations.append(rec)
            content_count += 1
    
    # Then add collaborative recommendations
    for rec in svd_recommendations:
        if rec["id"] not in seen_ids and rec["id"] != video_id and len(unique_recommendations) < top_n:
            seen_ids.add(rec["id"])
            unique_recommendations.append(rec)
    
    # If we still need more recommendations, add remaining content-based ones
    if len(unique_recommendations) < top_n:
        for rec in content_recommendations:
            if rec["id"] not in seen_ids and rec["id"] != video_id and len(unique_recommendations) < top_n:
                seen_ids.add(rec["id"])
                unique_recommendations.append(rec)
    
    # Sort final recommendations by score
    unique_recommendations = sorted(unique_recommendations, key=lambda x: x['score'], reverse=True)[:top_n]
    
    # Cache the results for future requests
    recommendation_cache[cache_key] = {
        'recommendations': unique_recommendations,
        'timestamp': current_time
    }
    
    # Clean up old cache entries (only do this periodically to reduce overhead)
    if len(recommendation_cache) > MAX_CACHE_SIZE or hash(cache_key) % 10 == 0:
        # Sort cache entries by timestamp (oldest first)
        sorted_cache = sorted(recommendation_cache.items(), key=lambda x: x[1]['timestamp'])
        
        # Remove expired entries
        for key, entry in sorted_cache:
            if current_time - entry['timestamp'] > CACHE_EXPIRATION:
                del recommendation_cache[key]
        
        # If still too many entries, remove oldest ones
        if len(recommendation_cache) > MAX_CACHE_SIZE:
            # Keep only the newest 80% of entries
            entries_to_keep = int(MAX_CACHE_SIZE * 0.8)
            keys_to_remove = [k for k, _ in sorted_cache[:-entries_to_keep]]
            for key in keys_to_remove:
                if key in recommendation_cache:  # Check again in case it was already removed
                    del recommendation_cache[key]
    
    return unique_recommendations