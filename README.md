# Paperly

Paperly is a lightweight, Android-first React Native document utility with two bottom-navigation destinations:

1. **PDF Converter** — convert selected images into a multi-page PDF, or capture a multi-page document using the native Google ML Kit Document Scanner flow. The result can be renamed before saving to Downloads.
2. **PDF Compressor** — choose a PDF, enter a target size in MB, and create a smaller image-based PDF with the best practical quality for the requested target.

## Implementation

- React Native 0.76.7, Android only
- Kotlin native module for document scanning, PDF generation, compression, and Downloads saving
- Google ML Kit Document Scanner in full mode (automatic document capture, crop/rotation, page reordering and cleanup)
- All image conversion and compression work is performed locally on the device
- Files are saved to Downloads/Paperly

The scanner library's models, scanning logic and UI are dynamically delivered by Google Play services; Google documents an approximate 300 KB app download-size impact for the scanner dependency. On first use, the device may need an internet connection to fetch those modules. Compatible Google Play services and at least 1.7 GB of device RAM are required by the scanner.

## Important compression note

The built-in compressor renders source PDF pages and rebuilds them as JPEG-backed PDF pages to reduce size. It preserves page appearance as closely as the selected output size allows, but selectable/searchable text and vector content are flattened into images. When a requested target is too aggressive, Paperly reports that the target could not be reached rather than claiming success.

## Build

See BUILDING.md for local build steps and the GitHub Actions APK artifact.

## APK size

The project is configured for arm64, Hermes, R8/ProGuard and resource shrinking. A 10 MB APK is an optimization goal only; it cannot be guaranteed until the release APK has actually been built and measured.
