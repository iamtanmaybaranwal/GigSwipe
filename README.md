# GigSwipe

**Local gigs. One swipe away.**

GigSwipe is a mobile marketplace for short-term, flexible work. People who need help post gigs, and people nearby who want work swipe through them like cards. Swipe right to apply, chat instantly, confirm the hire in person with a secure 4-digit code, and rate each other when the job is done.

It's built for **everyone**: students, part-timers, freelancers, parents, retirees, people between jobs. On the hiring side it's for cafés, shops, event organisers, startups and individuals who need a hand.

> Native Android app built with React Native, backed by a Node.js + MongoDB API with real-time chat.

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Real-time Events](#real-time-events)
- [Data Models](#data-models)
- [Current Limitations](#current-limitations)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### For Job Seekers 👷
- **Swipe feed**: gigs appear as animated cards. Swipe right (or tap ❤️) to apply, left to skip, **up to save for later**.
- **Undo**: brought back the wrong card? Undo the last swipes (an application is withdrawn, a save is removed).
- **Search and filters**: keyword search, plus date (today, tomorrow, this weekend, next 7 days), pay (minimum per hour/day/week/month/total), distance, category and on-site/remote.
- **Saved gigs**: a bookmark list of gigs to decide on later. It shows when one fills up or ends.
- **Nearest first**: gigs are ranked by distance using a MongoDB geospatial (`2dsphere` + `$geoNear`) query.
- **Real dates and times**: each gig shows when it starts ("Starts in 3 h"), how long it runs and how many spots are left.
- **Available now**: one tap tells nearby job givers you can start today. It switches off at midnight.
- **Availability**: weekday mornings, evenings, weekends, night shifts and so on, plus a free-text note.
- **Invites**: job givers can invite you to a gig. Accept with one tap and the chat opens.
- **Gig reminders**: a notification the day before and 1 hour before a gig you're booked for (on the phone, works offline and after a restart).
- **Map view** (Leaflet + OpenStreetMap, free) with every nearby gig as a pay-tag pin, and **one-tap directions** (opens Google Maps).
- **Matches**: an "Upcoming" card with time and directions, your hire codes, and every chat.
- **Profile photo**, bio, skills, portfolio links, ratings, reviews and work history.

### For Job Givers 🏪
- **Post a gig in about a minute**: photos (up to 6), title, category, pay amount + unit, start/end date and time, number of people needed, on-site or remote, description.
- **Gigs expire automatically** when their end time passes, and **close automatically** when every opening is hired.
- **Edit, close, reopen, duplicate or repost** a gig (repost keeps everything and asks for new dates).
- **Find people**: browse nearby job seekers by skill, "available now" and availability, and **invite them** to a gig.
- **Dashboard**: active vs. past gigs, hired/needed per gig, applicants to review, total hires.
- **Applicant review**: photo, bio, skills, availability and ratings; accept or decline.
- **Real-time chat** with one-tap **quick replies** ("What's your availability?", "Can you start Saturday?"…).
- **Verified hiring**: enter the worker's 4-digit code to confirm the hire. Codes expire after 24 hours.
- **Business profile**: logo/photo, industry, location, website, phone, about and gig history.

### For everyone 🌏
- **English and Hindi** (हिन्दी), switchable on the welcome screen and in Settings. Adding another language is one dictionary file.
- Works on slow networks: offline banner, request timeouts, retry on failed messages, photos resized on the phone before upload.

### Trust & Safety 🔒
- **Hire code verification** confirms the right person showed up for the job.
- **Two-way ratings**: both sides rate each other (1–5 stars plus an optional review of up to 500 characters). Rating is only allowed after a real working relationship, and only once per job.
- **Privacy**: public profiles never include email or exact location; worker search shows only a rounded distance, and job seekers can hide themselves from search.
- **Public profiles** show average rating, gigs completed and workers hired.
- **Secure auth**: passwords hashed with bcrypt, JWT sessions, password hashes never returned by the API. Uploaded files are checked to be real images.

---

## How It Works

```
 Job Giver                                   Job Seeker
 ─────────                                   ──────────
 Posts a gig ───────────────────────────▶   Sees it in the swipe feed (nearest first)
                                             Swipes right → applies
 Sees applicant in dashboard ◀──────────    Chat thread opens automatically
 Accepts applicant ─────────────────────▶   4-digit hire code appears in Matches
 Chats to agree details ◀──────────────▶    Chats to agree details
 Meets in person, enters code ◀─────────    Shows the code
 ✅ Hire confirmed
 Rates the worker ◀────────────────────▶    Rates the employer
```

**Gig categories:** Food & Beverage, Retail, Events, Delivery & Driving, Cleaning & Household, Construction & Repair, Care & Tutoring, Marketing, Creative, Admin, Tech, Other

**Supported industries:** Food & Beverage, Retail, Events & Entertainment, Marketing & Media, Technology, Healthcare, Education, Non-profit, Real Estate, Other

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile app (Android) | Bare React Native 0.88 (New Architecture, Hermes), React 19, TypeScript |
| Navigation | React Navigation 7 (native stack + bottom tabs) |
| Animations & gestures | React Native `Animated` + `PanResponder` (native driver) |
| Maps & location | Leaflet + OpenStreetMap (in `react-native-webview`), `@react-native-community/geolocation` |
| Secure storage | `react-native-keychain` (Android Keystore) |
| Real-time | Socket.io (client + server) |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB Atlas with Mongoose (geospatial `2dsphere` index) |
| Auth | JWT (`jsonwebtoken`), `bcryptjs`, `express-validator` |

---

## Project Structure

```
gigswipe/
├── backend/                    # REST API + Socket.io server
│   ├── src/
│   │   ├── index.ts            # Server entry: Express, Socket.io, routes
│   │   ├── db.ts               # MongoDB connection with retry/backoff
│   │   ├── realtime.ts         # Authenticated Socket.io (chat + live updates)
│   │   ├── services/chat.ts    # Message saving, unread counts
│   │   ├── middleware/
│   │   │   └── auth.ts         # JWT auth (required + optional)
│   │   ├── models/             # Mongoose schemas
│   │   │   ├── User.ts
│   │   │   ├── Gig.ts
│   │   │   ├── Application.ts
│   │   │   ├── Message.ts
│   │   │   └── Rating.ts
│   │   ├── routes/             # API endpoints
│   │   │   ├── auth.ts
│   │   │   ├── gigs.ts
│   │   │   ├── applications.ts
│   │   │   ├── chat.ts
│   │   │   ├── ratings.ts
│   │   │   └── users.ts
│   │   └── utils/              # geo, time, serializers, error handling
│   ├── package.json
│   └── tsconfig.json
│
└── gigswipe_rn/                # React Native app for Android (full guide: gigswipe_rn/README.md)
    ├── App.tsx                 # Providers, navigation, error boundary, offline banner
    ├── android/                # Native Android project (package com.gigswipe.app)
    ├── scripts/rn.js           # Windows-safe CLI launcher + USB port forwarding
    └── src/
        ├── api/                # Typed REST client
        ├── components/         # UI kit, hire code / rating sheets, location picker
        ├── context/            # Auth session (Keystore-backed)
        ├── hooks/              # Data loading, socket events, auto location
        ├── navigation/         # Root stack + Job Seeker / Job Giver tabs
        ├── screens/            # auth/, worker/, business/, shared/
        ├── services/           # Socket.io, location, secure storage
        ├── theme/              # Colours, spacing, typography
        └── utils/              # Formatting, links, directions
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or newer
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (the free tier works) or a local MongoDB instance
- JDK 17 and the Android SDK (for building the app)
- An Android phone with USB debugging enabled (or an emulator)

### 1. Clone the repo

```bash
git clone https://github.com/iamtanmaybaranwal/GigSwipe.git
cd GigSwipe
```

### 2. Start the backend

```bash
cd backend
npm install
```

Create a `.env` file in `backend/` (see [Environment Variables](#environment-variables)):

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/gigswipe
PORT=3001
JWT_SECRET=replace-with-a-long-random-string
```

Run the dev server:

```bash
npm run dev
```

You should see:

```
GigSwipe backend is running!
   REST API  → http://localhost:3001/api
   DB test   → http://localhost:3001/api/db-test
   Health    → http://localhost:3001/health
   Socket.io → ws://localhost:3001
```

### 3. Run the Android app

```bash
cd ../gigswipe_rn
cp .env.example .env     # API_URL=http://localhost:3001 works over USB
npm install
npm run android          # builds, installs, and sets up adb reverse for ports 3001 + 8081
```

Connect your phone with USB debugging on before running `npm run android`. The app reaches the backend through the USB cable, so no Wi-Fi IP is needed. See [gigswipe_rn/README.md](gigswipe_rn/README.md) for the full setup, release builds, and troubleshooting.

### Backend scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with hot reload (`ts-node-dev`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |

---

## Deploying (shareable APK)

The app on your phone talks to the backend over the USB cable. To share an APK that works anywhere, put the backend online and point the release build at it.

1. **MongoDB Atlas → Database & Network Access → IP Access List → Allow access from anywhere (`0.0.0.0/0`).** Hosting providers don't have fixed IP addresses.
2. **Render** (https://render.com): sign in with GitHub → **New → Blueprint** → choose this repo and branch. `render.yaml` sets everything up; paste `MONGODB_URI` and the `SMTP_*` values when asked. You get an HTTPS address like `https://gigswipe-api.onrender.com`.
   - The free plan sleeps after 15 minutes without traffic (the first request then takes ~50 s). The $7/month Starter plan stays awake.
3. Put that address in `gigswipe_rn/.env` as `API_URL_PRODUCTION`, then build the APK:
   ```bash
   cd gigswipe_rn/android
   ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
   ```
   The APK is at `android/app/build/outputs/apk/release/app-release.apk`. Share it via a link (website, Google Drive, WhatsApp). People need to allow "Install unknown apps" once.
4. Back up `gigswipe_rn/android/app/gigswipe-release.keystore` and `gigswipe_rn/android/keystore.properties` somewhere safe and private. Every future update must be signed with the same key, or phones will refuse to update the app.

## Web app (PWA)

`gigswipe_rn/web` builds the same app for browsers. It can be installed on iPhone (Safari → Share → Add to Home Screen), Android, Windows and Mac. Build with `npm run build:web` in `gigswipe_rn` and upload `web/dist` to any static host; `web/public/install-ios.html` is the illustrated iPhone install guide. Details: [gigswipe_rn/README.md](gigswipe_rn/README.md#web-app-pwa-iphone-android-browsers-windows-mac).

## Live updates and push notifications

- **While the app is open** everything updates live over Socket.io: new gigs near you appear in the feed ("2 new gigs nearby · Show"), gigs that close or fill disappear from every deck, chats, applications and invites refresh instantly, and a forced update applies within seconds (the server restarts when its version settings change; apps reconnect and re-check). The web app checks for a new version every minute and reloads into it.
- **When the app is closed**, job seekers get a push notification when a gig is posted inside *their own* working range ("New gig near you: Cafe helper · ₹600/day · 1.2 km away"). Tapping it opens the gig. People can turn this off in Settings → New gig alerts; at most 6 alerts per person per hour.
  - **Web app (Android, iPhone Home Screen app, Windows, Mac):** Web Push. Set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` on the server.
  - **Android app:** Firebase Cloud Messaging. Create a Firebase project → add an Android app with package `com.gigswipe.app` → download `google-services.json` into `gigswipe_rn/android/app/` and rebuild. On the server set `FIREBASE_SERVICE_ACCOUNT` (Project settings → Service accounts → Generate new private key).
  - Without these settings the app works normally; only the closed-app notifications are off.

## Releasing an update

The app checks its version against the server on every launch, like banking apps:

- **Optional update:** a bar says "A new version is available".
- **Required update:** a full-screen page blocks the app until the user installs the new version. The server also refuses API calls from that old version (HTTP 426).

To release version 1.1.0:

1. Set `"version": "1.1.0"` in `gigswipe_rn/package.json`. That's the only place; Android's versionName/versionCode follow it.
2. Build the APK (see above) and upload it to your website, replacing the old file.
3. In Render → Environment, set `ANDROID_LATEST_VERSION=1.1.0`. To make the update compulsory, also set `ANDROID_MIN_VERSION=1.1.0`. Use the same `IOS_*` keys for the iPhone app.

Users install the new APK over the old one and keep their login, as long as it's signed with the same release key.

## Environment Variables

`backend/.env`

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Secret used to sign login tokens. Use a long random string. |
| `PORT` | ❌ | Server port (default `3001`) |
| `GOOGLE_GEOCODING_API_KEY` | ❌ | Better area names from GPS (falls back to OpenStreetMap) |
| `TRUST_PROXY` | ❌ | Set to `1` behind a proxy/load balancer |
| `SMTP_USER` | ❌ | Email account that sends OTP codes (e.g. a Gmail address) |
| `SMTP_PASS` | ❌ | Its app password (Gmail: myaccount.google.com/apppasswords) |
| `SMTP_FROM` | ❌ | Sender shown in emails, e.g. `GigSwipe <you@gmail.com>` |
| `SMTP_HOST` / `SMTP_PORT` | ❌ | Only for non-Gmail providers (Brevo, Resend, Zoho…) |
| `APP_DOWNLOAD_URL` | ❌ | Where users download the app (shown on "Update required") |
| `ANDROID_LATEST_VERSION` / `ANDROID_MIN_VERSION` | ❌ | Newest version / oldest version still allowed (also `IOS_*`, and optional `ANDROID_UPDATE_URL`, `ANDROID_UPDATE_MESSAGE`) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | ❌ | Web Push keys for the PWA's notifications (`npx web-push generate-vapid-keys`) |
| `FIREBASE_SERVICE_ACCOUNT` | ❌ | Firebase service-account JSON (or base64 of it) for Android push |
| `CURRENCY_SYMBOL` | ❌ | Shown in gig pay, e.g. `₹800/day` (default `₹`). Use the same value in `gigswipe_rn/.env`. |

> ⚠️ Never commit your `.env` file. It is already listed in `backend/.gitignore`.

---

## API Reference

Base URL: `http://<host>:3001/api`
🔒 = requires an `Authorization: Bearer <token>` header

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Create an account (`name`, `email`, `password`, `role`: `worker` \| `business`) |
| POST | `/auth/login` | Log in, returns `{ token, user }` |
| POST | `/auth/forgot-password` | Email a 6-digit reset code (same answer whether or not the email exists) |
| POST | `/auth/reset-password` | `email`, `code`, `newPassword` → new password, returns `{ token, user }` |
| POST | `/auth/email/send-code` 🔒 | Email a verification code to your own address |
| POST | `/auth/email/verify` 🔒 | `code` → marks the email verified (badge on profile) |
| GET | `/auth/me` 🔒 | Current user |
| PUT | `/auth/profile` 🔒 | Update profile, location, radius, `photoUrl`, `availability`, `availabilityNote`, `availableUntil` ("available now"), `discoverable` |
| PUT | `/auth/password` 🔒 | Change password (`currentPassword`, `newPassword`) |

### Gigs
| Method | Endpoint | Description |
|---|---|---|
| GET | `/gigs` | Swipe feed: open, not-ended gigs, nearest first. Filters: `q`, `category` (comma list), `mode`, `payUnit` + `minPay`, `from` + `to` (ISO), `radius` |
| GET | `/gigs/categories` | Category list and currency symbol |
| GET | `/gigs/mine` 🔒 | Gigs posted by the current job giver, with applicant counts |
| GET | `/gigs/history` 🔒 | Posted gigs with the workers hired for each |
| GET | `/gigs/:id` | Single gig (plus `viewer.saved` / `viewer.applicationId` for a signed-in job seeker) |
| POST | `/gigs` 🔒 | Create a gig: `title`, `payAmount`, `payUnit`, `category`, `workMode`, `description`, optional `startAt`/`endAt`, `openings`, `photos`, `hours` (notes), `location` |
| PUT | `/gigs/:id` 🔒 | Edit any of those fields, or `status`: `open` \| `closed` |
| DELETE | `/gigs/:id` 🔒 | Delete your own gig |

### Saved gigs
| Method | Endpoint | Description |
|---|---|---|
| GET | `/saved` 🔒 | Saved gigs (job seekers) |
| POST | `/saved` 🔒 | Save a gig (`gigId`) |
| DELETE | `/saved/:gigId` 🔒 | Remove from saved |

### Invites
| Method | Endpoint | Description |
|---|---|---|
| GET | `/invites/options/:workerId` 🔒 | Your open gigs, marked if this person was already invited / applied |
| POST | `/invites` 🔒 | Invite a job seeker (`gigId`, `workerId`, optional `message`) |
| GET | `/invites/mine` 🔒 | Pending invites for the job seeker |
| POST | `/invites/:id/accept` 🔒 | Accept → applies and returns the application |
| POST | `/invites/:id/decline` 🔒 | Decline |

### Uploads
| Method | Endpoint | Description |
|---|---|---|
| POST | `/uploads` 🔒 | Upload a photo as base64 JSON (`data`); JPEG/PNG/WebP, max 3 MB. Returns `{ id, url }` |
| GET | `/uploads/:id` | The image (public, cached) |

### Applications
| Method | Endpoint | Description |
|---|---|---|
| POST | `/applications` 🔒 | Apply to a gig (`gigId`) |
| GET | `/applications/mine` 🔒 | Job seeker's applications (Matches) |
| GET | `/applications/inbox` 🔒 | All conversations for the current user, with unread counts |
| GET | `/applications/gig/:gigId` 🔒 | Applicants for one of your gigs |
| GET | `/applications/hired` 🔒 | All hired applications for the current user |
| GET | `/applications/with/:userId` 🔒 | Shared applications with another user |
| GET | `/applications/work-history` 🔒 | Job seeker's completed gigs |
| GET | `/applications/:id` 🔒 | Single application |
| PATCH | `/applications/:id` 🔒 | Set status: `accepted` \| `rejected` (hiring only happens via verify-hire) |
| DELETE | `/applications/:id` 🔒 | Job seeker withdraws a pending application (used by Undo) |
| POST | `/applications/:id/hire-request` 🔒 | Generate a new 4-digit hire code |
| POST | `/applications/:id/verify-hire` 🔒 | Confirm the hire with the code (`code`) |

### Chat
| Method | Endpoint | Description |
|---|---|---|
| GET | `/chat/:applicationId` 🔒 | All messages in a thread |
| POST | `/chat/:applicationId/message` 🔒 | Send a message (REST fallback if the socket is down) |
| POST | `/chat/:applicationId/read` 🔒 | Mark a conversation as read |

### Location
| Method | Endpoint | Description |
|---|---|---|
| GET | `/geo/reverse?lat=&lng=` 🔒 | Turns coordinates into an area name |

### Ratings
| Method | Endpoint | Description |
|---|---|---|
| POST | `/ratings` 🔒 | Rate the other party (`applicationId`, `stars` 1–5, optional `review`) |
| GET | `/ratings/given` 🔒 | Application IDs you've already rated |
| GET | `/ratings/user/:userId` | Average rating, total count and 10 most recent reviews |

### Users
| Method | Endpoint | Description |
|---|---|---|
| GET | `/users/workers` 🔒 | Job givers: nearby job seekers. Filters: `q`, `availableNow=1`, `slot`, `radius` |
| GET | `/users/:userId` | Public profile, gigs completed and workers hired |

### App version
| Method | Endpoint | Description |
|---|---|---|
| GET | `/app/version?platform=android&version=1.0.0` | `updateRequired`, `updateAvailable`, `latest`, `minimum`, `updateUrl` |

### Push
| Method | Endpoint | Description |
|---|---|---|
| GET | `/push/config` | Web Push public key and which push channels are enabled |
| POST | `/push/register` 🔒 | `{ platform: 'web', subscription }` or `{ platform: 'android', token }`, plus `lang` |
| POST | `/push/unregister` 🔒 | `{ token }` (FCM token or Web Push endpoint), on sign-out |

### Health
| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Server and database status |
| GET | `/api/db-test` | Checks that the MongoDB connection is live |

---

## Real-time Events

Socket.io runs on the same port as the REST API.

| Event | Direction | Payload |
|---|---|---|
| `join_chat` | client → server | `applicationId` (with ack) |
| `send_message` | client → server | `{ applicationId, text, clientId? }` (ack returns the saved message) |
| `new_message` | server → room | `Message` object |
| `inbox_update` | server → user | `{ applicationId }` when a conversation changes |
| `application_update` | server → user | `{ applicationId, status }` when an application changes (`withdrawn` when a job seeker withdraws) |
| `invite_update` | server → user | `{ inviteId, status }` when an invite is sent, accepted or declined |
| `gig_new` | server → job seekers in range | `{ gigId }` when a gig is posted or reopened nearby (`remote: true` for remote gigs, sent to all) |
| `gig_closed` | server → all job seekers | `{ gigId }` when a gig is closed, filled or deleted |

Sockets must connect with `auth: { token }` (the login JWT). The sender is always taken from the token, and only the job seeker and job giver on an application can join or post to its chat.

---

## Data Models

- **User**: `email`, `role` (`worker` / `business`), `name`, `photoUrl`, profile fields (bio, skills, sample work, business name, industry, website, phone), `availability` (slots), `availabilityNote`, `availableUntil`, `discoverable`, `locationLabel`, `latitude`, `longitude`, `radiusMiles`, `geo` (GeoJSON Point for worker search)
- **Gig**: `title`, `payAmount`, `payUnit` (`hour`/`day`/`week`/`month`/`fixed`), `pay` (display text), `startAt`, `endAt`, `openings`, `hiredCount`, `status` (`open`/`filled`/`closed`), `photos`, `hours` (notes), `description`, `category`, `workMode` (`onsite` / `remote`), `location`, `geo` (GeoJSON Point, `2dsphere` indexed)
- **Application**: `gigId`, `workerId`, `businessId`, `status` (`pending` → `accepted` → `hired`, or `rejected`), `hireCode`, `hireCodeExpiry`
- **Message**: `applicationId`, `senderId`, `senderRole`, `text`, `timestamp`
- **Rating**: `rater`, `ratee`, `applicationId`, `stars` (1–5), `review`. Unique per rater per application.
- **SavedGig**: `userId`, `gigId` (unique pair)
- **Invite**: `gigId`, `businessId`, `workerId`, `message`, `status` (`pending` / `accepted` / `declined`), `applicationId`
- **Upload**: `ownerId`, `contentType`, `size`, `data` (photos are resized on the phone, ~100–400 KB each)

---

## Current Limitations

This project is an MVP under active development.

- Android only for now (the iOS project hasn't been set up yet).
- No server push notifications yet (gig reminders are scheduled on the phone; new-message alerts need Firebase Cloud Messaging).
- Photos are stored in MongoDB. Move them to S3 / Cloudinary when traffic grows.
- No in-app payments yet.
- Not yet published to the App Store or Google Play.

---

## Roadmap

- [x] Two-role marketplace (Job Seeker / Job Giver)
- [x] Swipe feed with geospatial ranking
- [x] Map view and native directions
- [x] Real-time chat
- [x] Hire code verification
- [x] Two-way ratings and reviews
- [x] Persist applications and messages in MongoDB
- [x] Bare React Native Android app (`gigswipe_rn/`)
- [x] Unread message counts and live list updates
- [x] Environment-based backend URL config (React Native app)
- [x] Search and filters (pay, date, category, remote, distance)
- [x] Save for later and undo swipe
- [x] Gig dates/times, auto-expiry, number of openings, edit / close / repost
- [x] Profile and gig photos
- [x] Availability and "Available now"
- [x] Worker search and invites
- [x] Quick replies in chat
- [x] On-device gig reminders
- [x] Hindi language
- [x] Live feed updates and push alerts for new gigs nearby
- [ ] Push notifications for new messages and applications
- [x] Forgot password and email verification (email OTP)
- [ ] Report / block, delete account, phone OTP
- [ ] In-app payments and payouts
- [ ] ID verification and verified badges
- [ ] Smart matching (skills → gigs)
- [ ] App Store and Play Store release

---

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## License

This project is currently unlicensed (all rights reserved). Add a `LICENSE` file to choose one, for example MIT.
