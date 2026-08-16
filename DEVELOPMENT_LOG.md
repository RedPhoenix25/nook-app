# Development Log & Roadmap

This file serves as the central source of truth for the project's development progress. It records what has been accomplished, what is currently being worked on, and what remains to be built.

## Accomplished
- **Project Scaffolding**: Initialized Expo (React Native) project with Expo Router. Upgraded through SDK 53 → 54 → 55 to match Expo Go auto-updates.
- **Styling Setup**: Integrated NativeWind v4 (Tailwind CSS) with custom theme colors (Warm Cream `#FDFBF7`, Warm Terracotta `#E06D53`, Muted Sage).

### Date: 2026-08-12
- **Local-First Offline Architecture**: Completely migrated the app to use a local `expo-sqlite` database.
  - Setup local tables (`notes`, `daily_prompts`, `prompt_responses`) in `lib/database.ts`.
  - Built a background `SyncProvider` (`useSyncEngine.ts`) that listens to network connectivity (`@react-native-community/netinfo`).
  - Implemented an `offline_mutations` queue that stores actions (inserts/updates/deletes) and pushes them to Supabase in the background when online.
  - Refactored `useFeed`, `useDailyPrompt`, and `useMemories` to read exclusively from the local SQLite database for instant (0ms) load times.
  - **Fixed Sync Engine Reliability**: Updated the syncer to auto-clear unrecoverable mutation errors (e.g. RLS 42501) that were permanently blocking the offline queue. Fixed stale closures in Realtime listeners using refs. Added a periodic fallback sync interval (10s) to catch dropped WebSocket events. Fixed the stale-note delete logic so it correctly avoids deleting fresh notes that are still pending upload.
  - **Fixed Android Image Uploads**: Modified `CreateNoteModal` to instantly upload images to Supabase using the base64 data already in memory instead of relying on unstable `file://` temporary paths that were getting deleted by Android before the background sync could process them.
  - **Fixed Authorship Tagging**: Added the partner's `id` to `SpaceMeta` so that the UI can accurately distinguish which user authored a note (fixing the "YOU" tag bug on partner notes).
- **Smart Prompt Generation**: Replaced hardcoded fallback prompts with a robust backend `prompts` table containing 80 categorized questions. Updated `useSyncEngine.tsx` to cache this prompt bank locally, allowing `useDailyPrompt.ts` to intelligently filter out past prompts and generate fresh, non-repeating daily questions even while completely offline.
- **UI/UX Global Audit Pass**: 
  - Redesigned the Onboarding Hub (`Welcome to NOOK`) with premium glassmorphism (`expo-blur`), smooth entrance animations (`react-native-reanimated`), and a clean, luxury aesthetic.
  - Refactored the core `Button`, `Card`, and `Header` components to perfectly match the new pill-badge capsule aesthetic (using `rounded-full` and 8pt soft borders).
  - Ensured all touch targets are a minimum of 44x44px.
  - Added dynamic micro-interactions (e.g., the Longest Streak "Fire" icon now dynamically lights up bright orange when the user has an active streak).
- **App Security (App Lock)**: Implemented biometric/PIN app lock functionality using `expo-local-authentication` and `expo-secure-store`. The lock screen wraps the entire `(app)` group layout, requiring authentication upon cold starts or returning from the background.
- **Account Management**: Added a "Delete Account" feature to the Space Profile screen that securely calls a custom Postgres RPC (`delete_user_account`) to wipe the user from `auth.users`, cascading deletions to completely obliterate all associated user data, and smartly routing them back to the newly built Onboarding Hub.

### Date: 2026-08-11
- **Custom Space Prompts**: Completely overhauled the Daily Prompts architecture to support user-generated questions.
  - Added `space_id` and `author_id` to `daily_prompts`.
  - Updated `get_today_prompt` RPC to fall back to generating space-specific prompts rather than a single global one.
  - Added an **Ask Question** CTA to `PromptScreen` that allows either partner to add new questions dynamically throughout the day.
  - Split `useDailyPrompt` to return `mainPromptItem` (first prompt of the day) and `additionalPromptItems` (compact questions).
  - Users can now edit their own prompt responses directly from the expanded modal.
  - Users can delete custom prompts they authored, triggering a cascade delete of all associated responses.
- **Voice Notes**: Implemented WhatsApp-style voice recording directly in the `CreateNoteModal`.
  - Added native dependencies `expo-av` and `expo-document-picker`.
  - Built a simulated waveform `AudioPlayer` component for aesthetic playback in the Home feed.
  - Users can record voice notes up to 5 minutes, or upload audio files directly from their device.
- **Space Profile Expansion**: Overhauled the Space Settings screen.
  - Added inline editing for Space Name and Display Name via themed modals.
  - Built a "Your Journey" dashboard tracking Days Together, Prompts Shared, and Longest Streak (calculated via memories data).
  - Implemented secure "Leave Space" logic that unpairs the user and safely redirects to onboarding, wrapped in a strict confirmation modal.
