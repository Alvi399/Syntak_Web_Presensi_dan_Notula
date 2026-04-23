# Frontend Architecture - Syntak

This document outlines the design patterns and architectural choices for the Syntak frontend.

## Tech Stack
- **Framework**: React 18 with Vite
- **Language**: TypeScript
- **State Management**: 
  - **Server State**: TanStack Query (v5)
  - **Global State**: Zustand
  - **Local State**: React `useState`
- **Styling**: Tailwind CSS + shadcn/ui
- **Forms**: React Hook Form + Zod validation
- **Routing**: React Router DOM (v6)

## Directory Structure
- `src/components/ui/`: Low-level, reusable UI components (from shadcn/ui).
- `src/components/`: Business-level components (Layout, Sidebar, Navbar).
- `src/pages/`: Main view components representing routes.
- `src/lib/`: Unified utilities and service clients.
- `src/hooks/`: Custom React hooks (real-time, auth, etc.).

## Key Design Patterns

### 1. Unified API Client
The `apiClient` in `src/lib/api.ts` handles:
- Base URL configuration.
- Consensus with the backend's result format (`{ success, message, data }`).

### 2. Real-time Synchronization
The `useRealTimeUpdates` hook listens to the backend SSE stream. When it receives a `data_update` event, it automatically invalidates TanStack Query caches, ensuring the UI stays fresh without manual refreshes.

### 3. Presence Logic
The `Presensi.tsx` page handles multiple check-in modes:
- **QR Scanning**: Uses `html5-qrcode` to scan session tokens.
- **Manual Check-in**: For admin/bypass roles.
- **Guest Check-in**: Anonymous form with signature capture.

### 4. Signature Component
A custom `SignaturePad` component converts touch/mouse draws to base64, which is stored directly in the MySQL `LONGTEXT` fields.

### 5. PDF Generation & Handling
Syntak uses `html2canvas` and `jspdf` to generate meeting minutes and invitations as PDF documents on the client side, while also supporting direct PDF uploads for existing documents.

## Design Principles
- **Wow Factor**: Interactive dashboards with smooth transitions.
- **Accessibility**: ARIA-compliant components from Radix UI (via shadcn).
- **Responsive**: Mobile-first design for easy attendance scanning on the go.
