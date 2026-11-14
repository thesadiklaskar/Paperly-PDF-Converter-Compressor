# Building Paperly

## Requirements
- Android Studio / Android SDK (API 35)
- JDK 17
- Node.js 20+
- Gradle 8.10.2

Paperly currently targets Android 10 (API 29) and arm64 devices.

## Install dependencies

~~~bash
npm install
~~~

## Debug install

~~~bash
gradle -p android installDebug
~~~

## Release APK for device testing

~~~bash
gradle -p android :app:assembleRelease
~~~

The APK is created under:

android/app/build/outputs/apk/release/

The current release build is arm64-only and uses the default Android debug signing key so it can be installed for testing. Replace that signing configuration with a private release keystore before Play Store distribution.

## GitHub Actions

Every push to main and manual workflow dispatch runs the Android release build. The installable APK is uploaded as the paperly-android-apk workflow artifact.

## Size strategy

- arm64-only APK instead of a universal APK
- Hermes JavaScript engine
- ProGuard/R8 minification and resource shrinking
- no image, navigation, or icon libraries added to the JS bundle
- ML Kit Document Scanner is supplied dynamically by Google Play services

A 10 MB APK is a strict target, not a verified result. The actual size must be measured from the generated APK. The React Native engine and native Android runtime make a hard 10 MB guarantee unrealistic without a successful size audit.
