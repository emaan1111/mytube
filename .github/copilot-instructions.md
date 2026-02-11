# MyTube - Project Instructions

## Project Overview
MyTube is a Next.js web application that allows users to curate and view only their selected YouTube channels. Users can sign in with Google, add/remove channels, and view a personalized video feed.

## Tech Stack
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite with Prisma ORM
- **Authentication**: NextAuth.js with Google Provider
- **Icons**: Lucide React
- **API**: YouTube Data API v3

## Key Files
- `src/app/page.tsx` - Home page with video feed
- `src/app/channels/page.tsx` - Channel management page
- `src/lib/youtube.ts` - YouTube API integration
- `src/lib/auth.ts` - NextAuth configuration
- `src/lib/prisma.ts` - Prisma client singleton
- `prisma/schema.prisma` - Database schema

## Development Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npx prisma studio` - Open Prisma database viewer
- `npx prisma migrate dev` - Run database migrations

## Environment Variables Required
- `DATABASE_URL` - SQLite database path
- `NEXTAUTH_URL` - Application URL
- `NEXTAUTH_SECRET` - NextAuth secret key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `YOUTUBE_API_KEY` - YouTube Data API key
