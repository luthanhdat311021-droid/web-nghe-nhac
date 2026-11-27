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

### 9.1. Triển khai trên AWS (ap-southeast-1 – Singapore)

```text
Trình duyệt ──HTTP──► S3 Static Website (musicwave-web-sg-2026)       ← React build
     │
     └──HTTP /api──► Elastic Beanstalk (Musicwave-env, EC2 t3.micro)  ← Express API
                          ├──► RDS PostgreSQL (musicwave-db, trong VPC)
                          └──► S3 (musicwave-media-sg-2026)          ← nhạc, ảnh (IAM Role)

Serverless: upload nhạc vào s3://…/audio/ ──► EventBridge ──► Lambda musicwave-process-audio
                                                                  └──► processed/audio/*.json, processed/covers/*
            EventBridge Scheduler (8:00 thứ Hai) ──► Lambda musicwave-weekly-report ──► SNS email + reports/weekly/*.json
Giám sát:   CloudWatch Alarms + Dashboard ──► SNS topic musicwave-alerts ──► Email
Chi phí:    AWS Budgets musicwave-monthly-5usd (5 USD/tháng, báo ở 85%, 100%, dự báo 100%)
IaC:        CloudFormation stack musicwave-ops (infra/cloudformation/musicwave-ops.yaml) tạo toàn bộ các mục trên
CI/CD:      GitHub Actions (.github/workflows/deploy-aws.yml) ──OIDC──► S3 + Elastic Beanstalk
```

#### Hạ tầng dạng code (CloudFormation)

Toàn bộ phần vận hành (SNS, 5 alarm, Dashboard, Budget, 3 hàm Lambda, quy tắc EventBridge, lịch chạy, IAM role cho Lambda, log group) nằm trong một template [infra/cloudformation/musicwave-ops.yaml](infra/cloudformation/musicwave-ops.yaml). Dựng lại hoặc cập nhật bằng một lệnh:

```bash
ALERT_EMAIL=ban@example.com bash infra/deploy.sh   # cloudformation package + deploy
aws cloudformation delete-stack --stack-name musicwave-ops   # xoá sạch mọi tài nguyên của stack
```

Điều kiện một lần: bucket media đã bật gửi sự kiện sang EventBridge (`aws s3api put-bucket-notification-configuration --bucket musicwave-media-sg-2026 --notification-configuration '{"EventBridgeConfiguration":{}}'`).

#### Tự phục hồi (self-healing)

Elastic Beanstalk đặt EC2 trong một Auto Scaling Group (min = max = 1). Khi máy chết, nhóm tự tạo máy mới, cài lại ứng dụng từ Application version hiện tại và gắn vào môi trường. Không mất dữ liệu vì dữ liệu nằm ở RDS và S3, còn máy EC2 không giữ trạng thái (stateless).

Diễn tập ngày 28/11/2026 (terminate máy đang chạy, đo bằng `GET /api/health` mỗi 10 giây):

| Mốc | Thời gian |
|---|---|
| Terminate `i-0166862e46dbfb37d` | 0 s |
| API ngừng phản hồi | +16 s |
| Máy mới `i-0deaf279e5c033ec0` được thêm vào môi trường, API trả về 200 | +117 s |
| Gián đoạn thực tế | khoảng 100 giây, không cần thao tác tay |

Lặp lại khi thuyết trình:

```bash
OLD=$(aws elasticbeanstalk describe-environment-resources --environment-name Musicwave-env --query 'EnvironmentResources.Instances[0].Id' --output text)
aws ec2 terminate-instances --instance-ids $OLD
```

#### Serverless

| Hàm | Kích hoạt bởi | Việc làm |
|---|---|---|
| `musicwave-process-audio` | S3 `Object Created` trong `audio/` (qua EventBridge) | Đọc thời lượng, bitrate, sample rate, codec, tag ID3, tách ảnh bìa nhúng; ghi `processed/audio/<tên>.json` và `processed/covers/<tên>.jpg` |
| `musicwave-weekly-report` | EventBridge Scheduler `cron(0 8 ? * MON *)`, múi giờ Asia/Ho_Chi_Minh | Gọi `/api/health`, lấy Top 10 từ `/api/songs/top-charts`, lưu `reports/weekly/<ngày>.json`, gửi email qua SNS |

