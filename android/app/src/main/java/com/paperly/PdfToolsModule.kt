package com.paperly

import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.database.Cursor
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.graphics.pdf.PdfRenderer
import android.media.ExifInterface
import android.net.Uri
import android.os.Environment
import android.os.ParcelFileDescriptor
import android.provider.MediaStore
import android.provider.OpenableColumns
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

class PdfToolsModule(
    private val context: ReactApplicationContext
) : ReactContextBaseJavaModule(context), ActivityEventListener {

    companion object {
        private const val REQUEST_SCAN = 4101
        private const val REQUEST_IMAGES = 4102
        private const val REQUEST_PDF = 4103
    }

    private val worker = Executors.newSingleThreadExecutor()
    private var scanPromise: Promise? = null
    private var pickerPromise: Promise? = null
    private var pickerMode: String? = null

    init {
        context.addActivityEventListener(this)
    }

    override fun getName(): String = "PdfTools"

    @ReactMethod
    fun pickImages(promise: Promise) {
        launchPicker("images", promise)
    }

    @ReactMethod
    fun pickPdf(promise: Promise) {
        launchPicker("pdf", promise)
    }

    private fun launchPicker(mode: String, promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("E_ACTIVITY", "No active Android activity is available.")
            return
        }
        if (pickerPromise != null) {
            promise.reject("E_BUSY", "Another file picker is already open.")
            return
        }

        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = if (mode == "images") "image/*" else "application/pdf"
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
            if (mode == "images") {
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            }
        }

        pickerPromise = promise
        pickerMode = mode
        try {
            activity.startActivityForResult(
                intent,
                if (mode == "images") REQUEST_IMAGES else REQUEST_PDF
            )
        } catch (error: Throwable) {
            pickerPromise = null
            pickerMode = null
            promise.reject("E_PICKER", error)
        }
    }

    @ReactMethod
    fun scanDocument(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("E_ACTIVITY", "No active Android activity is available.")
            return
        }
        if (scanPromise != null) {
            promise.reject("E_BUSY", "The document scanner is already open.")
            return
        }

        val options = GmsDocumentScannerOptions.Builder()
            .setGalleryImportAllowed(false)
            .setResultFormats(
                GmsDocumentScannerOptions.RESULT_FORMAT_JPEG,
                GmsDocumentScannerOptions.RESULT_FORMAT_PDF
            )
            .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
            .build()

        scanPromise = promise
        GmsDocumentScanning.getClient(options)
            .getStartScanIntent(activity)
            .addOnSuccessListener { sender ->
                try {
                    activity.startIntentSenderForResult(sender, REQUEST_SCAN, null, 0, 0, 0)
                } catch (error: Throwable) {
                    scanPromise = null
                    promise.reject("E_SCAN_LAUNCH", error)
                }
            }
            .addOnFailureListener { error ->
                scanPromise = null
                promise.reject("E_SCAN_START", error)
            }
    }

    @ReactMethod
    fun createPdf(imageUris: ReadableArray, requestedName: String, promise: Promise) {
        val uriList = mutableListOf<Uri>()
        for (index in 0 until imageUris.size()) {
            imageUris.getString(index)?.let { uriList.add(Uri.parse(it)) }
        }
        if (uriList.isEmpty()) {
            promise.reject("E_NO_IMAGES", "Choose at least one image.")
            return
        }

        worker.execute {
            try {
                val workDir = workDirectory()
                val jpegFiles = mutableListOf<File>()
                uriList.forEachIndexed { index, uri ->
                    jpegFiles.add(
                        encodeImageToJpeg(
                            uri,
                            File(workDir, "image_" + System.nanoTime() + "_" + index + ".jpg"),
                            3000,
                            92
                        )
                    )
                }

                val output = uniquePdfFile(requestedName)
                writePdfFromJpegs(jpegFiles, output)
                jpegFiles.forEach { it.delete() }
                promise.resolve(fileResult(output, uriList.size))
            } catch (error: Throwable) {
                promise.reject("E_CREATE_PDF", error)
            }
        }
    }

    @ReactMethod
    fun compressPdf(uriString: String, targetMb: Double, requestedName: String, promise: Promise) {
        if (targetMb <= 0.0 || targetMb.isNaN() || targetMb.isInfinite()) {
            promise.reject("E_TARGET_SIZE", "Target size must be greater than zero.")
            return
        }

        worker.execute {
            try {
                val source = copyUriToCache(Uri.parse(uriString), "source_" + System.nanoTime() + ".pdf")
                val sourceBytes = source.length().coerceAtLeast(1L)
                val targetBytes = (targetMb * 1024.0 * 1024.0).toLong().coerceAtLeast(1L)
                if (targetBytes >= sourceBytes) {
                    val originalPages = ParcelFileDescriptor.open(
                        source,
                        ParcelFileDescriptor.MODE_READ_ONLY
                    ).use { descriptor ->
                        PdfRenderer(descriptor).use { renderer -> renderer.pageCount }
                    }
                    val unchanged = fileResult(source, originalPages)
                    unchanged.putBoolean("targetReached", true)
                    promise.resolve(unchanged)
                    return@execute
                }
                val ratio = targetBytes.toDouble() / sourceBytes.toDouble()

                var quality = when {
                    ratio >= 0.85 -> 92
                    ratio >= 0.60 -> 86
                    ratio >= 0.40 -> 78
                    ratio >= 0.20 -> 68
                    else -> 58
                }
                var maxSide = when {
                    ratio >= 0.75 -> 2600
                    ratio >= 0.45 -> 2200
                    ratio >= 0.25 -> 1800
                    ratio >= 0.10 -> 1450
                    else -> 1200
                }

                val output = uniquePdfFile(requestedName)
                var pageCount = 0
                var attempt = 0
                while (attempt < 3) {
                    val pageJpegs = renderPdfToJpegs(source, maxSide, quality)
                    pageCount = pageJpegs.size
                    writePdfFromJpegs(pageJpegs, output)
                    pageJpegs.forEach { it.delete() }
                    if (output.length() <= targetBytes || attempt == 2) {
                        break
                    }
                    maxSide = max(900, (maxSide * 0.82).toInt())
                    quality = max(45, quality - 10)
                    attempt += 1
                }

                source.delete()
                val map = fileResult(output, pageCount)
                map.putBoolean("targetReached", output.length() <= targetBytes)
                promise.resolve(map)
            } catch (error: Throwable) {
                promise.reject("E_COMPRESS_PDF", error)
            }
        }
    }

    @ReactMethod
    fun savePdf(path: String, requestedName: String, promise: Promise) {
        worker.execute {
            try {
                val source = File(path)
                if (!source.exists() || !source.isFile) {
                    throw IllegalStateException("The generated PDF is no longer available.")
                }

                val displayName = ensurePdfExtension(requestedName)
                val resolver = context.contentResolver
                val values = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
                    put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf")
                    put(
                        MediaStore.MediaColumns.RELATIVE_PATH,
                        Environment.DIRECTORY_DOWNLOADS + "/Paperly"
                    )
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }

                val destination = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: throw IllegalStateException("Android could not create the PDF in Downloads.")

                try {
                    resolver.openOutputStream(destination, "w").use { output ->
                        if (output == null) throw IllegalStateException("Could not open the saved PDF.")
                        source.inputStream().use { input -> input.copyTo(output) }
                        output.flush()
                    }
                    val ready = ContentValues().apply {
                        put(MediaStore.MediaColumns.IS_PENDING, 0)
                    }
                    resolver.update(destination, ready, null, null)
                } catch (error: Throwable) {
                    resolver.delete(destination, null, null)
                    throw error
                }

                val response = Arguments.createMap()
                response.putString("uri", destination.toString())
                response.putString("name", displayName)
                promise.resolve(response)
            } catch (error: Throwable) {
                promise.reject("E_SAVE_PDF", error)
            }
        }
    }

    override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        when (requestCode) {
            REQUEST_SCAN -> handleScanResult(resultCode, data)
            REQUEST_IMAGES -> handlePickerResult("images", resultCode, data)
            REQUEST_PDF -> handlePickerResult("pdf", resultCode, data)
        }
    }

    override fun onNewIntent(intent: Intent) {
        // No deep-link handling is required.
    }

    private fun handleScanResult(resultCode: Int, data: Intent?) {
        val promise = scanPromise ?: return
        scanPromise = null
        if (resultCode != Activity.RESULT_OK) {
            promise.reject("E_SCAN_CANCELLED", "Document scan was cancelled.")
            return
        }

        worker.execute {
            try {
                val scan = GmsDocumentScanningResult.fromActivityResultIntent(data)
                    ?: throw IllegalStateException("The scanner returned no document.")
                val pdf = scan.pdf
                    ?: throw IllegalStateException("The scanner did not return a PDF.")
                val localPdf = copyUriToCache(
                    pdf.uri,
                    "paperly_scan_" + System.currentTimeMillis() + ".pdf"
                )
                promise.resolve(fileResult(localPdf, pdf.pageCount))
            } catch (error: Throwable) {
                promise.reject("E_SCAN_RESULT", error)
            }
        }
    }

    private fun handlePickerResult(mode: String, resultCode: Int, data: Intent?) {
        val promise = pickerPromise ?: return
        pickerPromise = null
        pickerMode = null

        if (resultCode != Activity.RESULT_OK || data == null) {
            promise.reject("E_PICKER_CANCELLED", "File selection was cancelled.")
            return
        }

        try {
            val selected = mutableListOf<Uri>()
            val clip = data.clipData
            if (clip != null) {
                for (index in 0 until clip.itemCount) {
                    selected.add(clip.getItemAt(index).uri)
                }
            } else {
                data.data?.let { selected.add(it) }
            }
            if (selected.isEmpty()) {
                promise.reject("E_PICKER_EMPTY", "No file was selected.")
                return
            }

            selected.forEach { uri ->
                try {
                    context.contentResolver.takePersistableUriPermission(
                        uri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION
                    )
                } catch (_: Throwable) {
                    // Some document providers grant only a temporary read permission.
                }
            }

            if (mode == "images") {
                val array = Arguments.createArray()
                selected.forEach { array.pushString(it.toString()) }
                promise.resolve(array)
            } else {
                val uri = selected.first()
                val metadata = queryDisplayNameAndSize(uri)
                val map = Arguments.createMap()
                map.putString("uri", uri.toString())
                map.putString("name", metadata.first)
                map.putDouble("size", metadata.second.toDouble())
                promise.resolve(map)
            }
        } catch (error: Throwable) {
            promise.reject("E_PICKER_RESULT", error)
        }
    }

    private fun queryDisplayNameAndSize(uri: Uri): Pair<String, Long> {
        var name = "Selected document.pdf"
        var size = 0L
        var cursor: Cursor? = null
        try {
            cursor = context.contentResolver.query(
                uri,
                arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE),
                null,
                null,
                null
            )
            if (cursor != null && cursor.moveToFirst()) {
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                if (nameIndex >= 0) name = cursor.getString(nameIndex) ?: name
                if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) size = cursor.getLong(sizeIndex)
            }
        } finally {
            cursor?.close()
        }
        return Pair(name, size)
    }

    private fun workDirectory(): File {
        val directory = File(context.cacheDir, "paperly-work")
        if (!directory.exists() && !directory.mkdirs()) {
            throw IllegalStateException("Could not create a temporary workspace.")
        }
        return directory
    }

    private fun uniquePdfFile(requestedName: String): File {
        val safeName = ensurePdfExtension(requestedName).removeSuffix(".pdf")
        return File(workDirectory(), safeName + "_" + System.nanoTime() + ".pdf")
    }

    private fun ensurePdfExtension(name: String): String {
        val cleaned = name
            .replace(Regex("[\\\\/:*?\"<>|]"), "_")
            .trim()
            .trim('.')
            .ifBlank { "Paperly_document" }
        return if (cleaned.endsWith(".pdf", ignoreCase = true)) cleaned else "$cleaned.pdf"
    }

    private fun copyUriToCache(uri: Uri, fileName: String): File {
        val destination = File(workDirectory(), fileName)
        context.contentResolver.openInputStream(uri).use { input ->
            if (input == null) throw IllegalStateException("Could not read the selected document.")
            FileOutputStream(destination).use { output -> input.copyTo(output) }
        }
        return destination
    }

    private fun encodeImageToJpeg(
        uri: Uri,
        destination: File,
        maxDimension: Int,
        quality: Int
    ): File {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri).use { input ->
            if (input == null) throw IllegalStateException("Could not open one of the selected images.")
            BitmapFactory.decodeStream(input, null, bounds)
        }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
            throw IllegalArgumentException("An image could not be decoded.")
        }

        var sample = 1
        val largest = max(bounds.outWidth, bounds.outHeight)
        while (largest / sample > maxDimension * 1.35) {
            sample *= 2
        }

        val options = BitmapFactory.Options().apply {
            inSampleSize = sample
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        val decoded = context.contentResolver.openInputStream(uri).use { input ->
            if (input == null) throw IllegalStateException("Could not reopen an image.")
            BitmapFactory.decodeStream(input, null, options)
                ?: throw IllegalArgumentException("An image could not be decoded.")
        }

        val orientation = try {
            context.contentResolver.openInputStream(uri).use { input ->
                if (input == null) ExifInterface.ORIENTATION_NORMAL
                else ExifInterface(input).getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL
                )
            }
        } catch (_: Throwable) {
            ExifInterface.ORIENTATION_NORMAL
        }

        val matrix = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.preScale(-1f, 1f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.preScale(1f, -1f)
        }

        val oriented = if (!matrix.isIdentity) {
            Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true).also {
                if (it !== decoded) decoded.recycle()
            }
        } else {
            decoded
        }

        FileOutputStream(destination).use { output ->
            if (!oriented.compress(Bitmap.CompressFormat.JPEG, quality, output)) {
                throw IllegalStateException("Could not encode an image.")
            }
            output.flush()
        }
        oriented.recycle()
        return destination
    }

    private fun renderPdfToJpegs(source: File, maxSide: Int, quality: Int): List<File> {
        val pages = mutableListOf<File>()
        ParcelFileDescriptor.open(source, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
            PdfRenderer(descriptor).use { renderer ->
                for (index in 0 until renderer.pageCount) {
                renderer.openPage(index).use { page ->
                    val longest = max(page.width, page.height).coerceAtLeast(1)
                    val scale = min(1.0, maxSide.toDouble() / longest.toDouble())
                    val width = max(1, (page.width * scale).toInt())
                    val height = max(1, (page.height * scale).toInt())
                    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT)

                    val imageFile = File(
                        workDirectory(),
                        "compressed_" + System.nanoTime() + "_" + index + ".jpg"
                    )
                    FileOutputStream(imageFile).use { output ->
                        bitmap.compress(Bitmap.CompressFormat.JPEG, quality, output)
                        output.flush()
                    }
                    bitmap.recycle()
                    pages.add(imageFile)
                }
            }
        }
    }
        return pages
    }

    private fun writePdfFromJpegs(images: List<File>, destination: File) {
        if (images.isEmpty()) throw IllegalArgumentException("No pages were available to write.")
        RandomAccessFile(destination, "rw").use { output ->
            output.setLength(0L)
            output.write("%PDF-1.4\n".toByteArray(Charsets.ISO_8859_1))

            val objectCount = 2 + images.size * 3
            val offsets = LongArray(objectCount + 1)

            fun beginObject(id: Int) {
                offsets[id] = output.filePointer
                output.write((id.toString() + " 0 obj\n").toByteArray(Charsets.ISO_8859_1))
            }

            beginObject(1)
            output.write("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n".toByteArray(Charsets.ISO_8859_1))

            val kids = (0 until images.size).joinToString(" ") { index ->
                (3 + index * 3).toString() + " 0 R"
            }
            beginObject(2)
            output.write(
                ("<< /Type /Pages /Count " + images.size + " /Kids [" + kids + "] >>\nendobj\n")
                    .toByteArray(Charsets.ISO_8859_1)
            )

            images.forEachIndexed { index, image ->
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeFile(image.absolutePath, bounds)
                val imageWidth = bounds.outWidth.coerceAtLeast(1)
                val imageHeight = bounds.outHeight.coerceAtLeast(1)

                val pageWidth = if (imageWidth >= imageHeight) 841.89 else 595.28
                val pageHeight = if (imageWidth >= imageHeight) 595.28 else 841.89
                val margin = 18.0
                val availableWidth = pageWidth - margin * 2
                val availableHeight = pageHeight - margin * 2
                val factor = min(
                    availableWidth / imageWidth.toDouble(),
                    availableHeight / imageHeight.toDouble()
                )
                val drawWidth = imageWidth * factor
                val drawHeight = imageHeight * factor
                val x = (pageWidth - drawWidth) / 2.0
                val y = (pageHeight - drawHeight) / 2.0

                val pageId = 3 + index * 3
                val imageId = pageId + 1
                val contentId = pageId + 2

                beginObject(pageId)
                val pageObject =
                    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
                    String.format(Locale.US, "%.2f %.2f", pageWidth, pageHeight) +
                    "] /Resources << /XObject << /Im0 " + imageId +
                    " 0 R >> >> /Contents " + contentId + " 0 R >>\nendobj\n"
                output.write(pageObject.toByteArray(Charsets.ISO_8859_1))

                beginObject(imageId)
                val imageHeader =
                    "<< /Type /XObject /Subtype /Image /Width " + imageWidth +
                    " /Height " + imageHeight +
                    " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
                    image.length() + " >>\nstream\n"
                output.write(imageHeader.toByteArray(Charsets.ISO_8859_1))
                image.inputStream().use { input ->
                    val buffer = ByteArray(32 * 1024)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        output.write(buffer, 0, count)
                    }
                }
                output.write("\nendstream\nendobj\n".toByteArray(Charsets.ISO_8859_1))

                val content = String.format(
                    Locale.US,
                    "q %.2f 0 0 %.2f %.2f %.2f cm /Im0 Do Q\n",
                    drawWidth,
                    drawHeight,
                    x,
                    y
                )
                val contentBytes = content.toByteArray(Charsets.ISO_8859_1)
                beginObject(contentId)
                output.write(
                    ("<< /Length " + contentBytes.size + " >>\nstream\n")
                        .toByteArray(Charsets.ISO_8859_1)
                )
                output.write(contentBytes)
                output.write("endstream\nendobj\n".toByteArray(Charsets.ISO_8859_1))
            }

            val xrefPosition = output.filePointer
            output.write(("xref\n0 " + (objectCount + 1) + "\n").toByteArray(Charsets.ISO_8859_1))
            output.write("0000000000 65535 f \n".toByteArray(Charsets.ISO_8859_1))
            for (id in 1..objectCount) {
                output.write(
                    String.format(Locale.US, "%010d 00000 n \n", offsets[id])
                        .toByteArray(Charsets.ISO_8859_1)
                )
            }
            val trailer =
                "trailer\n<< /Size " + (objectCount + 1) +
                " /Root 1 0 R >>\nstartxref\n" + xrefPosition + "\n%%EOF\n"
            output.write(trailer.toByteArray(Charsets.ISO_8859_1))
            output.fd.sync()
        }
    }

    private fun fileResult(file: File, pageCount: Int): WritableMap {
        val map = Arguments.createMap()
        map.putString("path", file.absolutePath)
        map.putString("fileName", file.name)
        map.putInt("pages", pageCount)
        map.putDouble("bytes", file.length().toDouble())
        return map
    }
}
