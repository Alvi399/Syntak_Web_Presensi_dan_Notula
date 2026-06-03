# AI Agent Guide — Syntak Project

This document serves as the master guide for AI agents working on the **Syntak** project. It outlines the core architecture, configuration, critical design patterns, codebase conventions, and common pitfalls to ensure seamless integration and avoid regressions.

---

## 📋 1. Project Overview

**Syntak** is an internal attendance, meeting minutes, invitation, and scheduling management system for **BPS Kota Surabaya**.

*   **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui.
*   **Backend**: Node.js Express + MySQL (`mysql2/promise` connection pool).
*   **Database**: MySQL (`absensi_notulensi`).
*   **Key Features**:
    *   Employee/Intern attendance with digital signature storage.
    *   Guest attendance via QR Code (no login required).
    *   Meeting minutes (Notula) with Nodemailer SMTP email broadcast.
    *   Real-time notifications and broadcast progress via Server-Sent Events (SSE).
    *   User blocking/unblocking with automatic expiration.

---

## ⚙️ 2. Commands & Development Setup

AI agents must adhere to the following development commands:

```bash
# Run both frontend and backend concurrently (Recommended)
pnpm start

# Run frontend only (Vite on port 5173)
pnpm dev

# Run backend only (Express on port 3001)
pnpm dev:backend

# Lint frontend code
pnpm lint

# Build frontend for production
pnpm build
```

> [!WARNING]
> **No Test Environment**: There are no tests defined in this project. **Do NOT write or add tests** unless explicitly requested by the user.

---

## 🕒 3. Critical Pattern: Timezone Management (WIB - UTC+7)

The application targets **BPS Kota Surabaya**, which operates in the **WIB (UTC+7)** timezone. Since hosting servers (e.g., Hostinger) run in **UTC**, the backend implements a specific timezone handling strategy to prevent date/time shifting.

### A. Database Connection Timezone
The MySQL connection pool is configured with `timezone: 'Z'` (Treat DB times as UTC to prevent incorrect auto-conversion by `mysql2`), but the database schema uses local timezone context, and queries often use `CONVERT_TZ` or shifted timestamps.

### B. Node.js WIB Helper Functions
In `server/index.js`, all date and time generations must use the following custom helpers:

1.  **`getNowWIB()`**: Returns a `Date` object representing the current WIB time (shifted by +7 hours).
    ```javascript
    function getNowWIB() {
      const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
      return new Date(Date.now() + WIB_OFFSET_MS);
    }
    ```
2.  **`formatDateLocal(dateInput)`**: Converts strings, datetimes, and Date objects to `'YYYY-MM-DD'` in WIB.
3.  **`formatTimeWIB(dateObj)`**: Formats a Date object to `'HH:MM:SS'` using `getUTC*` methods, since the Date object returned by `getNowWIB()` already has WIB values mapped to its UTC fields.
    ```javascript
    function formatTimeWIB(dateObj) {
      const hh = String(dateObj.getUTCHours()).padStart(2, '0');
      const mm = String(dateObj.getUTCMinutes()).padStart(2, '0');
      const ss = String(dateObj.getUTCSeconds()).padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    }
    ```

### C. Lateness and Expiry Comparisons
*   **Comparison Logic**: When comparing current time against database timestamps (e.g., in `lateness_threshold_minutes` or QR expiry checks), convert both to the same reference frame.
*   **Bug Prevention**: Ensure you do not add a double offset (i.e. applying `+7 hours` to a Date object that was already generated via `getNowWIB()`).

---

## 🛡️ 4. Database Resilience (ECONNRESET & Auto-Retry)

Hostinger managed MySQL databases frequently drop idle connections. To prevent API endpoints from crashing with `ECONNRESET` or `PROTOCOL_CONNECTION_LOST`, the backend implements a retry wrapper:

```javascript
const executeWithRetry = async (sql, params = [], retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await pool.execute(sql, params);
    } catch (err) {
      const isRetryable = err.code === 'ECONNRESET' || 
                          err.code === 'PROTOCOL_CONNECTION_LOST' || 
                          err.code === 'ECONNREFUSED';
      if (isRetryable && attempt < retries) {
        const delay = 500 * attempt;
        console.warn(`[DB] ${err.code} — retry ${attempt}/${retries - 1} after ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
};
```

> [IMPORTANT]
> **Always use `executeWithRetry(...)`** instead of raw `pool.execute(...)` for all critical query endpoints (especially in `/api/jadwal-rapat`, `/api/qr`, and `/api/absensi`).

---

## 📡 5. Real-Time Sync & SSE Infrastructure

Syntak uses **Server-Sent Events (SSE)** via `GET /api/sse/:userId` to push real-time updates and notification state without WebSockets overhead.

*   **sseClients**: A global `Map` in `server/index.js` mapping `userId` -> array of active response objects.
*   **`emitSse(event, data, targetUserIds)`**: Sends real-time payload updates.
    *   If `targetUserIds` is `null`, it broadcasts to all connected clients.
    *   Example: `emitSse('data_update', { type: 'user' })` triggers automatic TanStack Query invalidation in the frontend.

---

## ✉️ 6. SMTP Email Pool & Broadcasts

*   **transporter**: Nodemailer connection pool configured with `pool: true` and `maxConnections: 5`.
*   **Fire-and-forget**: The function `sendOtpEmail()` and other broadcast notifications are sent asynchronously and do **NOT** block the main Express API response thread.
*   **Graceful Degradation**: If `EMAIL_USER` or `EMAIL_PASS` is missing from `server/.env`, email broadcast features are skipped gracefully without causing runtime errors.

---

## 🎨 7. Code Style & Conventions

AI agents must write clean code following these standards:

### General Rules
*   Use **single quotes** for strings (`'string'`).
*   Use **semicolons** at the end of statements.
*   Use **ES modules** (`import`/`export`), not CommonJS.
*   Frontend: **TypeScript** (use `.ts` for utilities, `.tsx` for components).
*   Backend: **Plain JavaScript** with ES modules (`.js`).

### Naming Conventions
*   **Pages & Components**: PascalCase (`Login.tsx`, `AdminPanel.tsx`).
*   **UI Components**: kebab-case (`button.tsx`, `input-otp.tsx`).
*   **Utilities/Services**: camelCase (`authService.ts`, `dataService.ts`).
*   **Variables/Functions**: camelCase (`isLoading`, `handleLogin()`).
*   **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`).

### Paths
*   Use `@/*` absolute path alias to import from frontend `src/`:
    ```typescript
    import { Button } from '@/components/ui/button';
    import { cn } from '@/lib/utils';
    ```

---

## ⚠️ 8. Critical Caveats & Workarounds

### A. Browser Extensions DOM Crash Patch
Some browser extensions (password managers, ad blockers) modify the DOM, causing React to crash with `removeChild` or `insertBefore` failures. The project contains a native DOM wrapper patch at the top of `src/main.tsx` to handle this. **Do NOT touch or remove this patch.**

### B. Safe JSON Parsing
Database fields storing JSON (such as `tim`, `peserta`, or `peserta_spesifik` in the `jadwal_rapat` table) might sometimes be `null` or corrupted. Always use a defensive parsing helper (e.g. `safeJsonParse()`) inside database mapping loops to prevent silent database-to-API rendering failures.

### C. Auto-Unblock Logic
Users can be blocked by admins with a designated `block_reason`.
*   If reason is `'izin-telat'`: Automatically unblocks at **15:00 WIB** on the same day.
*   Other reasons: Automatically unblocks at **midnight (00:00 WIB)** of the next day.
*   The check is evaluated and updated automatically during the login request flow.
