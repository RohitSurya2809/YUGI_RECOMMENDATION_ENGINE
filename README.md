# YUGI Project

## Overview
YUGI is a video recommendation system that provides personalized content suggestions based on user viewing history and video metadata.

## Features
- Hybrid recommendation system combining content-based and collaborative filtering
- REST API for recommendations and user history tracking
- Modern web interface built with React and Vite
- User watch history tracking
- Caching system for improved performance

## Project Structure
```
YUGI/
├── data/               # Dataset files
├── public/            # Static assets
├── src/               # React application source
│   ├── components/    # React components
│   ├── services/      # API services and utilities
│   ├── App.jsx        # Main application component
│   └── main.jsx       # Application entry point
├── server.py          # Flask API server
├── requirements.txt   # Python dependencies
├── package.json       # Node.js dependencies
└── README.md          # Project documentation
```

## Setup Instructions
1. Clone the repository
2. Install dependencies:
   ```
   pip install -r requirements.txt
   npm install
   ```
3. Set up environment variables in `.env` file
4. Start the development server:
   ```
   python server.py
   npm run dev
   ```

## API Documentation
### Endpoints

#### GET /api/recommendations
- Parameters:
  - video_id: Video ID for recommendations (optional)
  - limit: Number of recommendations (default: 5, max: 20)
  - page: Page number for pagination (default: 1)
- Returns: List of recommended videos with metadata

#### POST /api/track-view
- Parameters:
  - user_id: Unique user identifier
  - video: Video object with id and metadata
- Returns: Success status

#### GET /api/watch-history
- Parameters:
  - user_id: Unique user identifier
  - limit: Number of history items to return (default: 20)
- Returns: List of watched videos with timestamps

## Contributing
Pull requests are welcome. Please follow the existing code style and add tests for new features.