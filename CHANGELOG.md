# Changelog

All notable changes to the FS25 ModManager will be documented in this file.

## [Unreleased]
- **Feature:** Dynamisches lokales ModHub-Mapping direkt durch Web Scraping der Farming Simulator Seite (ersetzt statische GitHub Mapping-Liste).
- **Feature:** Smart Update-Check beim Start: Prüft effizient nur auf neu veröffentlichte Mods anhand eines Referenz-Mods.
- **Feature:** Manueller Update-Check Button für einzelne Profile, um veraltete Mods gezielt zu identifizieren.
- **UI:** Mods mit verifizierter ModHub-ID oder "ModHub"-Marker erhalten nun ein gut sichtbares "🌐 ModHub"-Badge in der Liste.
- **Fix:** Kategorien-Filter nutzt nun priorisiert die korrekten offiziellen ModHub-Kategorien statt lokaler fehlerhafter modDesc-Einträge.
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
