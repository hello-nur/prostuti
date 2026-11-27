# Prostuti — SSC / HSC / Admission exam prep (Android)

Offline MCQ practice, board-style mock tests, AI-made questions, creative questions (CQ) and an AI tutor
for Bangladeshi SSC, HSC and university/medical/engineering admission students. Bangla + English.

## What's inside
- `web/` — the whole app (HTML/CSS/JS). Runs offline. Same files power the APK.
  - `catalog.js` — exams, groups, admission units, subjects and chapters
  - `questions.js` — built-in question bank (append new rows at the END so saved progress stays correct)
  - `ai.js` — Google Gemini free-API client (auto-detects a working model)
  - `config.js` — optional shared Gemini key for all students (leave empty = each student adds their own)
  - `app.js` — screens and logic
- `app/` — Android wrapper (WebView + native bridge for AI calls). No extra libraries.
- `.github/workflows/build-apk.yml` — builds the APK on GitHub for free.

## Get the APK (no Android Studio needed)
1. Create a new repository on github.com and upload everything in this folder (keep the folder structure,
   including the hidden `.github` folder).
2. Open the repo's **Actions** tab → "Build Android APK" runs automatically (about 4–6 minutes).
3. Open **Releases** (right side of the repo page) → download `Prostuti.apk` on your phone and install it
   (allow "Install unknown apps" when Android asks).

## Or build on a computer
Open this folder in Android Studio → wait for Gradle sync → Build → Build APK(s).
Output: `app/build/outputs/apk/`.

## Before publishing on Google Play
- Change `applicationId` in `app/build.gradle` if you want a different package name (cannot change after publishing).
- Create your own signing key (the release build currently uses the debug key so it installs directly).
- Play requires the latest target SDK; raise `targetSdk`/`compileSdk` when Google asks.

## AI notes
Each student can add a free key from https://aistudio.google.com/apikey in Settings.
A key placed in `web/config.js` is shared by all users (shared free limits, and it can be extracted from the APK),
so for a public release prefer per-student keys or put your own server in front of Gemini.
