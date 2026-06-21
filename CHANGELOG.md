# Changelog

All notable changes to the FS25 ModManager will be documented in this file.

### [Unreleased]

## [1.2.2] - 2026-06-21

- Well. Somehow broke the Auto Updater... AGAIN... 

## [1.2.1] - 2026-06-21

### Fixes
- **Localization:** Fixed hardcoded German strings during the auto-start launch countdown and mod update error alerts to ensure complete support for all languages (German, English, French).

## [1.2.0] - 2026-06-21

### Features
- **French Translation (`fr.ts`):** Added full localization support for the French language, including translation files, configuration interface settings, dropdown menus, and utility type integration.
- **Auto-Start Profile:** Added option to designate a multiplayer profile to automatically sync and launch the game upon app startup.
- **Auto-Launch Countdown:** Added a 5-second countdown banner with a "Cancel launch" button before automatically launching the game post-sync (closes popup instantly upon launch).
- **Streamer Protection:** Masked sensitive connection inputs in Profile settings behind password toggles (only visible on focus) and obscured server URLs in the Start Page widget (replaced with "Configured ✅" status, tooltips removed).
- **3-URL Dedicated Server Syncing:** Seamlessly integrates FastDL, Web HTML Mods Page, and Dedicated Server Stats XML with automatic download fallbacks and offline server detection.
- **DLC (`pdlc_`) & Secure Mods Support:** DLCs are now properly registered, displayed in stats, excluded from sync downloads, and preserved from orphan cleanups.
- **Bulk Actions:** Added mass activation, deactivation, force syncing, ModHub updating, and deletion directly on multiple selected mods.
- **Real-Time Mods Folder Watcher:** File changes on disk are immediately reflected in the UI, debounced at 1000ms, and safely ignored during active syncs or downloads.
- **GIANTS Server XML Parser:** Custom parser to extract mod versions and hashes, ensuring accurate server synchronization.
- **Beta Updates Toggle:** Added settings option to receive pre-release/beta versions of the app.

### UI & UX Enhancements
- **Start Page (Dashboard) Redesign:** Replaced dropdown selector with a sleek scrollable sidebar, a glassmorphic hero banner, active/inactive glow borders, HSL dark-theme styling, and live stats pulse animations.
- **Splash Screen Preloading:** Syncs settings and preloads profile data during application startup, preventing visual delays or empty loading states during navigation.
- **Profiles View Refactor:** Split the monolithic `ProfilesView.tsx` into reusable components (`ProfileSelector`, `ProfileSettingsForm`, `ProfileModsList`).
- **Cleaned Redundant UI:** Removed duplicated buttons and widget boxes.

### Fixes & Improvements
- **Startup Auto-Health Check:** Automatically validates `profile.json` with physical files on launch, cleaning up orphaned entries and extracting missing mod metadata from `modDesc.xml`.
- **Sync Safeguards:** Added checks to prevent profile cleanup or local deletion if connection to the Dedicated Server fails.
- **Metadata parsing:** Prioritized actual mod version over the schema descriptor version in the XML parser, fixing false out-of-date sync notifications.
- **Stream Robustness:** Optimized network streams to only open write files on HTTP 200, preventing empty files from triggering watchers, and properly closing streams on abort/error.
- **Metadata Sync:** Triggers instant re-extraction of ZIP metadata after ModHub downloads, resolving sticky "Update Available" badges.
- **i18n:** Completed full translations across all UI components (English default, German optional).

## [1.1.0] - 2026-06-21
- **Feature:** Implemented a full in-app browser for the official ModHub (including a custom Dark Mode).
- **Feature:** Automatic interception of ModHub downloads in the app browser with direct installation into the selected profile.
- **Feature:** ModHub ZIP filenames are now accurately extracted via HTTP headers (Content-Disposition) or CDN URLs during download.
- **Fix:** Successfully bypassed Giants CDN (403 Forbidden) blocks for ModHub images.
- **Feature:** Dynamic local ModHub mapping via direct web scraping of the Farming Simulator website (replaces the static GitHub mapping list).
- **Feature:** Smart update check on startup: efficiently checks only for newly released mods using a reference mod.
- **Feature:** Manual update check button for individual profiles to specifically identify outdated mods.
- **UI:** Mods with a verified ModHub ID or "ModHub" marker now receive a highly visible "🌐 ModHub" badge in the list.
- **Fix:** Category filter now prioritizes the correct official ModHub categories over faulty local modDesc entries.
- **Feature:** Automatically download `mod-mapping.json` (for ModHub categories & support info) directly from GitHub on app startup.
- **Feature:** Full i18n support for all UI components (English default, German optional).
- **Feature:** Retry mechanism for Live Server Status (max 6 attempts every 5 seconds) to better handle server startups.
- **Fix:** Resolved encoding issues (ä, ö, ü) when reading mod info and network streams by using `Buffer.concat` instead of string appending.
- **Fix:** Dedicated Server player count (`numUsed`) is now extracted precisely, fixing inaccurate slot counting.
- **Changed:** FastDL users without Giants web server HTML must now explicitly provide a Dedicated Server Web-Stats URL for version matching.
- **Chore:** Moved all temporary AI test scripts to the ignored `ai-script/` folder; deleted old `.html` leftover files.
- **Fix:** Fixed React state reset bug during language change by removing `window.location.reload()`.
- **Feature:** Completed full i18n support, adding missing keys for all pages (Start Page, Log Analyzer, Storage Cleaner, Profiles, Navbar, Splash Screen) into `en.ts` and `de.ts`.
- **UI/UX:** Redesigned the Mod List with a premium glassmorphism look (smooth gradients, active/inactive glowing borders, and improved button layouts).
- **Chore:** Resolved SCSS deprecation warnings in `main.scss` by replacing `darken()` and `lighten()` with `color.adjust()`.
