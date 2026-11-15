# Paperly

**Paperly is an Android-first, offline-capable PDF utility built to make handwritten assignment submission faster, simpler, and more dependable for college and university students.**

It turns batches of handwritten-note or assignment photos into a single PDF, then helps reduce an existing PDF to a practical upload size. The core document workflow runs on the device: no Paperly account, application backend, or cloud upload is needed.

---

## Why Paperly exists

Paperly started with a problem I personally faced as a college student.

College and university learning-management systems, student portals, and assignment-submission websites commonly ask students to submit handwritten work as a PDF. They may also enforce a file-size limit—often 5 MB, 10 MB, or 20 MB. The student has to photograph pages, put them in the right order, combine them into one document, and make sure the resulting file fits the portal's upload limit.

That process becomes frustrating during a busy semester. A single subject can involve 50–60 pages of handwritten work. Across four, five, or six subjects, a submission batch can quickly grow to 100–200 or more page images. Converting and preparing all of those images under a deadline is not a small task.

I ran into several recurring problems with the tools available to me:

- **Paid features for routine student work.** Some polished PDF apps put useful conversion or compression options behind a subscription.
- **Ads and interruptions.** Free tools can interrupt an urgent workflow with advertisements or upsell screens.
- **Slow online converters.** Uploading a large batch of images, waiting for processing, and downloading the result takes time.
- **Internet dependency.** A weak connection, limited data, or an unavailable website can block an assignment submission at exactly the wrong moment.
- **Unreliable output.** Page order, image clarity, margins, or the final PDF size may not match what the submission portal requires.
- **Repeated manual work.** Selecting many images, creating a PDF, checking its size, and trying again can consume time that should be spent studying.

Paperly was created to make this specific workflow available in one lightweight Android app. The goal is straightforward: select or scan handwritten pages, create a multi-page PDF on the phone, compress a PDF when necessary, give the file a clear name, and save it ready for submission.

This project is based on a real student problem—not on adding features for the sake of having more features.

---

## What Paperly does

### 1. Images to PDF

- Select multiple images from the device using Android's document picker.
- Combine the selected images into one multi-page PDF.
- Keep the image sequence as selected.
- Process images locally on the device.
- Create a PDF that can be renamed before saving.

### 2. Document scanning to PDF

- Open the Google ML Kit Document Scanner flow.
- Capture multiple pages as one document.
- Use the scanner's document-edge detection, crop, rotation, and cleanup tools.
- Return a PDF to Paperly for naming and saving.

The scanner is configured for up to 50 pages per scan session. It is provided through Google Play services, so the first use may need an internet connection to obtain its scanner module. The scanner also requires a compatible device with at least 1.7 GB of total RAM. Image-to-PDF remains available on devices that do not meet the scanner requirement.

### 3. PDF compression

- Select an existing PDF from the device.
- Enter a target size in megabytes or choose a preset.
- Rebuild the PDF with adjusted image resolution and JPEG quality.
- See whether the requested target size was reached.
- Rename the result and save it to the device.

**Compression is best-effort, not a guaranteed file-size limit.** The app reports when an especially aggressive target could not be reached rather than claiming that it succeeded.

**PDF content note:** the current compressor renders PDF pages and rebuilds them as image-backed pages. It aims to retain the visual appearance of the source, but selectable/searchable text, links, and vector content are flattened into page images. Use the original PDF when those properties must be preserved.

### 4. Simple app settings

- View the installed app version.
- See whether Expo OTA updates are connected.
- Manually check for a compatible app update.
- View basic app information.

The interface uses Paperly-owned progress and confirmation dialogs. Android's file picker, system permission prompts, and Google ML Kit scanner screens remain native platform experiences.

---

## How it works

Paperly uses a small React Native interface and a Kotlin Android module for document operations.

1. The user selects images, scans a document, or chooses an existing PDF.
2. The React Native screen calls the native PdfTools module.
3. Android processes the document locally. Image conversion and PDF compression run on a background worker thread rather than doing the heavy work on the UI thread.
4. Paperly presents the generated file, allows it to be renamed, and saves it to the **Downloads/Paperly** folder using Android's media-storage APIs.

Temporary working files are used during processing and cleaned up after the operation. No Paperly server receives the student's notes or assignments.

---

## Technology stack

