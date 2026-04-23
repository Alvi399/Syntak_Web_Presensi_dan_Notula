# Backend System - Syntak

This document explains the technical architecture and core mechanisms of the Syntak backend.

## Tech Stack
- **Server**: Node.js with Express.js
- **Database**: MySQL (Hostinger Managed MySQL)
- **Email**: Nodemailer (Hostinger SMTP)
- **Real-time**: Server-Sent Events (SSE)
- **Security**: bcryptjs for passwords, randomUUID for IDs

## Core Mechanisms

### 1. Timezone Management (WIB - UTC+7)
Syntak is designed for BPS Kota Surabaya (WIB timezone). Since server environments (like Hostinger) often run in UTC, the backend implements a robust WIB handling:
- **`getNowWIB()`**: Returns a Date object shifted by +7 hours.
- **MySQL Configuration**: Connected with `timezone: 'Z'` (Treat DB as UTC) but queries often use `CONVERT_TZ` or shifted timestamps to ensure consistent WIB storage.
- **Date Formatting**: `formatDateLocal` and `formatTimeWIB` ensure that strings sent to the frontend are always in Jakarta time regardless of where the server or browser is located.

### 2. Database Resilience
The backend implements `executeWithRetry` to handle common connectivity issues on managed hosting (e.g., `ECONNRESET` or idle connection drops). It attempts to re-execute queries up to 3 times with exponential backoff before failing.

### 3. Server-Sent Events (SSE)
SSE is used for real-time updates without the overhead of WebSockets.
- **Endpoint**: `GET /api/sse/:userId`
- **Clients**: Map of `userId` -> `Response Object`.
- **Events**:
  - `data_update`: Triggers frontend refetches when shared data (users, schedules) changes.
  - `notification`: Pushes new in-app alerts to users immediately.
  - `broadcast_progress`: Real-time percentage tracking for email/notif blasts.
  - `heartbeat`: Keeps the connection alive every 30 seconds.

### 4. Authentication Flow (OTP)
Registration and critical actions are guarded by email OTP:
1. User requests OTP via `/api/auth/send-otp`.
2. OTP is stored in the `otps` table with 5-minute expiry.
3. User verifies OTP via `/api/auth/verify-otp`.
4. Verified OTP ID is checked during final registration/action.

### 5. Notification System
Syntak uses a dual-channel notification system:
- **In-App**: Stored in `notifications` table, pushed via SSE.
- **Email**: Blasted via Nodemailer using a connection pool for stability during high-volume broadcasts (e.g., meeting invitations).

### 6. Logging
The system includes a global Request/Response logger middleware that:
- Records method, path, status, and duration.
- Sanitizes sensitive data (passwords, OTPs) from logs.
- Stores persistent logs in the `activity_logs` table for critical administrative actions.