- **UI Spacing & Alignment**: Tightened up vertical spacing in the Daily and Memories tabs and successfully moved the "Archived" stat below the header for a cleaner aesthetic.

## Recently Accomplished
- **Auth Flow Redesign**: Completely overhauled the `sign-in.tsx` and `verify.tsx` pages. Implemented decorative blurred bubble backgrounds, glassy card layouts for inputs, `react-native-reanimated` entrance animations, and an auto-submitting OTP mechanism that fires as soon as the 6th digit is typed.
- **Global UI/UX Audit Pass**: Audited the entire application to enforce minimum `44x44px` touch targets for all interactive elements (buttons, icons, back arrows) and standardized padding to align with the 8pt grid system.
- **Onboarding Navigation Flow**: Added "Cancel" buttons to Onboarding screens, allowing users to exit the flow and return to their active space.
- **Leave Space vs Delete Space Architecture**: Clarified the UX difference between switching, leaving, and deleting spaces. Leave Space removes the user from `space_members`, hiding it from their view but preserving it for their partner.

### Date: 2026-08-10
- **TypeScript & Supabase Setup**: Configured `@supabase/supabase-js` with strict DB types in `types/database.types.ts`. Auth token persistence via `expo-secure-store`.
- **Build Stabilization**: Fixed all bundler/runtime errors across SDK upgrades. Added placeholder guard in `_layout.tsx` so app doesn't hang on blank screen with placeholder Supabase credentials.
- **Assets**: Created `assets/images/` directory with icon, splash, adaptive-icon, and favicon images.
- **Bug Fixes**: Replaced web-only `<span>` tab icons with React Native `<Text>` components to prevent Hermes crash.
- **Database Schema**: Created `supabase/migrations/0001_initial_schema.sql` with RLS-enabled tables: `spaces`, `space_members`, `daily_prompts`, `prompt_responses`, `journal_entries`.
- **UI Components**: Scaffolded `Button`, `Card`, `PolaroidCard`, `PromptCard`, `Header` in `components/ui/`.
- **All Screens Scaffolded**: Auth (sign-in, verify), Onboarding (create-space, join-space), App (feed, prompt, memories, profile).
- **Dependency Fix**: Installed missing `react-native-css-interop` and fixed Expo SDK version mismatches to resolve NativeWind v4 bundling error.
- **Auth Flow Verified**: Successfully connected to Supabase Auth, configured SMTP (Resend), adjusted OTP length to 8 digits, and verified the end-to-end magic link/OTP sign-in flow.
- **Pairing Flow**: Created `create_space` and `join_space` RPC functions to securely pair users to a `space` while bypassing RLS read restrictions. Updated layout routing to handle Space contexts dynamically.
- **Main Feed**: Created robust `FlatList` feed using `useFeed` custom hook to pull in active space partners and recent notes in real-time. Scaffolded Daily Prompt UI in feed header.
- **Daily Prompts**: Implemented the dual-unlock mechanism using a custom `useDailyPrompt` hook. Users must submit their own response before unlocking their partner's response. Added modal expansions for lengthy text reading.
- **Real-Time Sync**: Configured Supabase Postgres subscriptions for instant feed updates when a partner posts a note or photo.
- **Photo Uploads**: Integrated `expo-image-picker`, built `space_media` storage bucket, and created Polaroid Media Cards to display user-uploaded images. Fixed Android FileSystem base64 bugs.
- **UI Redesign (mymind layout)**: Overhauled the main feed into a seamless 2-column masonry grid. Relocated the input bar to a Floating Action Button and moved Daily Prompts exclusively to the Daily tab.
- **Core Navigation**: Built out the "Memories" (archive of historical prompt responses) and "Space" (profile, settings, invite code manager) tabs, completing the core app shell.
- **Push Notifications**: Integrated `expo-notifications` and `expo-device` to securely generate and store push tokens in the database. Added active background syncing so partners instantly receive notifications on new notes, photos, and daily prompt answers.
- **App-Wide SVG Icons**: Replaced all native text emojis across the app with crisp, high-quality SVG components using `phosphor-react-native`, dramatically elevating the app's aesthetic.

## Phase 3: Engagement & UI Refinement
- `[x]` Build dynamic `Header` component and integrate across all tabs.
- `[x]` Custom Prompts: Allow partners to ask additional questions and edit existing responses.
- `[x]` Implement App Lock security feature (Biometrics/PIN).
- `[x]` Migrate to Local-First Offline Architecture (`expo-sqlite`).
- `[x]` Implement Multiple Spaces support.
- `[x]` Implement Push Notifications (Daily Reminders, Nudges, Events).

## Current / Ongoing
- **Architecture Scaling**: Refining data models to support more complex inter-space relationships.

## To Do (Upcoming)
- `[x]` Finalize Row-Level Security (RLS) enforcement and data validation.
- `[x]` Migrate Media to Supabase Storage (Background uploads for offline support).
- `[x]` Advanced offline conflict resolution (CRDT-lite / LWW).
