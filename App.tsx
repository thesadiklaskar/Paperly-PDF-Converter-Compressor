import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  NativeModules,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type PickedPdf = {uri: string; name: string; size: number};
type NativeResult = {
  path: string;
  fileName: string;
  pages: number;
  bytes: number;
  targetReached?: boolean;
};
type NativeApi = {
  pickImages(): Promise<string[]>;
  scanDocument(): Promise<NativeResult>;
  pickPdf(): Promise<PickedPdf>;
  createPdf(uris: string[], name: string): Promise<NativeResult>;
  compressPdf(uri: string, targetMb: number, name: string): Promise<NativeResult>;
  savePdf(path: string, name: string): Promise<{uri: string; name: string}>;
};

const PdfTools = NativeModules.PdfTools as NativeApi;
const COLORS = {
  ink: '#171A2C',
  muted: '#7B8196',
  background: '#F6F7FB',
  surface: '#FFFFFF',
  primary: '#5356E8',
  primaryDark: '#3F43CA',
  pale: '#ECEEFF',
  border: '#E7E9F1',
  green: '#18875B',
  softGreen: '#E6F6EF',
  darkPanel: '#202344',
};

function bytesLabel(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function ActionButton({
  title,
  onPress,
  tone = 'primary',
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  tone?: 'primary' | 'light' | 'outline';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        tone === 'primary' && styles.primaryButton,
        tone === 'light' && styles.lightButton,
        tone === 'outline' && styles.outlineButton,
        disabled && styles.disabledButton,
      ]}>
      <Text
        style={[
          styles.actionButtonText,
          tone !== 'primary' && styles.lightButtonText,
        ]}>
        {title}
      </Text>
    </Pressable>
  );
}

function BrandMark() {
  return (
    <View style={styles.brandMark}>
      <View style={styles.brandPaper}>
        <View style={styles.brandLine} />
        <View style={styles.brandLine} />
        <View style={[styles.brandLine, styles.brandLineShort]} />
      </View>
    </View>
  );
}

