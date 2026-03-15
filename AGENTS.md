# AGENTS.md - Syntak Project

## Project Overview
Syntak is an internal attendance, minutes, invitation, and meeting schedule management system for BPS Kota Surabaya. Built with React + Vite + TypeScript (frontend) and Node.js Express + MySQL (backend).

---

## Build / Lint / Test Commands

### Development
```bash
# Run frontend only (Vite on port 5173)
pnpm dev

# Run backend only (Express on port 3001)
pnpm dev:backend

# Run both frontend and backend concurrently
pnpm start
```

### Production
```bash
# Build frontend for production
pnpm build

# Preview production build
pnpm preview
```

### Linting
```bash
# Lint frontend code (eslint --quiet)
pnpm lint
```

**Note:** There are no test commands defined in this project. Do not add tests unless explicitly requested.

---

## Code Style Guidelines

### General
- Use **single quotes** for strings (`'string'`, not `"string"`)
- Use **semicolons** at the end of statements
- Use **ES modules** (import/export), not CommonJS
- Use **TypeScript** for all new frontend code (`.ts` for utilities, `.tsx` for components)
- Backend uses plain JavaScript with ES modules (`.js`)

### File Naming
- **Pages/Components**: PascalCase (`Login.tsx`, `AdminPanel.tsx`)
- **Utilities/Services**: camelCase (`authService.ts`, `dataService.ts`, `utils.ts`)
- **UI Components**: kebab-case (`button.tsx`, `input-otp.tsx`)

### Imports & Path Aliases
- Use the `@/*` alias for imports from `src/`
  ```typescript
  import { Button } from '@/components/ui/button';
  import { authService } from '@/lib/authService';
  import { cn } from '@/lib/utils';
  ```
- Order imports: external libs → internal components → utilities → types

### TypeScript Conventions
- Use **explicit return types** for functions where beneficial
- Use **interfaces** for object shapes, **types** for unions/aliases
- Example:
  ```typescript
  interface User {
    id: string;
    nama: string;
    email: string;
    role: 'user' | 'admin' | 'tamu';
  }

  type LoginResponse = { success: boolean; message: string; user?: User };
  ```
- `strict: false` is enabled in tsconfig, but prefer type-safe code when possible

### React Patterns
- Use **functional components** with arrow functions or `function` keyword
- Use **react-hook-form** for form handling with **zod** validation
- Use **TanStack Query** (`@tanstack/react-query`) for data fetching
- Use **Zustand** for global state management
- Always handle loading and error states in components

### Error Handling
- Use try/catch with proper error logging:
  ```typescript
  try {
    const result = await apiClient.post('/endpoint', data);
    return result;
  } catch (error: any) {
    console.error('Operation failed:', error);
    return { success: false, message: error.message || 'Default error message' };
  }
  ```
- Return consistent response objects from services (`{ success: boolean; message: string; ... }`)

### UI Components (shadcn/ui)
- Use existing shadcn/ui components from `src/components/ui/`
- Use `cn()` utility for merging Tailwind classes:
  ```typescript
  import { cn } from '@/lib/utils';
  
  <div className={cn("base-class", isActive && "active-class")} />
  ```
- Follow Tailwind CSS conventions in component styling

### State Management
- Use **Zustand** for global client state
- Use **TanStack Query** for server state (API calls)
- Use **React useState** for local component state
- Keep state as close to where it's used as possible

### Backend Conventions (server/)
- Express.js with async route handlers
- MySQL via `mysql2/promise` connection pool
- Use environment variables from `server/.env`
- Password hashing with `bcryptjs`
- Email via `nodemailer` with connection pooling
- Helper functions for date formatting (local timezone)

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `Login.tsx`, `Sidebar` |
| Functions | camelCase | `handleLogin`, `formatDate` |
| Variables | camelCase | `isLoading`, `userData` |
| Interfaces/Types | PascalCase | `User`, `LoginResponse` |
| Constants | UPPER_SNAKE_CASE | `API_BASE_URL` |
| CSS Classes | kebab-case | `bg-blue-500`, `text-center` |

---

## Database

- **MySQL** database named `absensi_notulensi`
- Configuration in `server/.env`
- Tables: `users`, `absensi`, `notulensi`, `undangan`, `jadwal_rapat`, `activity_logs`, `otps`, `qr_absensi_codes`
- Admin default credentials: `admin@absensi.com` / `admin123`

---

## Important Notes

1. **No tests exist** - Do not write tests unless explicitly requested
2. **Patch in main.tsx** - DOM manipulation patches exist to prevent crashes from browser extensions
3. **Email optional** - If `EMAIL_USER`/`EMAIL_PASS` not set, email features are skipped gracefully
4. **Run both services** - Frontend (5173) and Backend (3001) must run together for full functionality
