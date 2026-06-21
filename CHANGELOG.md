# Changelog

All notable changes to the FS25 ModManager will be documented in this file.

## [Unreleased]

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
