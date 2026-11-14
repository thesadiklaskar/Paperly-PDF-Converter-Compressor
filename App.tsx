import React, {useState} from 'react';
import {
  ActivityIndicator,
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
import * as Updates from 'expo-updates';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CloudDownload,
  FileText,
  FileUp,
  ImagePlus,
  Info,
  Minimize2,
  RefreshCw,
  ScanLine,
  Settings,
  X,
} from 'lucide-react-native';

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
type DialogState = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const PdfTools = NativeModules.PdfTools as NativeApi;
const APP_VERSION = '1.0.4';

const C = {
  background: '#F7F8FC',
  white: '#FFFFFF',
  ink: '#171A2C',
  muted: '#85899B',
  line: '#E8EAF1',
  primary: '#5356E8',
  pale: '#ECEEFF',
  green: '#18875B',
  greenPale: '#E8F7F0',
  red: '#C64747',
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
  icon,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  icon?: React.ReactNode;
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
      {icon}
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}

function RowButton({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  detail?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={styles.rowButton}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!detail && <Text style={styles.rowDetail}>{detail}</Text>}
      </View>
      {onPress && <ChevronRight size={17} color={C.muted} />}
    </Pressable>
  );
}

export default function App() {
  const [tab, setTab] = useState<'converter' | 'compressor'>('converter');
  const [screen, setScreen] = useState<'home' | 'settings'>('home');
  const [images, setImages] = useState<string[]>([]);
  const [pdf, setPdf] = useState<PickedPdf | null>(null);
  const [target, setTarget] = useState('10');
  const [result, setResult] = useState<NativeResult | null>(null);
  const [rename, setRename] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState('Please wait…');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateState, setUpdateState] = useState('Not checked');

  const openDialog = (title: string, message: string, actionLabel?: string, onAction?: () => void) => {
    setDialog({title, message, actionLabel, onAction});
  };

  const run = async (label: string, action: () => Promise<void>) => {
    if (!PdfTools) {
      openDialog('Paperly error', 'PDF tools are not available. Please reinstall the latest app.');
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
        openDialog('Could not complete', message);
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
      openDialog('Invalid size', 'Enter a target size greater than 0 MB.');
      return;
    }
    if (!pdf) {
      openDialog('Select a PDF', 'Choose a PDF first.');
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
    setResult(null);
    setImages([]);
    setPdf(null);
    openDialog('Saved', saved.name + ' saved to Downloads / Paperly.');
  });

  const changeTab = (next: 'converter' | 'compressor') => {
    if (busy) return;
    setTab(next);
    setImages([]);
    setPdf(null);
    setResult(null);
  };

  const checkForUpdates = async () => {
    if (updateBusy) return;
    if (!Updates.isEnabled) {
      openDialog(
        'Updates not connected',
        'Automatic updates are ready in the app, but the Expo project has not been connected yet. Add the EAS_PROJECT_ID repository variable and EXPO_TOKEN secret, then build and install this version again.',
      );
      return;
    }

    setUpdateBusy(true);
    setUpdateState('Checking…');
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) {
        setUpdateState('Up to date');
        openDialog('You are up to date', 'Paperly ' + APP_VERSION + ' is already using the latest available update.');
        return;
      }

      setUpdateState('Downloading…');
      const fetched = await Updates.fetchUpdateAsync();
      if (fetched.isNew) {
        setUpdateState('Ready to restart');
        openDialog(
          'Update ready',
          'The latest Paperly update has been downloaded.',
          'Restart now',
          () => {
            Updates.reloadAsync().catch(() => {
              setUpdateState('Restart required');
              openDialog('Restart Paperly', 'Close and reopen the app to apply the downloaded update.');
            });
          },
        );
      } else {
        setUpdateState('Up to date');
        openDialog('You are up to date', 'There is no new update to install.');
      }
    } catch (error: any) {
      setUpdateState('Could not check');
      openDialog(
        'Update unavailable',
        String(error?.message || 'Could not check for updates. Check your internet connection and try again.'),
      );
    } finally {
      setUpdateBusy(false);
    }
  };

  const closeDialog = () => setDialog(null);
  const confirmDialog = () => {
    const action = dialog?.onAction;
    setDialog(null);
    if (action) action();
  };

  const updateEnabled = Updates.isEnabled;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />
      <View style={styles.root}>
        <View style={styles.header}>
          {screen === 'settings' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setScreen('home')}
              style={styles.headerIconButton}>
              <ArrowLeft size={21} color={C.ink} />
            </Pressable>
          ) : (
            <View style={styles.brandIcon}>
              <FileText size={19} color={C.white} strokeWidth={2.2} />
            </View>
          )}
          <Text style={styles.brand}>{screen === 'settings' ? 'Settings' : 'Paperly'}</Text>
          {screen === 'home' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              onPress={() => setScreen('settings')}
              style={styles.headerIconButton}>
              <Settings size={20} color={C.ink} />
            </Pressable>
          )}
        </View>

        {screen === 'settings' ? (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.settingsContent}
            showsVerticalScrollIndicator={false}>
            <View style={styles.settingsCard}>
              <Text style={styles.settingsSection}>APP</Text>
              <RowButton
                icon={<FileText size={18} color={C.primary} />}
                title="Paperly"
                detail={'Version ' + APP_VERSION}
              />
            </View>

            <View style={styles.settingsCard}>
              <Text style={styles.settingsSection}>UPDATES</Text>
              <View style={styles.updateStatus}>
                <View style={[styles.statusDot, updateEnabled ? styles.statusOn : styles.statusOff]} />
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>
                    {updateEnabled ? 'Automatic updates on' : 'Automatic updates not connected'}
                  </Text>
                  <Text style={styles.rowDetail}>
                    {updateEnabled
                      ? 'Updates download when Paperly opens.'
                      : 'Connect the Expo project once to enable OTA updates.'}
                  </Text>
                </View>
              </View>
              <View style={styles.settingsDivider} />
              <RowButton
                icon={<CloudDownload size={18} color={C.primary} />}
                title="Check for updates"
                detail={updateState}
                onPress={checkForUpdates}
              />
              <Button
                title={updateBusy ? 'Checking…' : 'Check now'}
                onPress={checkForUpdates}
                disabled={updateBusy}
                secondary
                icon={<RefreshCw size={16} color={C.primary} />}
              />
            </View>

            <View style={styles.settingsCard}>
              <Text style={styles.settingsSection}>ABOUT</Text>
              <RowButton
                icon={<Info size={18} color={C.primary} />}
                title="About Paperly"
                detail="PDF Converter and PDF Compressor"
                onPress={() => openDialog('Paperly', 'Scan images, create PDFs and compress PDF files on your device.')}
              />
            </View>
          </ScrollView>
        ) : (
          <>
            <View style={styles.tabs}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{selected: tab === 'converter'}}
                onPress={() => changeTab('converter')}
                style={[styles.tab, tab === 'converter' && styles.activeTab]}>
                <FileText size={16} color={tab === 'converter' ? C.primary : C.muted} />
                <Text style={[styles.tabText, tab === 'converter' && styles.activeTabText]}>
                  PDF Converter
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{selected: tab === 'compressor'}}
                onPress={() => changeTab('compressor')}
                style={[styles.tab, tab === 'compressor' && styles.activeTab]}>
                <Minimize2 size={16} color={tab === 'compressor' ? C.primary : C.muted} />
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
                      <ScanLine size={27} color={C.primary} />
                    </View>
                    <Button
                      title="Scan document"
                      onPress={scan}
                      icon={<ScanLine size={17} color={C.white} />}
                    />
                    <Button
                      title="Upload images"
                      secondary
                      onPress={chooseImages}
                      icon={<ImagePlus size={17} color={C.primary} />}
                    />
                    {images.length > 0 && (
                      <View style={styles.selection}>
                        <Text style={styles.selectionText}>
                          {images.length} {images.length === 1 ? 'image' : 'images'} selected
                        </Text>
                        <Button title="Create PDF" onPress={createPdf} icon={<FileText size={17} color={C.white} />} />
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.panel}>
                    <View style={styles.panelIcon}>
                      <FileUp size={27} color={C.primary} />
                    </View>
                    <Button
                      title={pdf ? 'Change PDF' : 'Upload PDF'}
                      onPress={choosePdf}
                      secondary={!pdf}
                      icon={<FileUp size={17} color={pdf ? C.white : C.primary} />}
                    />
                    {pdf && (
                      <View style={styles.fileRow}>
                        <View style={styles.fileCopy}>
                          <Text style={styles.fileName} numberOfLines={1}>{pdf.name}</Text>
                          <Text style={styles.fileSize}>{fileSize(pdf.size)}</Text>
                        </View>
                        <Check size={18} color={C.green} />
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
                    <Button
                      title="Compress PDF"
                      onPress={compress}
                      disabled={!pdf}
                      icon={<Minimize2 size={17} color={C.white} />}
                    />
                  </View>
                )
              ) : (
                <View style={styles.panel}>
                  <View style={styles.doneMark}>
                    <Check size={26} color={C.green} strokeWidth={2.8} />
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
                  <Button title="Save PDF" onPress={() => save(false)} disabled={!rename.trim()} icon={<CloudDownload size={17} color={C.white} />} />
                  <Button title="Save original name" secondary onPress={() => save(true)} icon={<FileText size={17} color={C.primary} />} />
                  <Pressable style={styles.back} onPress={() => setResult(null)}>
                    <Text style={styles.backText}>Back</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </>
        )}

        {busy && (
          <View style={styles.loading}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={styles.loadingText}>{busyText}</Text>
            </View>
          </View>
        )}

        {dialog && (
          <View style={styles.dialogOverlay}>
            <View style={styles.dialogCard}>
              <Pressable onPress={closeDialog} style={styles.dialogClose} accessibilityLabel="Close">
                <X size={19} color={C.muted} />
              </Pressable>
              <View style={styles.dialogIcon}>
                <Info size={23} color={C.primary} />
              </View>
              <Text style={styles.dialogTitle}>{dialog.title}</Text>
              <Text style={styles.dialogMessage}>{dialog.message}</Text>
              <Button
                title={dialog.actionLabel || 'OK'}
                onPress={dialog.onAction ? confirmDialog : closeDialog}
              />
              {!!dialog.actionLabel && (
                <Pressable onPress={closeDialog} style={styles.dialogCancel}>
                  <Text style={styles.dialogCancelText}>Later</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {updateBusy && (
          <View style={styles.updateShade}>
            <View style={styles.updateBusyCard}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={styles.loadingText}>Checking for updates…</Text>
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
    paddingHorizontal: 18,
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
  brand: {flex: 1, fontSize: 19, color: C.ink, fontWeight: '800', letterSpacing: -0.4},
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
  },
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
    flexDirection: 'row',
    gap: 7,
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
  panelTitle: {fontSize: 17, fontWeight: '800', color: C.ink, textAlign: 'center', marginBottom: 18},
  button: {
    minHeight: 48,
    borderRadius: 13,
    flexDirection: 'row',
    gap: 8,
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
  selection: {marginTop: 15, paddingTop: 13, borderTopWidth: 1, borderTopColor: C.line},
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
  sizeRow: {marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
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
  preset: {flex: 1, height: 34, borderRadius: 9, backgroundColor: '#F3F4F8', alignItems: 'center', justifyContent: 'center'},
  presetActive: {backgroundColor: C.pale},
  presetText: {fontSize: 11, color: C.muted, fontWeight: '700'},
  presetTextActive: {color: C.primary},
  doneMark: {width: 50, height: 50, borderRadius: 25, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: C.greenPale, marginBottom: 12},
  resultMeta: {fontSize: 11, color: C.muted, textAlign: 'center', marginTop: -10, marginBottom: 12},
  warning: {fontSize: 11, color: '#A66A15', textAlign: 'center', marginBottom: 8},
  renameWrap: {height: 47, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, marginTop: 4},
  renameInput: {flex: 1, fontSize: 13, color: C.ink, padding: 0},
  renameExt: {fontSize: 12, color: C.muted, fontWeight: '700'},
  back: {alignSelf: 'center', padding: 13, marginTop: 4},
  backText: {fontSize: 11, color: C.muted, fontWeight: '700'},
  settingsContent: {padding: 16, gap: 13, paddingBottom: 28},
  settingsCard: {backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14},
  settingsSection: {fontSize: 10, color: C.muted, fontWeight: '900', letterSpacing: 1.1, marginBottom: 9},
  rowButton: {minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 11},
  rowIcon: {width: 34, height: 34, borderRadius: 11, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center'},
  rowCopy: {flex: 1},
  rowTitle: {fontSize: 12, color: C.ink, fontWeight: '800'},
  rowDetail: {fontSize: 10, color: C.muted, marginTop: 3, lineHeight: 15},
  updateStatus: {flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 54},
  statusDot: {width: 9, height: 9, borderRadius: 5, marginHorizontal: 12},
  statusOn: {backgroundColor: C.green},
  statusOff: {backgroundColor: '#D59A32'},
  settingsDivider: {height: 1, backgroundColor: C.line, marginVertical: 7},
  loading: {...StyleSheet.absoluteFillObject, backgroundColor: '#11142655', justifyContent: 'center', alignItems: 'center', padding: 28},
  loadingCard: {backgroundColor: C.white, borderRadius: 17, paddingVertical: 22, paddingHorizontal: 28, alignItems: 'center', minWidth: 170},
  loadingText: {fontSize: 12, color: C.ink, fontWeight: '700', marginTop: 12},
  dialogOverlay: {...StyleSheet.absoluteFillObject, zIndex: 20, backgroundColor: '#10132488', justifyContent: 'center', alignItems: 'center', padding: 25},
  dialogCard: {width: '100%', maxWidth: 360, borderRadius: 20, padding: 20, backgroundColor: C.white, alignItems: 'stretch'},
  dialogClose: {position: 'absolute', top: 13, right: 13, zIndex: 2, width: 30, height: 30, alignItems: 'center', justifyContent: 'center'},
  dialogIcon: {width: 46, height: 46, borderRadius: 15, alignSelf: 'center', backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center', marginBottom: 13},
  dialogTitle: {fontSize: 17, color: C.ink, fontWeight: '800', textAlign: 'center'},
  dialogMessage: {fontSize: 12, lineHeight: 19, color: C.muted, textAlign: 'center', marginTop: 8, marginBottom: 10},
  dialogCancel: {alignSelf: 'center', padding: 12},
  dialogCancelText: {fontSize: 12, color: C.muted, fontWeight: '700'},
  updateShade: {...StyleSheet.absoluteFillObject, zIndex: 15, backgroundColor: '#10132444', justifyContent: 'center', alignItems: 'center'},
  updateBusyCard: {backgroundColor: C.white, borderRadius: 17, paddingVertical: 22, paddingHorizontal: 26, alignItems: 'center'},
});