| `musicwave-uptime-check` | EventBridge Scheduler `rate(5 minutes)` | Gọi trang chủ, `/api/health`, `/api/songs`; ghi metric `MusicWave/Uptime` (`Up` = 1/0, `LatencyMs` theo từng điểm kiểm tra). Alarm `musicwave-uptime-down` báo email khi lỗi 2 lần liên tiếp; Dashboard có ô **Uptime 7 ngày (%)**, uptime theo giờ và độ trễ |

Uptime monitor thay cho CloudWatch Synthetics và hoàn toàn miễn phí: khoảng 8.640 lần chạy Lambda/tháng (Free Tier 1 triệu), 4 metric tự định nghĩa (Free Tier 10), 5 alarm (Free Tier 10).

Chạy thử (28/11/2026): file WAV 5 giây upload lên `audio/` được xử lý xong sau 532 ms; báo cáo tuần chạy tay trả về Top 10 và độ trễ API 573 ms. Node.js 22 trên ARM64 (Graviton), nằm trong Free Tier 1 triệu lần chạy/tháng.

| Thành phần | Địa chỉ / tên |
|---|---|
| Website | http://musicwave-web-sg-2026.s3-website-ap-southeast-1.amazonaws.com |
| API | http://musicwave-env.eba-jen3axxp.ap-southeast-1.elasticbeanstalk.com/api |
| Health check | `GET /api/health` |

**CloudWatch Alarms** (gửi email qua SNS `musicwave-alerts`):

| Alarm | Điều kiện |
|---|---|
| `musicwave-ec2-cpu-high` | CPU trung bình của Auto Scaling Group > 70% trong 5 phút (theo nhóm nên vẫn đúng khi máy bị thay) |
| `musicwave-eb-health-degraded` | `EnvironmentHealth` > 15 (Degraded hoặc Severe) |
| `musicwave-rds-low-storage` | `FreeStorageSpace` của `musicwave-db` < 2 GB |
| `musicwave-lambda-errors` | Lambda `musicwave-process-audio` có lỗi |

**CloudWatch Dashboard `musicwave-overview`:** trạng thái 4 alarm, CPU EC2, số máy đang chạy trong Auto Scaling Group (thấy rõ lúc tự phục hồi), sức khoẻ Elastic Beanstalk, CPU / số kết nối / dung lượng trống của RDS, số lần chạy / lỗi / thời gian xử lý của Lambda.

**Sao lưu RDS:** tự động sao lưu hằng ngày (cửa sổ 19:19–19:49 UTC), giữ 7 ngày, cho phép khôi phục về bất kỳ thời điểm nào trong 7 ngày (point-in-time restore). Snapshot thủ công `musicwave-db-truoc-bao-cao-2026-11-28`. Khôi phục tạo ra một DB instance mới:

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier musicwave-db \
  --target-db-instance-identifier musicwave-db-restore \
  --restore-time 2026-11-28T10:00:00Z
