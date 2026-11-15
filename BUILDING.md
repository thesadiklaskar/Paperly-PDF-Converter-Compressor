# Building Paperly

## Requirements

- Node.js 20 or newer
- JDK 17
- Android SDK Platform 35
- Gradle 8.10.2
- An ARM64 Android device or emulator for testing

The app targets Android 10 (API 29) and newer and currently builds an ARM64 APK (arm64-v8a).

## Install dependencies

~~~bash
npm install
~~~

## Type-check the app

~~~bash
npm run typecheck
~~~

## Install a debug build

~~~bash
gradle -p android installDebug
~~~

## Build an installable release APK

~~~bash
gradle --no-daemon -p android :app:assembleRelease
~~~

The APK is created under:

android/app/build/outputs/apk/release/app-release.apk

The current CI release configuration uses the default Android debug signing key for installable testing. Configure a permanent private release/upload keystore before Play Store publishing or distributing upgradeable production releases. Reuse the same signing identity for future versions so Android can install updates over an existing copy.

## GitHub Actions

Every push to main and manual workflow dispatch runs the **Android APK** workflow. It installs JavaScript dependencies, runs the TypeScript check, builds the release APK, and uploads the paperly-android-apk artifact.

The workflow artifact is available from the corresponding run in the repository's Actions tab.

## OTA updates

The project includes Expo Updates and a **Publish Paperly OTA update** workflow. To enable publishing, configure:

- GitHub Actions repository variable: EAS_PROJECT_ID
- GitHub Actions repository secret: EXPO_TOKEN

Create the EAS project, add those values, then build and install a native APK that contains the EAS project configuration. Compatible JS/UI and asset updates can then be published without a new APK. Kotlin/Java or other native changes always require a new APK and a matching runtime-version increment.

## Size and performance choices

- ARM64-only release APK.
- Hermes JavaScript engine.
- R8/ProGuard and resource shrinking for release builds.
- A small React Native dependency set.
- Native PDF operations run on a background worker thread.
- Temporary image/PDF working files are cleaned up after use.
- Scanner functionality is delivered through Google Play services rather than bundling the full scanner model in the APK.

The actual APK size depends on the Android toolchain and dependencies and should be measured from each generated artifact. A hard 10 MB limit cannot be guaranteed.
