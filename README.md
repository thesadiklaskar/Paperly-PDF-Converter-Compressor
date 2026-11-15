# Paperly

**A focused, offline-first Android PDF utility for students who need to turn handwritten coursework into clean, submission-ready PDF files.**

Paperly brings image-to-PDF conversion, multi-page document scanning, and PDF compression together in one lightweight Android application. Its core document workflow runs locally on the device, without a Paperly account, application backend, or cloud document upload.

[![Android APK workflow](https://github.com/WorkRCS/pdf-app/actions/workflows/android-apk.yml/badge.svg)](https://github.com/WorkRCS/pdf-app/actions/workflows/android-apk.yml)
[![Latest source](https://img.shields.io/badge/platform-Android%20%7C%20ARM64-3DDC84)](https://github.com/WorkRCS/pdf-app)

---

## 1. What does the name “Paperly” mean?

**Paperly** is a coined product name formed from **“paper”** and a friendly **“-ly”** ending. It is not an acronym. The name is intended to suggest a simple, approachable way to handle paper-based work digitally.

That idea describes the app: take handwritten pages that exist as photos or scans, turn them into a single organised PDF, and prepare that PDF for online submission.

## 2. Why I built Paperly

Paperly began with a problem I personally experienced as a college student.

In engineering and other college courses, a lot of academic work is still handwritten: class notes, practical records, lab work, assignments, and solved questions. A college learning-management system (LMS), student portal, or assignment-submission website may require that work to be uploaded as a **single PDF**, and it may enforce a maximum file size such as **5 MB, 10 MB, or 20 MB**. The exact limit depends on the institution and the portal.

Preparing a submission sounds simple until there are many pages involved. One subject can mean around **50–60 handwritten pages**. Across four, five, or six subjects, the work can quickly become a batch of **100–200 or more page images**. Every page has to be selected, kept in the right sequence, converted into a readable PDF, and compressed enough to meet the portal's upload limit.

I repeatedly ran into the same problems with the tools available:

- **Paid features:** polished PDF applications often reserve useful conversion or compression options for paid plans.
- **Advertisements and interruptions:** free apps and websites can interrupt an urgent task with ads, pop-ups, or upgrade prompts.
- **Slow processing:** uploading a large group of images to an online converter, waiting for it to process, and downloading the result takes time.
- **Internet dependency:** a weak connection, limited mobile data, or a temporarily unavailable website can stop the whole submission process.
- **Inconsistent results:** some tools do not preserve the page sequence or image clarity I expected, or they produce a PDF that still does not fit the required size.
- **Repeated trial and error:** create a PDF, check its size, compress it somewhere else, download it, inspect it, and start again if the result is unsuitable.
- **Deadline pressure:** assignment work is often submitted close to a deadline. I needed a tool that could do the essential steps directly on my phone, without wasting time on an avoidable workflow.

I wanted a practical solution to that exact problem—not another app full of unrelated features. So I built Paperly around one focused workflow:

1. Select photographs of handwritten pages or scan the pages.
2. Combine them into one multi-page PDF.
3. Compress an existing PDF when a portal has a file-size restriction.
4. Rename the output and save it on the phone, ready to upload.

The purpose is to reduce friction in a real student task: **preparing large batches of handwritten coursework for strict online submission requirements, quickly and with fewer dependencies.**

Paperly is built from a problem I faced myself. The goal is to make that workflow faster and more predictable for other students facing the same situation.

---

## 3. What Paperly does

### Images to PDF

- Select multiple images through Android's system file picker.
- Combine the selected images into one multi-page PDF.
- Keep the selected image sequence in the generated document.
- Process and encode the images on the device.
- Review the generated file, rename it, and save it.

The current image pipeline prepares JPEG page images with a maximum side length of approximately 1,800 pixels and JPEG quality 88 before creating the PDF. The goal is a practical balance between readability, processing time, and output size.

### Document scan to PDF

- Launch Google ML Kit Document Scanner through Google Play services.
- Capture multiple pages in one scan session.
- Use the scanner's document-edge detection, cropping, rotation, and cleanup experience.
- Return the scanned PDF to Paperly for naming and saving.

The scanner is configured for up to **50 pages per scan session**. ML Kit Document Scanner requires a compatible device with at least **1.7 GB of total RAM**. Its module may need to be downloaded by Google Play services the first time it is used, so the first scan can require an internet connection. Image-to-PDF remains available independently of the scanner requirement.

### PDF compression

- Select an existing PDF from the device.
- Enter a target size in megabytes or choose a preset.
- Re-render the PDF pages at adjusted image dimensions and JPEG quality.
- Generate a smaller image-based PDF where the source and target make that possible.
- See whether the requested target size was reached.
- Rename and save the resulting file.

**Important compression limitation:** the current compressor renders each source PDF page and rebuilds the document as image-backed pages. This can preserve the page's visible appearance, but it flattens selectable/searchable text, hyperlinks, and vector content into page images. Keep the original file when those properties must remain editable or searchable.

**Target size is best-effort, not guaranteed.** The actual result depends on the source document, page count, image content, and requested target. Paperly reports when the target could not be reached instead of claiming a false success.

### File naming and saving

- Rename the output before saving.
- Save generated PDFs to **Downloads/Paperly** using Android's MediaStore APIs.
- Use Android's built-in file picker for selecting source images and PDFs.

### Settings and update controls

- View the installed Paperly version.
- View the current OTA connection status.
- Manually check for a compatible Expo update.
- Read basic information about the app.

The app's own progress, result, and confirmation dialogs are rendered inside Paperly. The Android file picker, system permission prompts, and Google ML Kit scanner are native Android experiences.

---

## 4. App screenshots

The following screenshots show the Paperly Android application.

| App screenshot | App screenshot |
|---|---|
| ![Paperly screenshot 1](https://ik.imagekit.io/xvqovhmcyr/pdf-maker/WhatsApp%20Image%202026-11-15%20at%201.33.06%20PM.jpeg) | ![Paperly screenshot 2](https://ik.imagekit.io/xvqovhmcyr/pdf-maker/WhatsApp%20Image%202026-11-15%20at%201.33.07%20PM.jpeg) |
| ![Paperly screenshot 3](https://ik.imagekit.io/xvqovhmcyr/pdf-maker/WhatsApp%20Image%202026-11-15%20at%201.33.07%20PM%20%281%29.jpeg) | ![Paperly screenshot 4](https://ik.imagekit.io/xvqovhmcyr/pdf-maker/WhatsApp%20Image%202026-11-15%20at%201.33.07%20PM%20%282%29.jpeg) |
| ![Paperly screenshot 5](https://ik.imagekit.io/xvqovhmcyr/pdf-maker/WhatsApp%20Image%202026-11-15%20at%201.33.06%20PM%20%281%29.jpeg) | ![Paperly screenshot 6](https://ik.imagekit.io/xvqovhmcyr/pdf-maker/WhatsApp%20Image%202026-11-15%20at%201.33.08%20PM.jpeg) |

---

## 5. How the application works

Paperly uses a React Native interface for the app experience and a Kotlin native module for Android document operations.

```text
Student
  |
  v
Paperly Android UI (React Native + TypeScript)
  |
  v
Native bridge: PdfTools
  |
  v
Kotlin document-processing module
  |-- Android document picker
  |-- Google ML Kit Document Scanner
  |-- Image encoding and PDF generation
  |-- PDF rendering and compression
  |-- Android MediaStore
  |
  v
Downloads/Paperly
```

Typical processing flow:

1. The student selects images, scans pages, or chooses an existing PDF.
2. The React Native screen calls the relevant method in the native `PdfTools` module.
3. Kotlin performs document processing locally. Heavy PDF work is dispatched to a dedicated, lower-priority worker thread so it does not need to run on the UI thread.
4. Paperly displays the result and lets the student choose a filename.
5. Android MediaStore saves the final PDF in **Downloads/Paperly**.

Temporary working files are used during processing and removed after they are no longer needed. The document workflow does not upload handwritten notes or assignments to a Paperly server.

---

## 6. Technology stack

| Layer | Technology | What it is used for |
|---|---|---|
| Mobile UI | React Native 0.76.9 | Building the native Android application interface |
| Application language | TypeScript | Screen logic, application state, and type checking |
| UI runtime | React 18.3.1 | Component-based rendering |
| Expo platform | Expo SDK 52 | Expo runtime and native module integration |
| OTA update client | expo-updates 0.27.5 | Downloading compatible JavaScript updates when EAS is configured |
| Android native code | Kotlin | PDF operations, file handling, scanner integration, and file saving |
| Document scanning | Google ML Kit Document Scanner 16.0.0 via Google Play services | Multi-page document capture and cleanup |
| PDF and graphics APIs | Android PdfRenderer and Android graphics APIs | Rendering and creating PDF pages |
| File access and export | Android Storage Access Framework and MediaStore | Selecting source documents and saving output |
| Icons | lucide-react-native 0.468.0 | Lightweight, consistent vector icons |
| Safe-area layout | react-native-safe-area-context 4.12.0 | Keeping app content clear of status and navigation bars |
| JavaScript engine | Hermes | Running the React Native JavaScript bundle |
| Android build | Gradle 8.10.2 and Android SDK Platform 35 | Compiling and packaging the APK |
| CI | GitHub Actions | Type-checking and building downloadable Android APK artifacts |

### Android compatibility

- **Minimum Android version:** Android 10 (API 29).
- **Current APK architecture:** ARM64 (`arm64-v8a`).
- **Target Android SDK:** API 35.
- **Scanner requirement:** Google Play services and at least 1.7 GB total device RAM.
- **Local development:** Node.js 20+, JDK 17, Android SDK Platform 35, and Gradle 8.10.2.

---

## 7. Local processing, privacy, and network use

Paperly is designed so that the main PDF workflow does not depend on a Paperly cloud service.

- **No Paperly backend:** there is no application server for document conversion.
- **No account or login:** the main PDF tools do not require registration.
- **On-device processing:** image conversion and PDF compression happen locally.
- **Local output:** generated files are saved to the device's Downloads/Paperly folder.
- **No advertising or analytics SDK is included in the declared app dependency set.**
- **Limited network cases:** Google Play services may download the ML Kit scanner module on first use. OTA update checks and downloads require an internet connection and a configured Expo EAS project.

The Android system file picker and Google Play services scanner are platform-provided components; their availability and behaviour can depend on the device and installed Google services.

---

## 8. Android app, APK installation, and release readiness

Paperly is a **real, installable Android application**, not a website wrapped in a WebView and not only a UI prototype. The repository contains the React Native application, the Kotlin PDF-processing module, Android project configuration, and a GitHub Actions build workflow.

The current workflow:

1. Installs JavaScript dependencies.
2. Runs `npm run typecheck`.
3. Builds the ARM64 Android release APK.
4. Uploads the APK as a `paperly-android-apk` workflow artifact.

### Downloading the APK

1. Open the repository's [Android APK workflow runs](https://github.com/WorkRCS/pdf-app/actions/workflows/android-apk.yml).
2. Open a run whose status is **successful**.
3. Download the `paperly-android-apk` artifact.
4. Extract the ZIP and install the APK on a compatible ARM64 Android device.

GitHub Actions artifacts are temporary build downloads and currently have a **14-day retention period**. They are not the same as a permanent GitHub Release or a Play Store listing.

### Installing a new APK update

Android can install a newer APK over an existing app when the package identity is the same, the version code is higher, and the APK is signed with the same signing certificate as the installed app.

The current CI release workflow uses Gradle's default debug signing configuration to create an installable APK for testing. It does **not** yet use a permanent private release keystore. Because hosted CI runners are temporary, the signing key should not be treated as a stable identity across builds. Therefore, in-place upgrades from one CI artifact to a later CI artifact are **not guaranteed** at this stage.

Before distributing reliable upgradeable releases or publishing to Google Play, configure a permanent private release/upload keystore in GitHub Actions secrets and use that same signing identity for every release. Back up the keystore securely; losing it can prevent future APKs from updating an installed build signed with that key.

### OTA (over-the-air) updates

Paperly includes the `expo-updates` client, a Settings screen for checking updates, and a GitHub Actions workflow for publishing compatible JavaScript updates.

**OTA publishing is implemented in the repository but is not connected yet.** To activate it:

1. Create an Expo EAS project for Paperly.
2. Add its project UUID as the GitHub Actions repository variable `EAS_PROJECT_ID`.
3. Add a valid Expo access token as the GitHub Actions repository secret `EXPO_TOKEN`.
4. Build and install a new APK containing that EAS project configuration.

Once configured, compatible TypeScript/JavaScript UI changes and supported assets can be published through the **Publish Paperly OTA update** workflow. Users can receive those compatible updates without installing a new APK.

**Native changes still require a new APK.** Changes to Kotlin/Java code, Android permissions, scanner integration, native dependencies, or native configuration cannot be delivered by a JavaScript-only OTA update. The native runtime version must also be incremented consistently when a change is incompatible with the previously installed native binary.

### Is it production-ready?

The core Android app is implemented and builds as an installable APK. Its principal PDF workflows—image conversion, document scanning, PDF compression, renaming, and local saving—are present.

For clarity, **feature-complete and installable does not mean that every production-distribution service is already configured**. A permanent release signing identity and EAS credentials are still required for reliable upgradeable releases and active OTA publishing. Play Store publication would also require the normal release testing, store listing, privacy declarations, and signing setup.

This distinction is intentional: the project documents what works today and what remains to be configured, rather than describing an inactive update service as already live.

---

## 9. Can Paperly be converted into an iOS app?

**Yes, Paperly is a good candidate for an iOS port because its interface and much of its application logic are written in React Native and TypeScript.** The existing project, however, is currently an Android application.

The Android-specific Kotlin module cannot simply be copied into an iOS build. An iOS version would need native equivalents, for example:

| Current Android implementation | iOS implementation to build |
|---|---|
| Android document picker / Storage Access Framework | iOS document picker and Files integration |
| Google ML Kit Document Scanner | Apple VisionKit document camera, where supported |
| Android PdfRenderer and graphics APIs | PDFKit and Core Graphics |
| Android MediaStore Downloads saving | iOS document export and Files sharing |
| Kotlin `PdfTools` native module | Swift native module exposed to React Native |

The React Native screens, design system, and much of the TypeScript workflow can be reused. The iOS native document module, Xcode project configuration, permissions, signing, and device testing must be implemented separately. **Paperly is not an iOS app yet**, but its React Native foundation makes an iOS version technically achievable without rewriting the entire UI from scratch.

---

## 10. Build Paperly locally

See [BUILDING.md](BUILDING.md) for the complete setup and build notes.

```bash
npm install
npm run typecheck
gradle --no-daemon -p android :app:assembleRelease
```

The generated APK is located at:

```text
android/app/build/outputs/apk/release/app-release.apk
```

---

## 11. Project principles

- Solve a real problem from student life.
- Keep the main experience focused on converting, scanning, and compressing PDFs.
- Prefer local document processing over uploading private coursework to online converters.
- Keep the interface lightweight and straightforward.
- Avoid unnecessary dependencies and background work.
- Be transparent about compression limits, device requirements, and update readiness.

---

## Repository

- **Source code:** [WorkRCS/pdf-app](https://github.com/WorkRCS/pdf-app)
- **Build instructions:** [BUILDING.md](BUILDING.md)
- **Android APK workflow:** [GitHub Actions](https://github.com/WorkRCS/pdf-app/actions/workflows/android-apk.yml)
- **OTA workflow:** [Publish Paperly OTA update](.github/workflows/publish-ota.yml)

---

*Paperly was built from a problem I faced as a college student: turning a large number of handwritten pages into a readable, size-compliant PDF for an assignment portal—without unnecessary ads, subscriptions, slow uploads, or dependence on an online converter.*