export default function App() {
  const [tab, setTab] = useState<'converter' | 'compressor'>('converter');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [pickedPdf, setPickedPdf] = useState<PickedPdf | null>(null);
  const [targetMb, setTargetMb] = useState('10');
  const [result, setResult] = useState<NativeResult | null>(null);
  const [rename, setRename] = useState('');
  const [working, setWorking] = useState(false);
  const [workingLabel, setWorkingLabel] = useState('Working…');

  const runTask = async (label: string, task: () => Promise<void>) => {
    if (!PdfTools) {
      Alert.alert('Native tools unavailable', 'Please install the Android build of Paperly.');
      return;
    }
    setWorking(true);
    setWorkingLabel(label);
    try {
      await task();
    } catch (error: any) {
      const message = String(error?.message || error || 'Something went wrong.');
      if (!message.toLowerCase().includes('cancel')) {
        Alert.alert('Could not complete', message);
      }
    } finally {
      setWorking(false);
    }
  };

  const showResult = (file: NativeResult) => {
    setResult(file);
    setRename(file.fileName.replace(/\.pdf$/i, ''));
  };

  const chooseImages = () =>
    runTask('Opening images…', async () => {
      const uris = await PdfTools.pickImages();
      setImageUris(uris);
      setResult(null);
    });

  const scanDocument = () =>
    runTask('Opening document scanner…', async () => {
      const file = await PdfTools.scanDocument();
      setImageUris([]);
      setPickedPdf(null);
      showResult(file);
    });

  const createPdf = () =>
    runTask('Creating your PDF…', async () => {
      const file = await PdfTools.createPdf(imageUris, 'Paperly_document.pdf');
      showResult(file);
    });

  const choosePdf = () =>
    runTask('Opening files…', async () => {
      const file = await PdfTools.pickPdf();
      setPickedPdf(file);
      setResult(null);
    });

  const compressPdf = () =>
    runTask('Optimizing PDF pages…', async () => {
      const desired = Number(targetMb.replace(',', '.'));
      if (!Number.isFinite(desired) || desired <= 0) {
        Alert.alert('Enter a valid size', 'Choose a target size greater than 0 MB.');
        return;
      }
      if (!pickedPdf) {
        Alert.alert('Choose a PDF first', 'Select the PDF you want to compress.');
        return;
      }
      const file = await PdfTools.compressPdf(
        pickedPdf.uri,
        desired,
        'Paperly_compressed.pdf',
      );
      showResult(file);
    });

  const saveResult = (useOriginalName: boolean) =>
    runTask('Saving to Downloads…', async () => {
      if (!result) return;
      const chosenName = useOriginalName ? result.fileName : rename.trim();
      const saved = await PdfTools.savePdf(result.path, chosenName);
      Alert.alert('PDF saved', saved.name + ' is now in Downloads / Paperly.');
      setResult(null);
      setImageUris([]);
      setPickedPdf(null);
    });

  const switchTab = (next: 'converter' | 'compressor') => {
    setTab(next);
    setResult(null);
    setImageUris([]);
    setPickedPdf(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.screen}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <BrandMark />
              <View>
                <Text style={styles.brandName}>paperly</Text>
                <Text style={styles.brandCaption}>DOCUMENT STUDIO</Text>
              </View>
            </View>
            <View style={styles.privateBadge}>
              <View style={styles.privateDot} />
              <Text style={styles.privateText}>ON DEVICE</Text>
            </View>
          </View>

          {!result ? (
            <>
              <View style={styles.hero}>
                <View style={styles.heroTopline}>
                  <Text style={styles.heroEyebrow}>YOUR PAPERWORK, SIMPLIFIED</Text>
                  <View style={styles.heroSpark}>
                    <Text style={styles.heroSparkText}>✦</Text>
                  </View>
                </View>
                <Text style={styles.heroTitle}>
                  {tab === 'converter'
                    ? 'Make every page\ncount.'
                    : 'Lighter files.\nClear pages.'}
                </Text>
                <Text style={styles.heroSubtitle}>
                  {tab === 'converter'
                    ? 'Turn photos or real-world documents into crisp PDFs in a few taps.'
                    : 'Reduce PDF file size while keeping pages readable and easy to share.'}
                </Text>
                <View style={styles.heroFooter}>
                  <Text style={styles.heroFooterText}>SIMPLE</Text>
                  <View style={styles.heroFooterDivider} />
                  <Text style={styles.heroFooterText}>PRIVATE</Text>
                  <View style={styles.heroFooterDivider} />
                  <Text style={styles.heroFooterText}>FAST</Text>
                </View>
                <View style={styles.heroOrb} />
              </View>

              {tab === 'converter' ? (
                <>
                  <View style={styles.sectionHeading}>
                    <View>
                      <Text style={styles.sectionTitle}>PDF Converter</Text>
                      <Text style={styles.sectionSubtitle}>Choose how you want to start</Text>
                    </View>
                    <Text style={styles.stepLabel}>01 / 02</Text>
                  </View>

                  <Pressable style={styles.scanCard} onPress={scanDocument}>
                    <View style={styles.scanCardTop}>
                      <View style={styles.scanIconWrap}>
                        <Text style={styles.scanIcon}>▣</Text>
                      </View>
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedText}>BEST FOR DOCUMENTS</Text>
                      </View>
                    </View>
                    <Text style={styles.cardTitleLight}>Scan with camera</Text>
                    <Text style={styles.cardDescriptionLight}>
                      Auto-crop, clean up and capture multiple pages into one PDF.
                    </Text>
                    <View style={styles.cardBottom}>
                      <Text style={styles.cardLinkLight}>OPEN SCANNER</Text>
                      <Text style={styles.cardArrowLight}>↗</Text>
                    </View>
                    <View style={styles.scanDecorOne} />
                    <View style={styles.scanDecorTwo} />
                  </Pressable>

                  <Pressable style={styles.imageCard} onPress={chooseImages}>
                    <View style={styles.imageIconWrap}>
                      <Text style={styles.imageIcon}>▧</Text>
                    </View>
                    <View style={styles.imageCardCopy}>
                      <Text style={styles.cardTitle}>Images to PDF</Text>
                      <Text style={styles.cardDescription}>
                        Combine JPG and PNG photos into a single PDF.
                      </Text>
                    </View>
                    <Text style={styles.cardArrow}>→</Text>
                  </Pressable>

                  {imageUris.length > 0 && (
                    <View style={styles.selectionCard}>
                      <View style={styles.selectionCopy}>
                        <Text style={styles.selectionTitle}>{imageUris.length} images selected</Text>
                        <Text style={styles.selectionSubtitle}>Ready to combine into one PDF</Text>
                      </View>
                      <ActionButton title="Create PDF" onPress={createPdf} />
                    </View>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.sectionHeading}>
                    <View>
                      <Text style={styles.sectionTitle}>PDF Compressor</Text>
                      <Text style={styles.sectionSubtitle}>Set a target size for your file</Text>
                    </View>
                    <Text style={styles.stepLabel}>02 / 02</Text>
                  </View>

                  <Pressable style={styles.uploadCard} onPress={choosePdf}>
                    <View style={styles.uploadIconWrap}>
                      <Text style={styles.uploadIcon}>↑</Text>
                    </View>
                    <Text style={styles.cardTitle}>Choose a PDF</Text>
                    <Text style={styles.cardDescription}>
                      Select a document from your device to get started.
                    </Text>
                    <View style={styles.uploadButton}>
                      <Text style={styles.uploadButtonText}>BROWSE FILES  →</Text>
                    </View>
                  </Pressable>

                  {pickedPdf && (
                    <View style={styles.fileCard}>
                      <View style={styles.pdfGlyph}>
                        <Text style={styles.pdfGlyphText}>PDF</Text>
                      </View>
                      <View style={styles.fileCopy}>
                        <Text style={styles.fileName} numberOfLines={1}>{pickedPdf.name}</Text>
                        <Text style={styles.fileMeta}>{bytesLabel(pickedPdf.size)} · Ready to compress</Text>
                      </View>
                      <Text style={styles.fileCheck}>✓</Text>
                    </View>
                  )}

                  <View style={styles.targetCard}>
                    <View style={styles.targetHeader}>
                      <View>
                        <Text style={styles.targetTitle}>Target file size</Text>
                        <Text style={styles.targetHint}>Choose your preferred output size</Text>
                      </View>
                      <Text style={styles.targetIcon}>⌁</Text>
                    </View>
                    <View style={styles.targetInputRow}>
                      <TextInput
                        value={targetMb}
                        onChangeText={setTargetMb}
                        keyboardType="decimal-pad"
                        maxLength={7}
                        selectTextOnFocus
                        style={styles.targetInput}
                        accessibilityLabel="Target size in megabytes"
                      />
                      <Text style={styles.targetUnit}>MB</Text>
                    </View>
                    <View style={styles.presetRow}>
                      {['1', '5', '10', '25', '50'].map(value => (
                        <Pressable
                          key={value}
                          onPress={() => setTargetMb(value)}
                          style={[
                            styles.preset,
                            targetMb === value && styles.presetActive,
                          ]}>
                          <Text style={[
                            styles.presetText,
                            targetMb === value && styles.presetTextActive,
                          ]}>
                            {value} MB
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.targetFootnote}>
                      We keep the highest practical image quality for your target. Very small targets may require more visible compression.
                    </Text>
                  </View>

                  <ActionButton
                    title="Compress PDF  →"
                    onPress={compressPdf}
                    disabled={!pickedPdf}
                  />
                  <Text style={styles.compressionNote}>
                    Note: compressed pages are image-based, so selectable text may not be retained.
                  </Text>
                </>
              )}
            </>
          ) : (
            <View style={styles.resultScreen}>
              <View style={styles.successCircle}>
                <Text style={styles.successCheck}>✓</Text>
              </View>
              <Text style={styles.resultEyebrow}>YOUR FILE IS READY</Text>
              <Text style={styles.resultTitle}>PDF created.</Text>
              <Text style={styles.resultSubtitle}>
                Give it a name, then save it to your device.
              </Text>

              <View style={styles.resultFileCard}>
                <View style={styles.resultPdfIcon}>
                  <Text style={styles.resultPdfText}>PDF</Text>
                </View>
                <View style={styles.resultFileCopy}>
                  <Text style={styles.resultFileName} numberOfLines={1}>{result.fileName}</Text>
                  <Text style={styles.resultFileMeta}>
                    {result.pages} {result.pages === 1 ? 'page' : 'pages'} · {bytesLabel(result.bytes)}
                  </Text>
                </View>
                <View style={styles.readyBadge}>
                  <Text style={styles.readyBadgeText}>READY</Text>
                </View>
              </View>

              {tab === 'compressor' && result.targetReached === false && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    The requested size was very small for this document. Paperly saved the best-quality result it could produce; the target was not fully reached.
                  </Text>
                </View>
              )}

              <View style={styles.renameCard}>
                <Text style={styles.renameLabel}>FILE NAME</Text>
                <View style={styles.renameInputWrap}>
                  <TextInput
                    value={rename}
                    onChangeText={setRename}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.renameInput}
                    placeholder="Enter PDF name"
                    placeholderTextColor={COLORS.muted}
                  />
                  <Text style={styles.extension}>.pdf</Text>
                </View>
                <Text style={styles.renameHint}>You can rename it now, or keep the suggested name.</Text>
              </View>

              <ActionButton
                title="Save PDF to Downloads  →"
                onPress={() => saveResult(false)}
                disabled={!rename.trim()}
              />
              <ActionButton
                title="Save with original name"
                onPress={() => saveResult(true)}
                tone="light"
              />
              <Pressable
                onPress={() => setResult(null)}
                style={styles.backLink}>
                <Text style={styles.backLinkText}>← Back to {tab === 'converter' ? 'converter' : 'compressor'}</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.privacyNote}>
            <Text style={styles.privacyIcon}>◈</Text>
            <Text style={styles.privacyCopy}>
              Your files stay on your device. Paperly does not upload your documents.
            </Text>
          </View>
          <View style={styles.footerSpace} />
        </ScrollView>

        <View style={styles.bottomNav}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{selected: tab === 'converter'}}
            onPress={() => switchTab('converter')}
            style={styles.navItem}>
            <View style={[styles.navIconWrap, tab === 'converter' && styles.navIconActive]}>
              <Text style={[styles.navIcon, tab === 'converter' && styles.navIconSelected]}>▤</Text>
            </View>
            <Text style={[styles.navLabel, tab === 'converter' && styles.navLabelActive]}>
              PDF Converter
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{selected: tab === 'compressor'}}
            onPress={() => switchTab('compressor')}
            style={styles.navItem}>
            <View style={[styles.navIconWrap, tab === 'compressor' && styles.navIconActive]}>
              <Text style={[styles.navIcon, tab === 'compressor' && styles.navIconSelected]}>⇣</Text>
            </View>
            <Text style={[styles.navLabel, tab === 'compressor' && styles.navLabelActive]}>
              PDF Compressor
            </Text>
          </Pressable>
        </View>

        {working && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingTitle}>{workingLabel}</Text>
              <Text style={styles.loadingSubtitle}>Please keep Paperly open for this task.</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: COLORS.background},
  screen: {flex: 1, backgroundColor: COLORS.background},
  scrollContent: {paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22},
  brandRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  brandMark: {width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.primary, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3},
  brandPaper: {width: 21, height: 25, borderRadius: 4, backgroundColor: '#FFFFFF', paddingHorizontal: 5, paddingTop: 7, gap: 3},
  brandLine: {height: 2, borderRadius: 2, backgroundColor: COLORS.primary},
  brandLineShort: {width: 8},
  brandName: {fontSize: 22, fontWeight: '800', color: COLORS.ink, letterSpacing: -0.8},
  brandCaption: {fontSize: 8, fontWeight: '800', color: COLORS.muted, letterSpacing: 1.5, marginTop: -1},
  privateBadge: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#EBF7F1', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7, gap: 6},
  privateDot: {width: 6, height: 6, borderRadius: 3, backgroundColor: '#1E9C68'},
  privateText: {fontSize: 9, color: '#18875B', fontWeight: '800', letterSpacing: 0.8},
  hero: {backgroundColor: COLORS.darkPanel, minHeight: 218, borderRadius: 24, padding: 22, overflow: 'hidden', marginBottom: 27},
  heroTopline: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  heroEyebrow: {fontSize: 9, fontWeight: '800', color: '#BFC3FF', letterSpacing: 1.3},
  heroSpark: {width: 25, height: 25, borderRadius: 9, backgroundColor: '#3B3D70', alignItems: 'center', justifyContent: 'center'},
  heroSparkText: {color: '#D9DBFF', fontSize: 15},
  heroTitle: {fontSize: 31, lineHeight: 36, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1.1, marginTop: 17},
  heroSubtitle: {fontSize: 12, lineHeight: 19, color: '#C6C9DD', marginTop: 9, maxWidth: '88%'},
  heroFooter: {flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 19},
  heroFooterText: {fontSize: 8, letterSpacing: 1.2, fontWeight: '800', color: '#C4C7EA'},
  heroFooterDivider: {width: 3, height: 3, borderRadius: 2, backgroundColor: '#777BAE'},
  heroOrb: {position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: '#FFFFFF12', right: -91, bottom: -85},
  sectionHeading: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14},
  sectionTitle: {fontSize: 20, fontWeight: '800', color: COLORS.ink, letterSpacing: -0.5},
  sectionSubtitle: {fontSize: 11, color: COLORS.muted, marginTop: 4},
  stepLabel: {fontSize: 9, fontWeight: '800', color: '#A1A5B6', letterSpacing: 1},
  scanCard: {backgroundColor: COLORS.primary, minHeight: 204, borderRadius: 22, padding: 19, marginBottom: 12, overflow: 'hidden'},
  scanCardTop: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  scanIconWrap: {width: 42, height: 42, borderRadius: 13, backgroundColor: '#FFFFFF24', alignItems: 'center', justifyContent: 'center'},
  scanIcon: {fontSize: 22, fontWeight: '700', color: '#FFFFFF'},
  recommendedBadge: {backgroundColor: '#FFFFFF20', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6},
  recommendedText: {fontSize: 7, letterSpacing: 0.9, fontWeight: '900', color: '#FFFFFF'},
  cardTitleLight: {fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginTop: 16, letterSpacing: -0.4},
  cardDescriptionLight: {fontSize: 11, lineHeight: 17, color: '#E0E1FF', marginTop: 6, maxWidth: '85%'},
  cardBottom: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, maxWidth: 128},
  cardLinkLight: {fontSize: 8, fontWeight: '900', letterSpacing: 1.1, color: '#FFFFFF'},
  cardArrowLight: {color: '#FFFFFF', fontSize: 17, fontWeight: '700'},
  scanDecorOne: {position: 'absolute', width: 116, height: 116, borderRadius: 58, borderWidth: 1, borderColor: '#FFFFFF19', right: -28, top: 39},
  scanDecorTwo: {position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 1, borderColor: '#FFFFFF19', right: -7, top: 59},
  imageCard: {backgroundColor: COLORS.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', marginBottom: 12},
  imageIconWrap: {width: 47, height: 47, borderRadius: 15, backgroundColor: '#F0F0FF', alignItems: 'center', justifyContent: 'center'},
  imageIcon: {fontSize: 25, color: COLORS.primary},
  imageCardCopy: {flex: 1, paddingHorizontal: 13},
  cardTitle: {fontSize: 14, fontWeight: '800', color: COLORS.ink},
  cardDescription: {fontSize: 10, lineHeight: 15, color: COLORS.muted, marginTop: 4},
  cardArrow: {fontSize: 20, color: COLORS.primary, fontWeight: '600'},
  selectionCard: {backgroundColor: '#EEF0FF', borderWidth: 1, borderColor: '#DDE0FF', borderRadius: 18, padding: 14, marginTop: 2, gap: 12},
  selectionCopy: {gap: 3},
  selectionTitle: {fontSize: 13, fontWeight: '800', color: COLORS.ink},
  selectionSubtitle: {fontSize: 10, color: COLORS.muted},
  actionButton: {minHeight: 50, borderRadius: 15, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', marginTop: 10},
  primaryButton: {backgroundColor: COLORS.primary},
  lightButton: {backgroundColor: COLORS.pale, borderWidth: 1, borderColor: '#DADDFE'},
  outlineButton: {backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border},
  disabledButton: {opacity: 0.45},
  actionButtonText: {fontSize: 12, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.1},
  lightButtonText: {color: COLORS.primary},
  uploadCard: {backgroundColor: COLORS.surface, borderRadius: 22, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', marginBottom: 13},
  uploadIconWrap: {width: 52, height: 52, borderRadius: 17, backgroundColor: COLORS.pale, alignItems: 'center', justifyContent: 'center', marginBottom: 13},
  uploadIcon: {fontSize: 27, color: COLORS.primary, fontWeight: '700'},
  uploadCardTitle: {fontSize: 15, fontWeight: '800', color: COLORS.ink},
  uploadButton: {paddingHorizontal: 15, paddingVertical: 10, borderRadius: 11, backgroundColor: COLORS.pale, marginTop: 16},
  uploadButtonText: {fontSize: 9, letterSpacing: 1, color: COLORS.primary, fontWeight: '900'},
  fileCard: {flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 13, marginBottom: 13},
  pdfGlyph: {width: 42, height: 46, borderRadius: 10, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center'},
  pdfGlyphText: {fontSize: 10, color: '#E45D63', fontWeight: '900'},
  fileCopy: {flex: 1, paddingHorizontal: 11},
  fileName: {fontSize: 12, color: COLORS.ink, fontWeight: '800'},
  fileMeta: {fontSize: 10, color: COLORS.muted, marginTop: 4},
  fileCheck: {fontSize: 18, color: COLORS.green, fontWeight: '800', paddingHorizontal: 6},
  targetCard: {backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 17, marginBottom: 10},
  targetHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  targetTitle: {fontSize: 14, fontWeight: '800', color: COLORS.ink},
  targetHint: {fontSize: 10, color: COLORS.muted, marginTop: 4},
  targetIcon: {fontSize: 25, color: COLORS.primary},
  targetInputRow: {height: 57, borderRadius: 13, backgroundColor: '#F6F7FC', borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingHorizontal: 15},
  targetInput: {flex: 1, fontSize: 23, fontWeight: '800', color: COLORS.ink, paddingVertical: 0},
  targetUnit: {fontSize: 13, color: COLORS.muted, fontWeight: '800'},
  presetRow: {flexDirection: 'row', gap: 6, marginTop: 11},
  preset: {flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9, backgroundColor: '#F4F5FA', borderWidth: 1, borderColor: '#EFF0F5'},
  presetActive: {backgroundColor: COLORS.pale, borderColor: '#D3D7FF'},
  presetText: {fontSize: 9, color: COLORS.muted, fontWeight: '800'},
  presetTextActive: {color: COLORS.primary},
  targetFootnote: {fontSize: 9, lineHeight: 14, color: COLORS.muted, marginTop: 12},
  compressionNote: {fontSize: 9, lineHeight: 14, color: COLORS.muted, marginTop: 8, marginBottom: 8, textAlign: 'center'},
  resultScreen: {alignItems: 'stretch', paddingTop: 25},
  successCircle: {width: 66, height: 66, borderRadius: 33, backgroundColor: COLORS.softGreen, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18},
  successCheck: {fontSize: 32, color: COLORS.green, fontWeight: '800'},
  resultEyebrow: {fontSize: 9, letterSpacing: 1.4, fontWeight: '900', textAlign: 'center', color: COLORS.green},
  resultTitle: {fontSize: 28, fontWeight: '900', color: COLORS.ink, textAlign: 'center', letterSpacing: -0.8, marginTop: 8},
  resultSubtitle: {fontSize: 11, color: COLORS.muted, textAlign: 'center', marginTop: 7, marginBottom: 22},
  resultFileCard: {flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginBottom: 17},
  resultPdfIcon: {width: 46, height: 50, backgroundColor: '#FFF0F0', borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  resultPdfText: {fontSize: 11, color: '#E45D63', fontWeight: '900'},
  resultFileCopy: {flex: 1, paddingHorizontal: 12},
  resultFileName: {fontSize: 12, fontWeight: '800', color: COLORS.ink},
  resultFileMeta: {fontSize: 10, color: COLORS.muted, marginTop: 5},
  readyBadge: {paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: COLORS.softGreen},
  readyBadgeText: {fontSize: 8, fontWeight: '900', color: COLORS.green, letterSpacing: 0.7},
  warningBox: {backgroundColor: '#FFF6E7', borderWidth: 1, borderColor: '#F7E5C3', borderRadius: 13, padding: 12, marginBottom: 13},
  warningText: {fontSize: 10, lineHeight: 15, color: '#8B5B13'},
  renameCard: {backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 16, marginBottom: 6},
  renameLabel: {fontSize: 9, fontWeight: '900', letterSpacing: 1.1, color: COLORS.muted},
  renameInputWrap: {height: 48, flexDirection: 'row', alignItems: 'center', borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, marginTop: 9},
  renameInput: {flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.ink, paddingVertical: 0},
  extension: {fontSize: 12, fontWeight: '800', color: COLORS.muted},
  renameHint: {fontSize: 9, color: COLORS.muted, marginTop: 9},
  backLink: {alignSelf: 'center', padding: 14, marginTop: 5},
  backLinkText: {fontSize: 11, color: COLORS.muted, fontWeight: '700'},
  privacyNote: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 22, paddingHorizontal: 7},
  privacyIcon: {fontSize: 14, color: COLORS.green},
  privacyCopy: {fontSize: 9, lineHeight: 14, color: COLORS.muted, flex: 1},
  footerSpace: {height: 8},
  bottomNav: {height: 76, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 25, paddingBottom: 7},
  navItem: {alignItems: 'center', justifyContent: 'center', flex: 1, gap: 4},
  navIconWrap: {width: 37, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center'},
  navIconActive: {backgroundColor: COLORS.pale},
  navIcon: {fontSize: 20, color: '#9DA2B3', fontWeight: '700'},
  navIconSelected: {color: COLORS.primary},
  navLabel: {fontSize: 9, color: '#9DA2B3', fontWeight: '700'},
  navLabelActive: {color: COLORS.primary, fontWeight: '900'},
  loadingOverlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#11142666', alignItems: 'center', justifyContent: 'center', padding: 30},
  loadingCard: {width: '100%', borderRadius: 20, padding: 25, backgroundColor: COLORS.surface, alignItems: 'center'},
  loadingTitle: {fontSize: 14, fontWeight: '800', color: COLORS.ink, marginTop: 15},
  loadingSubtitle: {fontSize: 10, color: COLORS.muted, marginTop: 6, textAlign: 'center'},
});
