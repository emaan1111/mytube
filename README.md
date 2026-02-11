# MyTube - Your Personal YouTube

A web application that lets you curate and view only the YouTube channels you care about. Sign in with Google to save your channel preferences across all your devices.

## Features

- 🔐 **Google Authentication** - Sign in with your Google account to sync preferences across devices
- 📺 **Channel Management** - Search and add your favorite YouTube channels
- 🏠 **Personalized Feed** - View only videos from channels you've selected
- 🌙 **Dark Theme** - Modern, YouTube-inspired dark interface
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile

## Prerequisites

Before running this project, you need:

1. **Node.js** (v18 or higher)
2. **YouTube Data API Key** - Get one from [Google Cloud Console](https://console.cloud.google.com/)
3. **Google OAuth Credentials** - Create OAuth 2.0 credentials in Google Cloud Console

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Edit the `.env` file with your credentials:

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-secure-secret-here"

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# YouTube Data API
YOUTUBE_API_KEY="your-youtube-api-key"
```

### 3. Set up the database

```bash
npx prisma migrate dev
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Getting API Keys

### YouTube Data API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the "YouTube Data API v3"
4. Go to Credentials → Create Credentials → API Key
5. Copy the API key to your `.env` file

### Google OAuth Credentials

1. In Google Cloud Console, go to Credentials
2. Create Credentials → OAuth 2.0 Client ID
3. Configure the consent screen if prompted
4. Application type: Web application
5. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Client Secret to your `.env` file

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS
- **Database**: SQLite with Prisma ORM
- **Authentication**: NextAuth.js with Google Provider
- **Icons**: Lucide React

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/  # NextAuth API routes
│   │   ├── channels/            # Channel CRUD API
│   │   └── videos/              # Videos feed API
│   ├── auth/signin/             # Sign in page
│   ├── channels/                # Channel management page
│   └── page.tsx                 # Home page with video feed
├── components/
│   ├── ChannelManager.tsx       # Channel search and list
│   ├── Navbar.tsx               # Navigation bar
│   ├── Providers.tsx            # NextAuth session provider
│   └── VideoCard.tsx            # Video display components
└── lib/
    ├── auth.ts                  # NextAuth configuration
    ├── prisma.ts                # Prisma client
    └── youtube.ts               # YouTube API functions
```

## License

MIT
