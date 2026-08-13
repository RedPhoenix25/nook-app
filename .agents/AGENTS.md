# AGENTS.md — Agent System Rules & Project Constraints

## 1. Project Tech Stack
- **Framework:** Expo (React Native) with Expo Router (File-based navigation).
- **Styling:** NativeWind v4 (Tailwind CSS).
- **Backend:** Supabase (`@supabase/supabase-js` for Auth, DB, Realtime, Storage).
- **Auth Persistence:** `expo-secure-store`.
- **Language:** TypeScript (Strict mode enabled).

---

## 2. Design System & Aesthetic Principles

### UI & Visual Constraints
- **Background Palette:** Default background MUST be Warm Cream (`#FDFBF7`). Avoid stark `#FFFFFF` screen backgrounds.
- **Accent Colors:** Primary actions and buttons must use Warm Terracotta (`#E06D53`) or Muted Sage tones.
- **Card Aesthetics:** 
  - Standard Cards: Rounded corners (`rounded-3xl`), crisp white fill (`bg-white`), and fine neutral borders (`border border-neutral-200/70`).
  - Polaroid Media Cards: Outer wrapper styled as a soft frame with photo rounded inner borders (`rounded-2xl`).
- **Typography:** Serif font treatment for daily prompt headlines and journal entry titles; clean Sans-Serif for body text and micro-copy.
- **Alerts & Dialogues:** Avoid using default OS alerts (`Alert.alert`) for destructive actions or important confirmations. Always implement beautifully themed custom Modals that align with the design system.

---

## 3. Database Architecture & Row-Level Security (RLS)

### Schema Constraints
- **Space-Centric Schema:** All entries, photos, and prompt responses MUST reference `space_id` rather than hardcoding pair relationship IDs (`user_a_id` / `user_b_id`). This ensures zero schema rewrites when expanding to group circles in future phases.

### Mandatory RLS Rules
- RLS MUST be enabled on every table (`ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`).
- Users can ONLY select, insert, update, or delete data belonging to a `space_id` listed in their active `space_members` record.

---

## 4. Product & Logic Enforcement

### Dual-Unlock Mechanism
- When fetching responses for daily prompts:
  - If both active members in the `space_id` have completed today's prompt, reveal both full text/media contents.
  - If only one user has submitted, return a blurred/redacted status block for the missing partner response.

### Pairing Flow
- Space initialization generates a unique, non-guessable 6-character alphanumeric `invite_code`.
- Users must be directed through the `(onboarding)` pairing flow before accessing main `(app)` feed routes.

---

## 5. Coding & Developer Standards
- **No `any` Types:** Strictly define explicit interfaces and database types in `types/database.types.ts`.
- **Component Cleanliness:** Modularize reusable UI elements (e.g., PromptCard, Header, PolaroidCard) in `components/ui/`.
- **Complete Outputs:** Always provide complete, copy-pasteable code blocks when writing or editing files. Do not use placeholders or truncated code snippets.
- **Development Log Maintenance:** Any time a new feature is added or a change is made to the codebase, you MUST update `DEVELOPMENT_LOG.md` to record what was accomplished and keep the "To Do" section accurate.
