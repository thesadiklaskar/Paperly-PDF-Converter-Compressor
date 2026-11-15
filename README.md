# Paperly

Paperly is a lightweight, Android-first React Native document utility with two main tool tabs:

1. **PDF Converter** — convert selected images into a multi-page PDF, or capture a multi-page document using the native Google ML Kit Document Scanner flow. The result can be renamed before saving to Downloads.
2. **PDF Compressor** — choose a PDF, enter a target size in MB, and create a smaller image-based PDF with the best practical quality for the requested target.

## Implementation

- React Native 0.76.9 with Expo SDK 52 / Updates 0.27.5, Android only
- Kotlin native module for document scanning, PDF generation, compression, and Downloads saving
- Google ML Kit Document Scanner in full mode (automatic document capture, crop/rotation, page reordering and cleanup)
- All image conversion and compression work is performed locally on the device
- Files are saved to Downloads/Paperly

The in-app progress and confirmation dialogs use Paperly's own UI. Android's system document picker and Google ML Kit scanner remain OS-provided native screens; Android permission prompts are also controlled by the operating system. The scanner library's models, scanning logic and UI are dynamically delivered by Google Play services; Google documents an approximate 300 KB app download-size impact for the scanner dependency. On first use, the device may need an internet connection to fetch those modules. Compatible Google Play services and at least 1.7 GB of device RAM are required by the scanner.

## Important compression note

The built-in compressor renders source PDF pages and rebuilds them as JPEG-backed PDF pages to reduce size. It preserves page appearance as closely as the selected output size allows, but selectable/searchable text and vector content are flattened into images. When a requested target is too aggressive, Paperly reports that the target could not be reached rather than claiming success.

## Build

See BUILDING.md for local build steps and the GitHub Actions APK artifact.

## APK size

The project is configured for arm64, Hermes, R8/ProGuard and resource shrinking. A 10 MB APK is an optimization goal only; it cannot be guaranteed until the release APK has actually been built and measured.



## Offline student tools

Paperly also includes a lightweight student area with a bottom icon navigation bar:

- Calculator and a foreground-only focus timer
- Exam countdown and a weekly study timetable
- To-do list and editable quick notes

Student data is stored locally on Android using the app's existing Kotlin module and SharedPreferences. No account, backend, analytics, or third-party storage package is required. The focus timer pauses while the app is backgrounded or the user leaves its screen. These student tools add no new npm dependencies.


## App updates (OTA)

Paperly is prepared for Expo Updates (EAS Update). JavaScript/TypeScript UI and compatible assets can be published over the air, so users do not need a fresh APK for those changes. Updates download when the app opens and are applied on the next launch; the Settings screen also has a manual **Check for updates** action.

### One-time setup

1. Create or sign in to an Expo account and create an EAS project for Paperly.
2. In GitHub repository Settings → Secrets and variables → Actions, add:
   - Repository **variable** `EAS_PROJECT_ID` = the EAS project UUID.
   - Repository **secret** `EXPO_TOKEN` = an Expo access token.
3. Run the Android APK workflow once after setting the variable. This installs the native update client and embeds the EAS project URL and `production` channel in the APK.
4. Thereafter, changes to `App.tsx`, `index.js`, `src/` or `assets/` on `main` automatically publish a compatible Android OTA update. You can also run the **Publish Paperly OTA update** workflow manually.

### Important boundary

OTA updates replace the JavaScript bundle and compatible assets only. Changes to Kotlin/Java, Android permissions, ML Kit, `react-native-svg`, any other native dependency, or the native runtime require a new APK. When native code changes, increment the runtime version in `app.config.js`, `android/app/build.gradle`, and `android/app/src/main/res/values/strings.xml`, then distribute the new APK. The runtime version prevents an incompatible JavaScript update from being installed on the wrong native build.

If the EAS project ID or token is missing, the OTA workflow skips publishing and the Settings page reports that OTA is not connected. It does not pretend an update has been published.
