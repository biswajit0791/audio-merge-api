# Backend - Express + ffmpeg + Google Drive OAuth

## Setup

1. Install dependencies
   npm install
2. Ensure ffmpeg is installed on the server and accessible in PATH.
3. Create a `.env` file with the following keys:
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:4000/auth/callback
   FRONTEND_ORIGIN=http://localhost:5173
   SESSION_SECRET=some-secret
4. Run the server:
   npm start
