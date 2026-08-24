# 🎵 MusicWave — Modern Full-Stack Music Streaming Platform

MusicWave is a production-grade, full-stack music streaming web application designed with modern dark-first glassmorphism aesthetics, a persistent singleton audio engine (HTML5 Audio API + Zustand), live synchronized lyrics, rich user library capabilities, and a comprehensive Admin Management Suite.

---

## 1. Project Overview

MusicWave delivers a seamless audio streaming experience similar to Spotify and Apple Music, built from scratch without copyrighted assets or clones:
- **Audio Engine**: High-fidelity continuous streaming with play/pause, seek scrubber, shuffle, repeat-1 / repeat-all modes, volume control, and dynamic play queue.
- **Synchronized Lyrics**: Real-time scrolling and active timestamp highlighting with click-to-seek support.
- **Discovery**: Home billboard, Trending Now, Top Charts, Recommended, Genre filters, and live debounced search across songs, artists, albums, and playlists.
- **User Library**: Custom playlist creation, song addition/reordering, favorites management, and automatic listening history tracking.
- **Admin Suite**: Statistical KPI dashboard, weekly streaming & user growth telemetry charts, and complete CRUD with file upload capabilities for Songs, Artists, Albums, and User management.

---

## 2. Features

### User Features
- 🔐 **Authentication**: Register, Login, JWT session persistence, profile management, password changes.
- 🎧 **Music Player**: Persistent bottom bar, HTML5 Audio singleton, responsive seek progress bar, volume/mute toggle, shuffle, 3-mode repeat (`off`, `all`, `one`), and up-next queue drawer.
- 📜 **Synchronized Lyrics**: Fullscreen lyrics overlay with real-time autoscroll driven by playback timestamps and interactive click-to-jump seeking.
- 🔎 **Real-Time Search**: Debounced search across Songs, Artists, Albums, and Playlists with category tabs.
- 📂 **Playlist Management**: Create, rename, edit privacy, add/remove tracks, and delete playlists.
- ❤️ **Favorites**: Instant one-click liking with real-time state sync across all views.
- 🕒 **Listening History**: Automatic playback recording with timestamps and one-click history clearing.
- 👤 **Artist & Album Profiles**: Verified artist badges, follower counters, discography listings, and tracklists.
- 📱 **Responsive Design**: Tailored layouts for Desktop, Tablet, and Mobile with compact bottom navigation.

### Admin Dashboard (`/admin`)
- 📊 **Analytics Dashboard**: Total users, songs, artists, albums, playlists, total streams, and interactive Recharts charts.
- 🎵 **Song Management**: Add/Edit/Delete songs with MP3/WAV audio uploads and artwork attachments.
- 🎤 **Artist Management**: Add/Edit/Delete artists with avatar, banner uploads, and verification toggles.
- 💿 **Album Management**: Create albums and organize track listings.
- 👥 **User Management**: View user accounts, toggle `ADMIN` / `USER` roles, suspend/block accounts, and delete users.

---

## 3. Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Framer Motion, Zustand, Axios, Recharts |
| **Backend** | Node.js, Express.js, TypeScript, REST API, JWT, bcrypt, Multer, Zod |
| **Database & ORM** | Prisma ORM, SQLite (Default zero-config local) / PostgreSQL (Production ready) |

---

## 4. Project Structure

```text
MusicWave/
├── client/                     # Vite + React + TypeScript Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/          # AdminLayout, StatsCard, SongModal, ArtistModal, AlbumModal
│   │   │   ├── cards/          # SongCard, SongRow, ArtistCard, AlbumCard, PlaylistCard
│   │   │   ├── common/         # Button, Input, Modal, Skeleton, EmptyState, AddToPlaylistModal
│   │   │   ├── layout/         # Sidebar, Topbar, BottomPlayer, MobileNav, MainLayout
│   │   │   └── player/         # BottomPlayer, ProgressBar, VolumeControl, LyricsModal, QueueDrawer
│   │   ├── pages/
│   │   │   ├── admin/          # AdminDashboard, AdminSongs, AdminArtists, AdminAlbums, AdminUsers
│   │   │   ├── auth/           # Login, Register
│   │   │   ├── Home.tsx, Explore.tsx, Search.tsx, SongDetail.tsx, ArtistDetail.tsx
│   │   │   ├── AlbumDetail.tsx, PlaylistDetail.tsx, Favorites.tsx, History.tsx, Profile.tsx
│   │   │   └── Artists.tsx, Albums.tsx
│   │   ├── services/           # Axios API client & endpoints
│   │   ├── store/              # Zustand playerStore & authStore
│   │   ├── types/              # Domain TypeScript interfaces
│   │   ├── utils/              # format, lyrics parser
│   │   ├── App.tsx             # React Router routing table
│   │   └── main.tsx
│   ├── tailwind.config.js
│   └── package.json
│
├── server/                     # Node.js + Express + TypeScript Backend
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── seed.ts             # Rich seed script (51 songs, 10 artists, 12 albums, 6 playlists, 11 users)
│   ├── src/
│   │   ├── config/             # Environment variables
│   │   ├── controllers/        # Auth, Song, Artist, Album, Playlist, Favorite, History, Search, Admin
│   │   ├── middleware/         # Auth (JWT), Admin, Upload (Multer), Error handling
│   │   ├── routes/             # REST API routers
│   │   ├── services/           # Prisma client
│   │   ├── types/              # Express & DTO types
│   │   ├── utils/              # JWT, bcrypt, response helpers
│   │   └── server.ts           # Server entry point
│   ├── uploads/                # Media storage directory
│   └── package.json
│
├── .env.example
├── README.md
└── package.json                # Root automation scripts
```