```

**Kiểm thử tải** (`node server/scripts/aws-load-test.mjs`, chỉ gọi API GET công khai, chạy từ một máy ở Việt Nam, 28/11/2026):

| Người dùng ảo | Request | Request/giây | 200 OK | 429 (bị giới hạn) | 5xx | p50 | p95 | p99 |
|---|---|---|---|---|---|---|---|---|
| 5 | 4.444 | 74 | 296 | 4.148 | 0 | 59 ms | 79 ms | 137 ms |
| 20 | 20.043 | 334 | 150 | 19.893 | 0 | 62 ms | 72 ms | 81 ms |
| 50 | 48.849 | 813 | 150 | 48.699 | 0 | 73 ms | 87 ms | 103 ms |

- `globalApiRateLimiter` giới hạn 300 request/phút cho mỗi IP, nên gần như mọi request vượt mức bị trả 429: cơ chế chống lạm dụng hoạt động đúng.
- Ở 813 request/giây, EC2 t3.micro đạt CPU tối đa khoảng 31%, không có lỗi 5xx hay lỗi mạng, độ trễ p99 dưới 140 ms.
- Muốn đo năng lực xử lý request thành công cần tải từ nhiều IP hoặc nâng giới hạn tạm thời.

**Bí mật trong SSM Parameter Store:** `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_SECRET`, `SEPAY_WEBHOOK_KEY`, `SMTP_PASS` được lưu dạng `SecureString` (mã hoá bằng KMS) tại `/musicwave/prod/*`. Role `aws-elasticbeanstalk-ec2-role` có inline policy `musicwave-read-ssm-secrets` chỉ đọc được đúng đường dẫn này. Elastic Beanstalk nạp chúng qua namespace `aws:elasticbeanstalk:application:environmentsecrets` (giá trị là ARN của parameter), nên trang Configuration không còn hiển thị bí mật dạng chữ thường; ứng dụng vẫn đọc qua `process.env` như cũ, không cần sửa code. Đổi một bí mật: `aws ssm put-parameter --name /musicwave/prod/JWT_SECRET --type SecureString --overwrite --value ...` rồi khởi động lại môi trường.

**CI/CD (GitHub Actions):** mỗi lần push lên `main` có thay đổi trong `client/` hoặc `server/`:
1. Frontend: `npm ci` → `vite build` → `aws s3 sync` lên bucket web (thư mục `assets/` trước, `index.html` sau với `no-cache`).
2. Backend: `npm ci` → `tsc` → zip (`Procfile`, `start.sh`, `package*.json`, `dist`, `prisma`) → tạo Application version mới → `update-environment` → chờ môi trường ổn định → gọi `/api/health`.

Thiết lập một lần:
1. ✅ IAM → Identity providers: OpenID Connect `token.actions.githubusercontent.com`, audience `sts.amazonaws.com`.
2. ✅ IAM Role `musicwave-github-actions-deploy` (`arn:aws:iam::586943192758:role/musicwave-github-actions-deploy`):
   - Trust policy chỉ cho phép `repo:luthanhdat311021-droid/web-nghe-nhac:ref:refs/heads/main`.
   - Quyền: `AdministratorAccess-AWSElasticBeanstalk` + inline `musicwave-deploy-s3` (đọc/ghi bucket web và bucket Elastic Beanstalk).
3. GitHub repo → Settings → Secrets and variables → Actions → thêm secret `AWS_DEPLOY_ROLE_ARN` = ARN ở trên.

Không cần lưu access key trong GitHub: OIDC cấp thông tin đăng nhập tạm thời cho mỗi lần chạy.

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

### AI genre classification

Set `GEMINI_API_KEY` in `server/.env` (or the server deployment environment). Optional
`GEMINI_MODEL` defaults to `gemini-flash-latest`. Keep the key on the server only.
Sign in as an administrator and open Search → Khám phá thể loại → Phân loại bằng AI.
The server processes up to 20 unassigned songs per request using title, artist and album
metadata, and saves only catalog genres with confidence of at least 0.8. This does not
analyze audio. Existing assignments and concurrent edits are preserved; uncertain songs
stay unassigned. The interface reports progress and errors, and refreshes genre counts.
Genre cards open the paginated catalog filtered by the selected genre.

Endpoint: `POST /api/admin/genres/classify`, optional JSON `{ "afterId": "song-uuid" }`.
Continue using `nextCursor` until null. Requests require an administrator session.
Run classifier checks with `cd server && npx tsx --test src/scripts/genreClassification.test.ts`.


1. **Port 5000 or 5173 already in use**:
   Change `PORT=5001` in `server/.env` and update the proxy port in `client/vite.config.ts`.
2. **Switching to PostgreSQL**:
   Update `DATABASE_URL` in `server/.env` and change `provider = "postgresql"` in `server/prisma/schema.prisma`, then run `npm run db:migrate`.
3. **Audio Playback**:
   All 50+ seed tracks reference working royalty-free streaming MP3 sources. You can also upload local audio files via the Admin Song Manager (`/admin/songs`).
