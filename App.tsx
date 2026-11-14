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
const C = {
  background: '#F7F8FC',
  white: '#FFFFFF',
  ink: '#171A2C',
  muted: '#85899B',
  line: '#E8EAF1',
  primary: '#5356E8',
  pale: '#ECEEFF',
  green: '#18875B',
};

function fileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  return bytes < 1024 * 1024
    ? Math.round(bytes / 1024) + ' KB'
    : (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        secondary ? styles.secondaryButton : styles.primaryButton,
        disabled && styles.disabled,
      ]}>
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}

export default function App() {
  const [tab, setTab] = useState<'converter' | 'compressor'>('converter');
  const [images, setImages] = useState<string[]>([]);
  const [pdf, setPdf] = useState<PickedPdf | null>(null);
  const [target, setTarget] = useState('10');
  const [result, setResult] = useState<NativeResult | null>(null);
  const [rename, setRename] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState('Please wait…');

  const run = async (label: string, action: () => Promise<void>) => {
    if (!PdfTools) {
      Alert.alert('Error', 'Please reinstall Paperly.');
      return;
    }
    if (busy) return;
    setBusy(true);
    setBusyText(label);
    try {
      await action();
    } catch (error: any) {
      const message = String(error?.message || error || 'Something went wrong.');
      if (!message.toLowerCase().includes('cancel')) {
        Alert.alert('Error', message);
      }
    } finally {
      setBusy(false);
    }
  };

  const showResult = (file: NativeResult) => {
    setResult(file);
    setRename(file.fileName.replace(/\.pdf$/i, ''));
  };

  const scan = () => run('Opening camera…', async () => {
    const file = await PdfTools.scanDocument();
    setImages([]);
    setPdf(null);
    showResult(file);
  });

  const chooseImages = () => run('Opening images…', async () => {
    const selected = await PdfTools.pickImages();
    setImages(selected);
    setResult(null);
  });

  const createPdf = () => run('Creating PDF…', async () => {
    const file = await PdfTools.createPdf(images, 'Paperly_document.pdf');
    showResult(file);
  });

  const choosePdf = () => run('Opening files…', async () => {
    const selected = await PdfTools.pickPdf();
    setPdf(selected);
    setResult(null);
  });

  const compress = () => run('Compressing PDF…', async () => {
    const size = Number(target.replace(',', '.'));
    if (!Number.isFinite(size) || size <= 0) {
      Alert.alert('Invalid size', 'Enter a size greater than 0 MB.');
      return;
    }
    if (!pdf) {
      Alert.alert('Select a PDF', 'Choose a PDF first.');
      return;
    }
    const file = await PdfTools.compressPdf(
      pdf.uri,
      size,
      'Paperly_compressed.pdf',
    );
    showResult(file);
  });

  const save = (keepOriginal: boolean) => run('Saving PDF…', async () => {
    if (!result) return;
    const name = keepOriginal ? result.fileName : rename.trim();
    const saved = await PdfTools.savePdf(result.path, name);
    Alert.alert('Saved', saved.name);
    setResult(null);
    setImages([]);
    setPdf(null);
  });

  const changeTab = (next: 'converter' | 'compressor') => {
    if (busy) return;
    setTab(next);
    setImages([]);
    setPdf(null);
    setResult(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={styles.brandIcon}>
            <Text style={styles.brandLetter}>P</Text>
          </View>
          <Text style={styles.brand}>Paperly</Text>
        </View>

        <View style={styles.tabs}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{selected: tab === 'converter'}}
            onPress={() => changeTab('converter')}
            style={[styles.tab, tab === 'converter' && styles.activeTab]}>
            <Text style={[styles.tabText, tab === 'converter' && styles.activeTabText]}>
              PDF Converter
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{selected: tab === 'compressor'}}
            onPress={() => changeTab('compressor')}
            style={[styles.tab, tab === 'compressor' && styles.activeTab]}>
            <Text style={[styles.tabText, tab === 'compressor' && styles.activeTabText]}>
              PDF Compressor
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {!result ? (
            tab === 'converter' ? (
              <View style={styles.panel}>
                <View style={styles.panelIcon}>
                  <Text style={styles.panelIconText}>▧</Text>
                </View>
                <Text style={styles.panelTitle}>Convert to PDF</Text>
                <Button title="Scan document" onPress={scan} />
                <Button title="Upload images" secondary onPress={chooseImages} />
                {images.length > 0 && (
                  <View style={styles.selection}>
                    <Text style={styles.selectionText}>
                      {images.length} {images.length === 1 ? 'image' : 'images'} selected
                    </Text>
                    <Button title="Create PDF" onPress={createPdf} />
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.panel}>
                <View style={styles.panelIcon}>
                  <Text style={styles.pdfIconText}>PDF</Text>
                </View>
                <Text style={styles.panelTitle}>Compress PDF</Text>
                <Button
                  title={pdf ? 'Change PDF' : 'Upload PDF'}
                  onPress={choosePdf}
                  secondary={!pdf}
                />
                {pdf && (
                  <View style={styles.fileRow}>
                    <View style={styles.fileCopy}>
                      <Text style={styles.fileName} numberOfLines={1}>{pdf.name}</Text>
                      <Text style={styles.fileSize}>{fileSize(pdf.size)}</Text>
                    </View>
                    <Text style={styles.fileDone}>✓</Text>
                  </View>
                )}
                <View style={styles.sizeRow}>
                  <Text style={styles.sizeLabel}>Target size</Text>
                  <View style={styles.sizeInputWrap}>
                    <TextInput
                      value={target}
                      onChangeText={setTarget}
                      keyboardType="decimal-pad"
                      maxLength={7}
                      selectTextOnFocus
                      style={styles.sizeInput}
                      accessibilityLabel="Target size in megabytes"
                    />
                    <Text style={styles.sizeUnit}>MB</Text>
                  </View>
                </View>
                <View style={styles.presets}>
                  {['5', '10', '25', '50'].map(value => (
                    <Pressable
                      key={value}
                      onPress={() => setTarget(value)}
                      style={[styles.preset, target === value && styles.presetActive]}>
                      <Text style={[styles.presetText, target === value && styles.presetTextActive]}>
                        {value}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Button title="Compress PDF" onPress={compress} disabled={!pdf} />
              </View>
            )
          ) : (
            <View style={styles.panel}>
              <View style={styles.doneMark}>
                <Text style={styles.doneText}>✓</Text>
              </View>
              <Text style={styles.panelTitle}>PDF ready</Text>
              <Text style={styles.resultMeta}>
                {result.pages} {result.pages === 1 ? 'page' : 'pages'} · {fileSize(result.bytes)}
              </Text>
              {tab === 'compressor' && result.targetReached === false && (
                <Text style={styles.warning}>Target size could not be reached.</Text>
              )}
              <View style={styles.renameWrap}>
                <TextInput
                  value={rename}
                  onChangeText={setRename}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="File name"
                  placeholderTextColor={C.muted}
                  style={styles.renameInput}
                />
                <Text style={styles.renameExt}>.pdf</Text>
              </View>
              <Button title="Save PDF" onPress={() => save(false)} disabled={!rename.trim()} />
              <Button title="Save original name" secondary onPress={() => save(true)} />
              <Pressable style={styles.back} onPress={() => setResult(null)}>
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {busy && (
          <View style={styles.loading}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={styles.loadingText}>{busyText}</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: C.background},
  root: {flex: 1, backgroundColor: C.background},
  header: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: {color: C.white, fontSize: 20, fontWeight: '900'},
  brand: {fontSize: 19, color: C.ink, fontWeight: '800', letterSpacing: -0.4},
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 6,
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#EDEFF5',
  },
  tab: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    paddingHorizontal: 5,
  },
  activeTab: {backgroundColor: C.white, elevation: 1},
  tabText: {fontSize: 11, color: C.muted, fontWeight: '700'},
  activeTabText: {color: C.primary},
  content: {flex: 1},
  contentInner: {flexGrow: 1, padding: 18, justifyContent: 'center'},
  panel: {
    width: '100%',
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: C.line,
  },
  panelIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: C.pale,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  panelIconText: {fontSize: 26, color: C.primary, fontWeight: '700'},
  pdfIconText: {fontSize: 13, color: C.primary, fontWeight: '900'},
  panelTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.ink,
    textAlign: 'center',
    marginBottom: 18,
  },
  button: {
    height: 49,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 9,
    paddingHorizontal: 14,
  },
  primaryButton: {backgroundColor: C.primary},
  secondaryButton: {backgroundColor: C.pale},
  disabled: {opacity: 0.4},
  buttonText: {fontSize: 13, fontWeight: '800', color: C.white},
  secondaryText: {color: C.primary},
  selection: {
    marginTop: 15,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  selectionText: {fontSize: 12, color: C.muted, textAlign: 'center'},
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    marginTop: 12,
    backgroundColor: '#F7F8FC',
    borderRadius: 12,
  },
  fileCopy: {flex: 1},
  fileName: {fontSize: 12, color: C.ink, fontWeight: '700'},
  fileSize: {fontSize: 10, color: C.muted, marginTop: 4},
  fileDone: {fontSize: 18, color: C.green, fontWeight: '800'},
  sizeRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sizeLabel: {fontSize: 12, color: C.ink, fontWeight: '700'},
  sizeInputWrap: {
    width: 108,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 11,
    paddingHorizontal: 10,
    backgroundColor: '#FAFAFD',
  },
  sizeInput: {flex: 1, color: C.ink, fontSize: 15, fontWeight: '800', padding: 0},
  sizeUnit: {fontSize: 11, color: C.muted, fontWeight: '800'},
  presets: {flexDirection: 'row', gap: 8, marginTop: 10},
  preset: {
    flex: 1,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#F3F4F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetActive: {backgroundColor: C.pale},
  presetText: {fontSize: 11, color: C.muted, fontWeight: '700'},
  presetTextActive: {color: C.primary},
  doneMark: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6F6EF',
    marginBottom: 12,
  },
  doneText: {fontSize: 27, color: C.green, fontWeight: '900'},
  resultMeta: {fontSize: 11, color: C.muted, textAlign: 'center', marginTop: -10, marginBottom: 12},
  warning: {fontSize: 11, color: '#A66A15', textAlign: 'center', marginBottom: 8},
  renameWrap: {
    height: 47,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  renameInput: {flex: 1, fontSize: 13, color: C.ink, padding: 0},
  renameExt: {fontSize: 12, color: C.muted, fontWeight: '700'},
  back: {alignSelf: 'center', padding: 13, marginTop: 4},
  backText: {fontSize: 11, color: C.muted, fontWeight: '700'},
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#11142655',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  loadingCard: {
    backgroundColor: C.white,
    borderRadius: 17,
    paddingVertical: 22,
    paddingHorizontal: 28,
    alignItems: 'center',
    minWidth: 170,
  },
  loadingText: {fontSize: 12, color: C.ink, fontWeight: '700', marginTop: 12},
});