---

## 5. Installation & Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Step 1: Install Dependencies
From the project root:
```bash
npm run install:all
```
*(Or install manually in `server/` and `client/`)*:
```bash
cd server && npm install
cd ../client && npm install
```

---

## 6. Environment Variables

Create `.env` inside `server/` (or copy `.env.example`):

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database Connection (SQLite by default, or PostgreSQL)
DATABASE_URL="file:./dev.db"
# PostgreSQL example:
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/musicwave?schema=public"

# Authentication Security
JWT_SECRET="musicwave_super_secret_jwt_key_2026_modern_streaming_app_secure"
JWT_EXPIRES_IN="7d"

# Admin Initial Account
ADMIN_EMAIL="admin@musicwave.com"
ADMIN_PASSWORD="Admin@123456"
ADMIN_USERNAME="MusicWaveAdmin"
```

---

## 7. Database Migration & Seeding

Run Prisma schema generation, database migration, and seed dataset:

```bash
# Generate Prisma Client
npm run db:generate

# Sync schema to database
npm run db:migrate

# Seed 50+ songs with working audio streams, verified artists, albums & playlists
npm run db:seed
```

---

## 8. Running Development Mode

Start both Backend (`http://localhost:5000`) and Frontend (`http://localhost:5173`) concurrently:

```bash
# From root directory:
npm run dev
```

Alternatively, run in separate terminals:
- **Terminal 1 (Backend)**: `cd server && npm run dev`
- **Terminal 2 (Frontend)**: `cd client && npm run dev`

Open your browser and navigate to: **`http://localhost:5173`**

---

## 9. Production Build

```bash
# Build both client and server:
npm run build

# Start production server:
npm run start
```

---

## 10. Default Accounts

| Role | Email | Password | Username |
|---|---|---|---|
| **Admin** | `admin@musicwave.com` | `Admin@123456` | `MusicWaveAdmin` |
| **Demo User** | `alex@musicwave.com` | `User@123456` | `AlexVibe` |
| **Demo User** | `sophia@musicwave.com` | `User@123456` | `SophiaHarmonics` |

*(On the Login page, you can also click **"Fill Admin"** or **"Fill User"** for instant 1-click test credentials).*

---

## 11. REST API Documentation

### Authentication
- `POST /api/auth/register` — Register new account
- `POST /api/auth/login` — Sign in and obtain JWT
- `GET  /api/auth/me` — Retrieve current authenticated user profile
- `PUT  /api/auth/profile` — Update username, avatar, bio
- `POST /api/auth/change-password` — Change account password

### Songs
- `GET  /api/songs` — Browse paginated songs with filters (`genre`, `search`, `trending`, `featured`)
- `GET  /api/songs/trending` — Top 12 trending tracks
- `GET  /api/songs/top-charts` — Top 10 chart tracks
- `GET  /api/songs/recommended` — Recommended featured songs
- `GET  /api/songs/:id` — Song details, lyrics, and recommendations
- `POST /api/songs/:id/play` — Increment play count & log history

### Artists & Albums
- `GET  /api/artists` — List artists with search & pagination
- `GET  /api/artists/:id` — Artist details, popular songs & discography
- `POST /api/artists/:id/follow` — Toggle following artist
- `GET  /api/artists/following` — Get list of followed artists
- `GET  /api/albums` — List albums
- `GET  /api/albums/:id` — Album details & tracklist

### Playlists, Favorites & History
- `GET    /api/playlists` — Get user's playlists
- `POST   /api/playlists` — Create new playlist
- `GET    /api/playlists/:id` — Playlist details & tracks
- `PUT    /api/playlists/:id` — Update playlist details
- `DELETE /api/playlists/:id` — Delete playlist
- `POST   /api/playlists/:id/songs` — Add song to playlist
- `DELETE /api/playlists/:id/songs/:songId` — Remove song from playlist
- `PUT    /api/playlists/:id/reorder` — Reorder playlist tracks
- `GET    /api/favorites` — Get user liked songs
- `POST   /api/favorites/:songId` — Toggle like status
- `GET    /api/history` — Get listening history
- `DELETE /api/history` — Clear history

### Search
- `GET /api/search?q=...&type=...` — Live cross-entity search (songs, artists, albums, playlists)

### Admin Management (`ADMIN` role required)
- `GET    /api/admin/stats` — Dashboard KPIs & chart data
- `POST   /api/admin/songs` — Create song with audio/cover upload
- `PUT    /api/admin/songs/:id` — Update song
- `DELETE /api/admin/songs/:id` — Delete song
- `POST   /api/admin/artists` — Create artist
- `PUT    /api/admin/artists/:id` — Update artist
- `DELETE /api/admin/artists/:id` — Delete artist
- `POST   /api/admin/albums` — Create album
- `PUT    /api/admin/albums/:id` — Update album
- `DELETE /api/admin/albums/:id` — Delete album
- `GET    /api/admin/users` — List all registered users
- `PUT    /api/admin/users/:id/role` — Change user role
- `PUT    /api/admin/users/:id/block` — Toggle account suspension
- `DELETE /api/admin/users/:id` — Delete user account

---

## 12. Troubleshooting

1. **Port 5000 or 5173 already in use**:
   Change `PORT=5001` in `server/.env` and update the proxy port in `client/vite.config.ts`.
2. **Switching to PostgreSQL**:
   Update `DATABASE_URL` in `server/.env` and change `provider = "postgresql"` in `server/prisma/schema.prisma`, then run `npm run db:migrate`.
3. **Audio Playback**:
   All 50+ seed tracks reference working royalty-free streaming MP3 sources. You can also upload local audio files via the Admin Song Manager (`/admin/songs`).
