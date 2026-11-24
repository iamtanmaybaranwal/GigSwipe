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
- **Swipe feed**: gigs appear as animated cards. Swipe right (or tap ❤️) to apply, swipe left to skip.
- **Nearest first**: gigs are ranked by distance using a MongoDB geospatial (`2dsphere` + `$geoNear`) query.
- **Your own range**: choose a comfortable travel radius of 2, 5, 10, 25, 50 or 100 miles.
- **Map view**: every nearby gig as a pin on a map.
- **One-tap directions**: opens Apple Maps or Google Maps. No API key needed.
- **Remote gigs**: work-from-home gigs are supported and clearly labelled.
- **Matches**: every application opens a chat thread with the employer.
- **Hire code**: once accepted, you get a 4-digit code to show the employer in person.
- **Profile**: bio, skills, portfolio links, ratings, reviews and work history.

### For Job Givers 🏪
- **Post a gig in about 60 seconds**: title, pay, hours, on-site or remote, location, category, description.
- **Dashboard**: active gigs, total applicants, total hires.
- **Applicant review**: see each applicant's bio, skills and ratings, then accept or reject.
- **Real-time chat** with applicants.
- **Verified hiring**: enter the worker's 4-digit code to confirm the hire. Codes expire after 24 hours.
- **Business profile**: industry, location, website, phone, about section and gig history.

### Trust & Safety 🔒
- **Hire code verification** confirms the right person showed up for the job.
- **Two-way ratings**: both sides rate each other (1–5 stars plus an optional review of up to 500 characters). Rating is only allowed after a real working relationship, and only once per job.
- **Public profiles** show average rating, gigs completed and workers hired.
- **Secure auth**: passwords hashed with bcrypt, JWT sessions, password hashes never returned by the API.

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

**Gig categories:** Food & Beverage, Marketing, Events, Creative, Retail, Admin, Tech, Other

**Supported industries:** Food & Beverage, Retail, Events & Entertainment, Marketing & Media, Technology, Healthcare, Education, Non-profit, Real Estate, Other

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile app (Android) | Bare React Native 0.88 (New Architecture, Hermes), React 19, TypeScript |
| Navigation | React Navigation 7 (native stack + bottom tabs) |
| Animations & gestures | React Native `Animated` + `PanResponder` (native driver) |
| Maps & location | `react-native-maps` (Google Maps), `@react-native-community/geolocation` |
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

## Environment Variables

`backend/.env`

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Secret used to sign login tokens. Use a long random string. |
| `PORT` | ❌ | Server port (default `3001`) |
| `GOOGLE_GEOCODING_API_KEY` | ❌ | Better area names from GPS (falls back to OpenStreetMap) |
| `TRUST_PROXY` | ❌ | Set to `1` behind a proxy/load balancer |

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
| GET | `/auth/me` 🔒 | Current user |
| PUT | `/auth/profile` 🔒 | Update profile, location and radius |
| PUT | `/auth/password` 🔒 | Change password (`currentPassword`, `newPassword`) |

### Gigs
| Method | Endpoint | Description |
|---|---|---|
| GET | `/gigs` | Swipe feed. Personalised and sorted by distance when signed in with a location set. |
| GET | `/gigs/mine` 🔒 | Gigs posted by the current job giver |
| GET | `/gigs/history` 🔒 | Posted gigs with the workers hired for each |
| GET | `/gigs/:id` | Single gig |
| POST | `/gigs` 🔒 | Create a gig (job givers only) |
| DELETE | `/gigs/:id` 🔒 | Delete your own gig |

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
| GET | `/users/:userId` | Public profile, gigs completed and workers hired |

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
| `application_update` | server → user | `{ applicationId, status }` when an application changes |

Sockets must connect with `auth: { token }` (the login JWT). The sender is always taken from the token, and only the job seeker and job giver on an application can join or post to its chat.

---

## Data Models

- **User**: `email`, `role` (`worker` / `business`), `name`, profile fields (bio, skills, sample work, business name, industry, website, phone), `locationLabel`, `latitude`, `longitude`, `radiusMiles`
- **Gig**: `title`, `pay`, `hours`, `description`, `category`, `workMode` (`onsite` / `remote`), `location`, `geo` (GeoJSON Point, `2dsphere` indexed)
- **Application**: `gigId`, `workerId`, `businessId`, `status` (`pending` → `accepted` → `hired`, or `rejected`), `hireCode`, `hireCodeExpiry`
- **Message**: `applicationId`, `senderId`, `senderRole`, `text`, `timestamp`
- **Rating**: `rater`, `ratee`, `applicationId`, `stars` (1–5), `review`. Unique per rater per application.

---

## Current Limitations

This project is an MVP under active development.

- Android only for now (the iOS project hasn't been set up yet).
- No push notifications yet.
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
- [ ] Push notifications
- [x] Environment-based backend URL config (React Native app)
- [ ] Filters (pay, category, remote, distance)
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