| Layer | Technology | Purpose |
|---|---|---|
| App UI | React Native 0.76.9 | Native Android application UI using React |
| Language | TypeScript | Typed application state and UI logic |
| React runtime | React 18.3.1 | Component rendering |
| Expo platform modules | Expo SDK 52 | Native module and app-runtime integration |
| OTA client | expo-updates 0.27.5 | Compatible JavaScript bundle updates when EAS is configured |
| Android native layer | Kotlin | PDF processing, file handling, scanning integration, and Downloads saving |
| Document scanner | Google ML Kit Document Scanner via Google Play services | Multi-page document capture and cleanup |
| Android PDF APIs | PdfRenderer, Android storage APIs, and MediaStore | PDF rendering, file access, and saving |
| Icons | lucide-react-native | Consistent vector icons |
| Safe-area layout | react-native-safe-area-context | Keeps the header and content clear of Android status and navigation bars |
| JavaScript engine | Hermes | React Native JavaScript runtime |
| Build and checks | Gradle, Android SDK, GitHub Actions | Type-checking and CI APK builds |

### Platform requirements

- Android 10 (API 29) or newer.
- ARM64 Android devices (arm64-v8a) for the current APK build.
- JDK 17, Node.js 20+, Android SDK Platform 35, and Gradle 8.10.2 for local builds.
- Google Play services and at least 1.7 GB total device RAM for the ML Kit scanner flow.

---

## Privacy and network behaviour

- **No Paperly backend:** there is no application server or cloud document-processing service.
- **No account or login:** the core PDF workflow can be used without registering.
- **Local document processing:** selected images and PDFs are processed on the device.
- **Local output:** generated PDFs are saved to Downloads/Paperly.
- **No advertising SDK or analytics service is included in the app dependencies.**
- **Network exceptions:** Google Play services may need to download the ML Kit scanner module on first use. Expo OTA updates also require a configured EAS project and an internet connection. These do not turn the PDF conversion/compression workflow into a cloud upload service.

---

## Android APK and release status

Paperly is a complete, installable Android application—not just a web page or a UI prototype. The repository includes the React Native app, its Kotlin document-processing module, Android project configuration, and a GitHub Actions workflow that type-checks the app and builds an ARM64 release APK.

Every push to main and every manual run of the **Android APK** workflow attempts to:

1. Install JavaScript dependencies.
2. Run npm run typecheck.
3. Build the Android release APK.
4. Upload the APK as the paperly-android-apk workflow artifact.

### Production-distribution items to configure

The current CI release build uses Gradle's default debug signing configuration to produce an installable test APK. It is **not yet a Play Store signing setup**. Before a public production release, configure a permanent private release/upload keystore in GitHub Actions secrets and use that same signing identity for subsequent releases. APKs signed with different keys cannot update one another in place.

OTA updates are integrated into the project, but **OTA publishing is not active until the EAS credentials are configured**:

1. Create an Expo EAS project for Paperly.
2. Add the EAS project UUID as the GitHub Actions repository variable EAS_PROJECT_ID.
3. Add an Expo access token as the GitHub Actions repository secret EXPO_TOKEN.
4. Build and install an APK that contains that EAS project configuration.

After setup, compatible JavaScript/TypeScript UI changes and supported assets can be published through the **Publish Paperly OTA update** workflow. Users can receive those updates without downloading a new APK.

**Native changes still require a new APK.** This includes Kotlin/Java code, Android permissions, scanner integration, or adding, removing, or changing a native dependency. When the native runtime changes, increment the runtime version consistently in app.config.js, android/app/build.gradle, and android/app/src/main/res/values/strings.xml. The runtime version prevents an incompatible OTA bundle from being applied to a different native binary.

For these reasons, Paperly is functionally complete as an installable Android app with a CI build pipeline, while permanent release signing and EAS OTA credentials remain deployment configuration tasks.

---

## Could Paperly become an iOS app?

Yes. React Native makes it possible to reuse much of the TypeScript UI and application logic for an iOS version. The current document-processing layer, however, is Android-specific Kotlin code.

An iOS port would need native equivalents for:

- Image and PDF file selection using iOS document-picker APIs.
- Document scanning using Apple's VisionKit document-camera experience (where supported).
- PDF rendering, image conversion, compression, and file export using iOS frameworks such as PDFKit, Core Graphics, and the Files sharing/document APIs.
- iOS-specific permissions, safe areas, app configuration, signing, and distribution.

So the project is a strong cross-platform starting point, but it is **not automatically an iOS app yet**. The iOS native module and Xcode target must be implemented and tested separately.

---

## Build locally

See [BUILDING.md](BUILDING.md) for full setup instructions.

~~~bash
npm install
npm run typecheck
gradle --no-daemon -p android :app:assembleRelease
~~~

The APK is generated at:

android/app/build/outputs/apk/release/app-release.apk

---

## Project principles

- Solve a real student submission problem.
- Keep the main workflow focused on PDF conversion and compression.
- Prefer on-device processing over uploading handwritten work to websites.
- Keep the interface simple and predictable.
- Avoid unnecessary dependencies and background work.
- Report limitations honestly, especially when a requested compression target cannot be reached.

---

*Paperly was built from a problem I experienced as a student: preparing large batches of handwritten coursework for strict online submission requirements, quickly and without unnecessary friction.*
