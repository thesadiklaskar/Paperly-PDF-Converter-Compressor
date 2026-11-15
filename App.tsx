import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
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
  CalendarClock,
  CalendarDays,
  Calculator,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  CloudDownload,
  FileText,
  FileUp,
  GraduationCap,
  ImagePlus,
  Info,
  ListChecks,
  Minimize2,
  NotebookPen,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ScanLine,
  Settings,
  StickyNote,
  Timer,
  Trash2,
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
  getStudentData?(): Promise<string | null>;
  saveStudentData?(json: string): Promise<boolean>;
};
type Task = {id: string; title: string; priority: 'Low' | 'Medium' | 'High'; done: boolean};
type Plan = {id: string; day: string; subject: string; time: string};
type Note = {id: string; title: string; body: string; updatedAt: number};
type StudentData = {
  tasks: Task[];
  plans: Plan[];
  notes: Note[];
  examName: string;
  examDate: string;
  focusSessions: number;
};
type DialogState = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};
type TabKey = 'pdf' | 'study' | 'tasks' | 'notes' | 'settings';
type StudyTool = 'overview' | 'calculator' | 'focus' | 'exam' | 'planner';

const PdfTools = NativeModules.PdfTools as NativeApi;
const APP_VERSION = '1.0.6';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EMPTY_DATA: StudentData = {
  tasks: [],
  plans: [],
  notes: [],
  examName: '',
  examDate: '',
  focusSessions: 0,
};

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

function safeStudentData(raw: string | null): StudentData {
  if (!raw) return {...EMPTY_DATA};
  try {
    const parsed = JSON.parse(raw);
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks.filter((item: any) => item && typeof item.id === 'string' && typeof item.title === 'string') : [],
      plans: Array.isArray(parsed.plans) ? parsed.plans.filter((item: any) => item && typeof item.id === 'string' && typeof item.subject === 'string') : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes.filter((item: any) => item && typeof item.id === 'string' && typeof item.body === 'string') : [],
      examName: typeof parsed.examName === 'string' ? parsed.examName : '',
      examDate: typeof parsed.examDate === 'string' ? parsed.examDate : '',
      focusSessions: Number.isFinite(parsed.focusSessions) ? Math.max(0, parsed.focusSessions) : 0,
    };
  } catch {
    return {...EMPTY_DATA};
  }
}

function calculate(expression: string): number {
  const source = expression.replace(/×/g, '*').replace(/÷/g, '/').replace(/\s/g, '');
  if (!source || source.length > 48 || !/^[0-9+\-*/%.()]+$/.test(source)) {
    throw new Error('Invalid expression');
  }
  const tokens = source.match(/\d*\.?\d+|[()+\-*/%]/g) || [];
  if (tokens.join('') !== source) throw new Error('Invalid expression');
  let index = 0;

  const parsePrimary = (): number => {
    const token = tokens[index];
    if (token === '+' || token === '-') {
      index += 1;
      const value = parsePrimary();
      return token === '-' ? -value : value;
    }
    if (token === '(') {
      index += 1;
      const value = parseExpression();
      if (tokens[index] !== ')') throw new Error('Invalid expression');
      index += 1;
      return value;
    }
    if (!token || !/^\d*\.?\d+$/.test(token)) throw new Error('Invalid expression');
    index += 1;
    let value = Number(token);
    if (tokens[index] === '%') {
      value /= 100;
      index += 1;
    }
    return value;
  };

  const parseTerm = (): number => {
    let value = parsePrimary();
    while (tokens[index] === '*' || tokens[index] === '/') {
      const operator = tokens[index++];
      const right = parsePrimary();
      if (operator === '/' && right === 0) throw new Error('Cannot divide by zero');
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  };

  const parseExpression = (): number => {
    let value = parseTerm();
    while (tokens[index] === '+' || tokens[index] === '-') {
      const operator = tokens[index++];
      const right = parseTerm();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  };

  const answer = parseExpression();
  if (index !== tokens.length || !Number.isFinite(answer)) throw new Error('Invalid expression');
  return answer;
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
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
    </Pressable>
  );
}

function Tile({
  icon,
  title,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.toolTile}>
      <View style={styles.tileIcon}>{icon}</View>
      <Text style={styles.tileTitle}>{title}</Text>
      <ChevronRight size={16} color={C.muted} />
    </Pressable>
  );
}

function BottomTab({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{selected: active}}
      onPress={onPress}
      style={styles.bottomItem}>
      <View style={[styles.bottomIcon, active && styles.bottomIconActive]}>{icon}</View>
      <Text style={[styles.bottomLabel, active && styles.bottomLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const [tab, setTab] = useState<TabKey>('pdf');
  const [studyTool, setStudyTool] = useState<StudyTool>('overview');
  const [pdfTab, setPdfTab] = useState<'converter' | 'compressor'>('converter');
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

  const [studentData, setStudentData] = useState<StudentData>({...EMPTY_DATA});
  const [storageReady, setStorageReady] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  const [calcExpression, setCalcExpression] = useState('0');
  const [calcResult, setCalcResult] = useState('');
  const [timerMode, setTimerMode] = useState<'focus' | 'break'>('focus');
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [plannerDay, setPlannerDay] = useState('Mon');
  const [plannerSubject, setPlannerSubject] = useState('');
  const [plannerTime, setPlannerTime] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [taskPriority, setTaskPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const openDialog = (title: string, message: string, actionLabel?: string, onAction?: () => void) => {
    setDialog({title, message, actionLabel, onAction});
  };

  const commitStudentData = (next: StudentData) => {
    setStudentData(next);
    if (PdfTools?.saveStudentData) {
      PdfTools.saveStudentData(JSON.stringify(next)).catch(() => {
        openDialog('Could not save', 'Please try again.');
      });
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const stored = PdfTools?.getStudentData ? await PdfTools.getStudentData() : null;
        if (mounted) {
          const restored = safeStudentData(stored);
          setStudentData(restored);
          setExamName(restored.examName);
          setExamDate(restored.examDate);
        }
      } catch {
        if (mounted) setStudentData({...EMPTY_DATA});
      } finally {
        if (mounted) setStorageReady(true);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      setAppActive(next === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!timerRunning || tab !== 'study' || studyTool !== 'focus' || !appActive) return;
    const interval = setInterval(() => {
      setTimerSeconds(current => {
        if (current <= 1) {
          setTimerRunning(false);
          if (timerMode === 'focus') {
            const next = {...studentData, focusSessions: studentData.focusSessions + 1};
            commitStudentData(next);
            setTimerMode('break');
            openDialog('Focus complete', 'Take a short break.');
            return 5 * 60;
          }
          setTimerMode('focus');
          openDialog('Break complete', 'Ready for another focus session?');
          return 25 * 60;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, tab, studyTool, appActive]);

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
    const file = await PdfTools.compressPdf(pdf.uri, size, 'Paperly_compressed.pdf');
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

  const changePdfTab = (next: 'converter' | 'compressor') => {
    if (busy) return;
    setPdfTab(next);
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
        openDialog('Update ready', 'The latest Paperly update has been downloaded.', 'Restart now', () => {
          Updates.reloadAsync().catch(() => {
            setUpdateState('Restart required');
            openDialog('Restart Paperly', 'Close and reopen the app to apply the downloaded update.');
          });
        });
      } else {
        setUpdateState('Up to date');
        openDialog('You are up to date', 'There is no new update to install.');
      }
    } catch (error: any) {
      setUpdateState('Could not check');
      openDialog('Update unavailable', String(error?.message || 'Could not check for updates. Check your internet connection and try again.'));
    } finally {
      setUpdateBusy(false);
    }
  };

  const formatClock = (seconds: number) => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const remainder = (seconds % 60).toString().padStart(2, '0');
    return minutes + ':' + remainder;
  };

  const addPlan = () => {
    const subject = plannerSubject.trim();
    const time = plannerTime.trim();
    if (!subject || !time) {
      openDialog('Add a study session', 'Enter a subject and time.');
      return;
    }
    const next = {
      ...studentData,
      plans: [...studentData.plans, {id: Date.now().toString(), day: plannerDay, subject, time}],
    };
    commitStudentData(next);
    setPlannerSubject('');
    setPlannerTime('');
  };

  const removePlan = (id: string) => {
    commitStudentData({...studentData, plans: studentData.plans.filter(item => item.id !== id)});
  };

  const addTask = () => {
    const title = taskInput.trim();
    if (!title) return;
    commitStudentData({
      ...studentData,
      tasks: [{id: Date.now().toString(), title, priority: taskPriority, done: false}, ...studentData.tasks],
    });
    setTaskInput('');
  };

  const toggleTask = (id: string) => {
    commitStudentData({
      ...studentData,
      tasks: studentData.tasks.map(item => item.id === id ? {...item, done: !item.done} : item),
    });
  };

  const removeTask = (id: string) => {
    commitStudentData({...studentData, tasks: studentData.tasks.filter(item => item.id !== id)});
  };

  const saveNote = () => {
    if (!noteTitle.trim() && !noteBody.trim()) return;
    let nextNotes: Note[];
    if (editingNoteId) {
      nextNotes = studentData.notes.map(item =>
        item.id === editingNoteId
          ? {...item, title: noteTitle.trim() || 'Untitled', body: noteBody, updatedAt: Date.now()}
          : item,
      );
    } else {
      nextNotes = [{id: Date.now().toString(), title: noteTitle.trim() || 'Untitled', body: noteBody, updatedAt: Date.now()}, ...studentData.notes];
    }
    commitStudentData({...studentData, notes: nextNotes});
    setNoteTitle('');
    setNoteBody('');
    setEditingNoteId(null);
  };

  const editNote = (note: Note) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteBody(note.body);
  };

  const removeNote = (id: string) => {
    commitStudentData({...studentData, notes: studentData.notes.filter(item => item.id !== id)});
    if (editingNoteId === id) {
      setEditingNoteId(null);
      setNoteTitle('');
      setNoteBody('');
    }
  };

  const saveExam = () => {
    const name = examName.trim();
    const date = examDate.trim();
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date + 'T00:00:00').getTime())) {
      openDialog('Check exam details', 'Use an exam name and date in YYYY-MM-DD format.');
      return;
    }
    const parsedDate = new Date(date + 'T00:00:00');
    if (parsedDate.getFullYear() !== Number(date.slice(0, 4)) ||
        parsedDate.getMonth() + 1 !== Number(date.slice(5, 7)) ||
        parsedDate.getDate() !== Number(date.slice(8, 10))) {
      openDialog('Check exam date', 'Enter a valid calendar date.');
      return;
    }
    commitStudentData({...studentData, examName: name, examDate: date});
    openDialog('Exam saved', 'Your countdown has been updated.');
  };

  const examDaysLeft = useMemo(() => {
    if (!studentData.examDate) return null;
    const exam = new Date(studentData.examDate + 'T00:00:00');
    if (Number.isNaN(exam.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((exam.getTime() - today.getTime()) / 86400000);
    return diff;
  }, [studentData.examDate]);

  const calculatorPress = (value: string) => {
    if (value === 'AC') {
      setCalcExpression('0');
      setCalcResult('');
      return;
    }
    if (value === '⌫') {
      setCalcExpression(current => current.length <= 1 ? '0' : current.slice(0, -1));
      setCalcResult('');
      return;
    }
    if (value === '=') {
      try {
        const answer = calculate(calcExpression);
        setCalcResult(Number(answer.toFixed(8)).toString());
      } catch {
        setCalcResult('Error');
      }
      return;
    }
    setCalcExpression(current => {
      if (current === '0' && /[0-9.]/.test(value)) return value;
      if (current.length >= 48) return current;
      return current + value;
    });
    setCalcResult('');
  };

  const updateEnabled = Updates.isEnabled;
  const tabTitle = tab === 'pdf' ? 'PDF Tools' : tab === 'study' ? (studyTool === 'overview' ? 'Study Tools' : studyTool === 'calculator' ? 'Calculator' : studyTool === 'focus' ? 'Focus Timer' : studyTool === 'exam' ? 'Exam Countdown' : 'Study Planner') : tab === 'tasks' ? 'To-do List' : tab === 'notes' ? 'Quick Notes' : 'Settings';

  const tabBar = (
    <View style={styles.bottomNav}>
      <BottomTab label="PDF" icon={<FileText size={20} color={tab === 'pdf' ? C.primary : C.muted} />} active={tab === 'pdf'} onPress={() => {setTab('pdf'); setStudyTool('overview');}} />
      <BottomTab label="Study" icon={<GraduationCap size={20} color={tab === 'study' ? C.primary : C.muted} />} active={tab === 'study'} onPress={() => {setTab('study'); setStudyTool('overview');}} />
      <BottomTab label="Tasks" icon={<ListChecks size={20} color={tab === 'tasks' ? C.primary : C.muted} />} active={tab === 'tasks'} onPress={() => setTab('tasks')} />
      <BottomTab label="Notes" icon={<StickyNote size={20} color={tab === 'notes' ? C.primary : C.muted} />} active={tab === 'notes'} onPress={() => setTab('notes')} />
      <BottomTab label="Settings" icon={<Settings size={20} color={tab === 'settings' ? C.primary : C.muted} />} active={tab === 'settings'} onPress={() => setTab('settings')} />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />
      <View style={styles.root}>
        <View style={styles.header}>
          {tab === 'study' && studyTool !== 'overview' ? (
            <Pressable accessibilityRole="button" onPress={() => setStudyTool('overview')} style={styles.headerIconButton}>
              <ArrowLeft size={20} color={C.ink} />
            </Pressable>
          ) : (
            <View style={styles.brandIcon}>
              <FileText size={18} color={C.white} strokeWidth={2.2} />
            </View>
          )}
          <Text style={styles.brand}>{tabTitle}</Text>
          {tab === 'pdf' && (
            <View style={styles.headerTag}>
              <Text style={styles.headerTagText}>PAPERLY</Text>
            </View>
          )}
        </View>

        <View style={styles.main}>
          {tab === 'pdf' && (
            <>
              <View style={styles.tabs}>
                <Pressable accessibilityRole="tab" accessibilityState={{selected: pdfTab === 'converter'}} onPress={() => changePdfTab('converter')} style={[styles.tab, pdfTab === 'converter' && styles.activeTab]}>
                  <FileText size={16} color={pdfTab === 'converter' ? C.primary : C.muted} />
                  <Text style={[styles.tabText, pdfTab === 'converter' && styles.activeTabText]}>Convert</Text>
                </Pressable>
                <Pressable accessibilityRole="tab" accessibilityState={{selected: pdfTab === 'compressor'}} onPress={() => changePdfTab('compressor')} style={[styles.tab, pdfTab === 'compressor' && styles.activeTab]}>
                  <Minimize2 size={16} color={pdfTab === 'compressor' ? C.primary : C.muted} />
                  <Text style={[styles.tabText, pdfTab === 'compressor' && styles.activeTabText]}>Compress</Text>
                </Pressable>
              </View>
              <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {!result ? (
                  pdfTab === 'converter' ? (
                    <View style={styles.panel}>
                      <View style={styles.panelIcon}><ScanLine size={27} color={C.primary} /></View>
                      <Button title="Scan document" onPress={scan} icon={<ScanLine size={17} color={C.white} />} />
                      <Button title="Upload images" secondary onPress={chooseImages} icon={<ImagePlus size={17} color={C.primary} />} />
                      {images.length > 0 && (
                        <View style={styles.selection}>
                          <Text style={styles.selectionText}>{images.length} {images.length === 1 ? 'image' : 'images'} selected</Text>
                          <Button title="Create PDF" onPress={createPdf} icon={<FileText size={17} color={C.white} />} />
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.panel}>
                      <View style={styles.panelIcon}><FileUp size={27} color={C.primary} /></View>
                      <Button title={pdf ? 'Change PDF' : 'Upload PDF'} onPress={choosePdf} secondary={!pdf} icon={<FileUp size={17} color={pdf ? C.white : C.primary} />} />
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
                          <TextInput value={target} onChangeText={setTarget} keyboardType="decimal-pad" maxLength={7} selectTextOnFocus style={styles.sizeInput} accessibilityLabel="Target size in megabytes" />
                          <Text style={styles.sizeUnit}>MB</Text>
                        </View>
                      </View>
                      <View style={styles.presets}>
                        {['5', '10', '25', '50'].map(value => (
                          <Pressable key={value} onPress={() => setTarget(value)} style={[styles.preset, target === value && styles.presetActive]}>
                            <Text style={[styles.presetText, target === value && styles.presetTextActive]}>{value}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <Button title="Compress PDF" onPress={compress} disabled={!pdf} icon={<Minimize2 size={17} color={C.white} />} />
                    </View>
                  )
                ) : (
                  <View style={styles.panel}>
                    <View style={styles.doneMark}><Check size={26} color={C.green} strokeWidth={2.8} /></View>
                    <Text style={styles.panelTitle}>PDF ready</Text>
                    <Text style={styles.resultMeta}>{result.pages} {result.pages === 1 ? 'page' : 'pages'} · {fileSize(result.bytes)}</Text>
                    {pdfTab === 'compressor' && result.targetReached === false && <Text style={styles.warning}>Target size could not be reached.</Text>}
                    <View style={styles.renameWrap}>
                      <TextInput value={rename} onChangeText={setRename} autoCapitalize="none" autoCorrect={false} placeholder="File name" placeholderTextColor={C.muted} style={styles.renameInput} />
                      <Text style={styles.renameExt}>.pdf</Text>
                    </View>
                    <Button title="Save PDF" onPress={() => save(false)} disabled={!rename.trim()} icon={<CloudDownload size={17} color={C.white} />} />
                    <Button title="Save original name" secondary onPress={() => save(true)} icon={<FileText size={17} color={C.primary} />} />
                    <Pressable style={styles.back} onPress={() => setResult(null)}><Text style={styles.backText}>Back</Text></Pressable>
                  </View>
                )}
              </ScrollView>
            </>
          )}

          {tab === 'study' && (
            <ScrollView style={styles.content} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {studyTool === 'overview' && (
                <View style={styles.toolGrid}>
                  <Tile icon={<Calculator size={23} color={C.primary} />} title="Calculator" onPress={() => setStudyTool('calculator')} />
                  <Tile icon={<Timer size={23} color={C.primary} />} title="Focus Timer" onPress={() => setStudyTool('focus')} />
                  <Tile icon={<CalendarClock size={23} color={C.primary} />} title="Exam Countdown" onPress={() => {setExamName(studentData.examName); setExamDate(studentData.examDate); setStudyTool('exam');}} />
                  <Tile icon={<CalendarDays size={23} color={C.primary} />} title="Study Planner" onPress={() => setStudyTool('planner')} />
                </View>
              )}

              {studyTool === 'calculator' && (
                <View style={styles.panel}>
                  <View style={styles.calculatorDisplay}>
                    <Text numberOfLines={1} style={styles.calcExpression}>{calcExpression}</Text>
                    <Text numberOfLines={1} style={styles.calcResult}>{calcResult}</Text>
                  </View>
                  <View style={styles.calcGrid}>
                    {['AC', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '(', ')', '='].map((key, index) => (
                      <Pressable key={key + index} onPress={() => calculatorPress(key)} style={[styles.calcKey, ['÷', '×', '−', '+', '='].includes(key) && styles.calcKeyOperator, key === 'AC' && styles.calcKeyClear, key === '0' && styles.calcKeyZero]}>
                        <Text style={[styles.calcKeyText, ['÷', '×', '−', '+', '='].includes(key) && styles.calcKeyOperatorText, key === 'AC' && styles.calcKeyClearText]}>{key}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {studyTool === 'focus' && (
                <View style={styles.panel}>
                  <View style={styles.focusModeRow}>
                    <Pressable onPress={() => {setTimerRunning(false); setTimerMode('focus'); setTimerSeconds(25 * 60);}} style={[styles.modeChip, timerMode === 'focus' && styles.modeChipActive]}>
                      <Text style={[styles.modeChipText, timerMode === 'focus' && styles.modeChipTextActive]}>Focus</Text>
                    </Pressable>
                    <Pressable onPress={() => {setTimerRunning(false); setTimerMode('break'); setTimerSeconds(5 * 60);}} style={[styles.modeChip, timerMode === 'break' && styles.modeChipActive]}>
                      <Text style={[styles.modeChipText, timerMode === 'break' && styles.modeChipTextActive]}>Break</Text>
                    </Pressable>
                  </View>
                  <View style={styles.timerCircle}>
                    <Timer size={25} color={C.primary} />
                    <Text style={styles.timerText}>{formatClock(timerSeconds)}</Text>
                    <Text style={styles.timerCaption}>{timerMode === 'focus' ? 'FOCUS' : 'BREAK'}</Text>
                  </View>
                  <View style={styles.timerActions}>
                    <Pressable onPress={() => setTimerSeconds(timerMode === 'focus' ? 25 * 60 : 5 * 60)} style={styles.timerReset}>
                      <RotateCcw size={18} color={C.muted} />
                    </Pressable>
                    <Pressable onPress={() => setTimerRunning(value => !value)} style={styles.timerStart}>
                      {timerRunning ? <Pause size={21} color={C.white} /> : <Play size={21} color={C.white} />}
                      <Text style={styles.timerStartText}>{timerRunning ? 'Pause' : 'Start'}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.sessionCount}>
                    <CheckCircle2 size={17} color={C.green} />
                    <Text style={styles.sessionCountText}>{studentData.focusSessions} sessions completed</Text>
                  </View>
                </View>
              )}

              {studyTool === 'exam' && (
                <View style={styles.panel}>
                  <View style={styles.panelIcon}><CalendarClock size={26} color={C.primary} /></View>
                  {!!studentData.examDate && examDaysLeft !== null && (
                    <View style={styles.countdownCard}>
                      <Text style={styles.countdownName}>{studentData.examName || 'Exam'}</Text>
                      <Text style={styles.countdownNumber}>{examDaysLeft < 0 ? '0' : examDaysLeft.toString()}</Text>
                      <Text style={styles.countdownLabel}>{examDaysLeft < 0 ? 'DAYS AGO' : examDaysLeft === 1 ? 'DAY LEFT' : 'DAYS LEFT'}</Text>
                    </View>
                  )}
                  <TextInput value={examName} onChangeText={setExamName} placeholder="Exam name" placeholderTextColor={C.muted} style={styles.formInput} maxLength={48} />
                  <TextInput value={examDate} onChangeText={setExamDate} placeholder="YYYY-MM-DD" placeholderTextColor={C.muted} style={styles.formInput} keyboardType="numbers-and-punctuation" maxLength={10} />
                  <Button title="Save exam" onPress={saveExam} icon={<Save size={16} color={C.white} />} />
                </View>
              )}

              {studyTool === 'planner' && (
                <View style={styles.panel}>
                  <Text style={styles.sectionTitle}>Weekly timetable</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daySelector}>
                    {DAYS.map(day => (
                      <Pressable key={day} onPress={() => setPlannerDay(day)} style={[styles.dayChip, plannerDay === day && styles.dayChipActive]}>
                        <Text style={[styles.dayChipText, plannerDay === day && styles.dayChipTextActive]}>{day}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <View style={styles.formGroup}>
                    <TextInput value={plannerSubject} onChangeText={setPlannerSubject} placeholder="Subject" placeholderTextColor={C.muted} style={styles.formInput} maxLength={50} />
                    <TextInput value={plannerTime} onChangeText={setPlannerTime} placeholder="Time (e.g. 08:00 AM)" placeholderTextColor={C.muted} style={styles.formInput} maxLength={24} />
                    <Button title="Add session" onPress={addPlan} icon={<Plus size={17} color={C.white} />} />
                  </View>
                  <View style={styles.listDivider} />
                  {studentData.plans.filter(item => item.day === plannerDay).length === 0 ? (
                    <Text style={styles.emptyText}>No study sessions</Text>
                  ) : studentData.plans.filter(item => item.day === plannerDay).map(item => (
                    <View key={item.id} style={styles.dataRow}>
                      <View style={styles.rowIconSmall}><BookOpenIcon /></View>
                      <View style={styles.dataCopy}>
                        <Text style={styles.dataTitle}>{item.subject}</Text>
                        <Text style={styles.dataMeta}>{item.time}</Text>
                      </View>
                      <Pressable accessibilityRole="button" onPress={() => removePlan(item.id)} style={styles.deleteButton}>
                        <Trash2 size={17} color={C.muted} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}

          {tab === 'tasks' && (
            <ScrollView style={styles.content} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.panel}>
                <View style={styles.inputWithButton}>
                  <TextInput value={taskInput} onChangeText={setTaskInput} placeholder="Add a task" placeholderTextColor={C.muted} style={styles.inlineInput} maxLength={100} returnKeyType="done" onSubmitEditing={addTask} />
                  <Pressable accessibilityRole="button" onPress={addTask} style={styles.addIconButton}><Plus size={21} color={C.white} /></Pressable>
                </View>
                <View style={styles.priorityRow}>
                  {(['Low', 'Medium', 'High'] as const).map(priority => (
                    <Pressable key={priority} onPress={() => setTaskPriority(priority)} style={[styles.priorityChip, taskPriority === priority && styles.priorityChipActive]}>
                      <Text style={[styles.priorityText, taskPriority === priority && styles.priorityTextActive]}>{priority}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.taskStats}>
                  <Text style={styles.sectionTitle}>Tasks</Text>
                  <Text style={styles.taskCount}>{studentData.tasks.filter(item => !item.done).length} remaining</Text>
                </View>
                {studentData.tasks.length === 0 ? (
                  <Text style={styles.emptyText}>No tasks yet</Text>
                ) : (
                  studentData.tasks.map(item => (
                    <View key={item.id} style={styles.dataRow}>
                      <Pressable accessibilityRole="checkbox" accessibilityState={{checked: item.done}} onPress={() => toggleTask(item.id)} style={styles.checkButton}>
                        {item.done ? <CheckCircle2 size={21} color={C.green} /> : <Circle size={21} color={C.muted} />}
                      </Pressable>
                      <View style={styles.dataCopy}>
                        <Text style={[styles.dataTitle, item.done && styles.completedText]}>{item.title}</Text>
                        <Text style={styles.dataMeta}>{item.priority} priority</Text>
                      </View>
                      <Pressable accessibilityRole="button" onPress={() => removeTask(item.id)} style={styles.deleteButton}><Trash2 size={17} color={C.muted} /></Pressable>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}

          {tab === 'notes' && (
            <ScrollView style={styles.content} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.panel}>
                <TextInput value={noteTitle} onChangeText={setNoteTitle} placeholder="Title" placeholderTextColor={C.muted} style={styles.formInput} maxLength={60} />
                <TextInput value={noteBody} onChangeText={setNoteBody} placeholder="Write a note…" placeholderTextColor={C.muted} style={[styles.formInput, styles.noteInput]} multiline textAlignVertical="top" maxLength={5000} />
                <View style={styles.noteActions}>
                  {editingNoteId && <Pressable onPress={() => {setEditingNoteId(null); setNoteTitle(''); setNoteBody('');}} style={styles.cancelEdit}><Text style={styles.cancelEditText}>Cancel</Text></Pressable>}
                  <View style={styles.noteSaveWrap}><Button title={editingNoteId ? 'Update note' : 'Save note'} onPress={saveNote} icon={<Save size={16} color={C.white} />} /></View>
                </View>
                <View style={styles.listDivider} />
                <Text style={styles.sectionTitle}>Saved notes</Text>
                {studentData.notes.length === 0 ? (
                  <Text style={styles.emptyText}>No notes yet</Text>
                ) : (
                  studentData.notes.map(item => (
                    <View key={item.id} style={styles.noteCard}>
                      <Pressable onPress={() => editNote(item)} style={styles.noteCardBody}>
                        <Text style={styles.dataTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.notePreview} numberOfLines={3}>{item.body}</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" onPress={() => removeNote(item.id)} style={styles.deleteButton}><Trash2 size={17} color={C.muted} /></Pressable>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}

          {tab === 'settings' && (
            <ScrollView style={styles.content} contentContainerStyle={styles.settingsContent} showsVerticalScrollIndicator={false}>
              <View style={styles.settingsCard}>
                <Text style={styles.settingsSection}>APP</Text>
                <View style={styles.updateStatus}>
                  <View style={styles.rowIcon}><FileText size={18} color={C.primary} /></View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>Paperly</Text>
                    <Text style={styles.rowDetail}>Version {APP_VERSION}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.settingsCard}>
                <Text style={styles.settingsSection}>UPDATES</Text>
                <View style={styles.updateStatus}>
                  <View style={[styles.statusDot, updateEnabled ? styles.statusOn : styles.statusOff]} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{updateEnabled ? 'Automatic updates on' : 'Automatic updates not connected'}</Text>
                    <Text style={styles.rowDetail}>{updateEnabled ? 'Updates download when Paperly opens.' : 'Connect the Expo project once to enable OTA updates.'}</Text>
                  </View>
                </View>
                <View style={styles.settingsDivider} />
                <View style={styles.updateStatus}>
                  <View style={styles.rowIcon}><CloudDownload size={18} color={C.primary} /></View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>Update status</Text>
                    <Text style={styles.rowDetail}>{updateState}</Text>
                  </View>
                </View>
                <Button title={updateBusy ? 'Checking…' : 'Check for updates'} onPress={checkForUpdates} disabled={updateBusy} secondary icon={<RefreshCw size={16} color={C.primary} />} />
              </View>
              <View style={styles.settingsCard}>
                <Text style={styles.settingsSection}>ABOUT</Text>
                <View style={styles.updateStatus}>
                  <View style={styles.rowIcon}><Info size={18} color={C.primary} /></View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>About Paperly</Text>
                    <Text style={styles.rowDetail}>PDF tools and offline student utilities</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          )}
        </View>

        {tabBar}

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
              <Pressable onPress={() => setDialog(null)} style={styles.dialogClose} accessibilityLabel="Close"><X size={19} color={C.muted} /></Pressable>
              <View style={styles.dialogIcon}><Info size={23} color={C.primary} /></View>
              <Text style={styles.dialogTitle}>{dialog.title}</Text>
              <Text style={styles.dialogMessage}>{dialog.message}</Text>
              <Button title={dialog.actionLabel || 'OK'} onPress={() => {
                const action = dialog.onAction;
                setDialog(null);
                if (action) action();
              }} />
              {!!dialog.actionLabel && <Pressable onPress={() => setDialog(null)} style={styles.dialogCancel}><Text style={styles.dialogCancelText}>Later</Text></Pressable>}
            </View>
          </View>
        )}

        {(updateBusy || !storageReady) && (
          <View style={styles.updateShade}>
            <View style={styles.updateBusyCard}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={styles.loadingText}>{updateBusy ? 'Checking for updates…' : 'Loading…'}</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function BookOpenIcon() {
  return <GraduationCap size={17} color={C.primary} />;
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: C.background},
  root: {flex: 1, backgroundColor: C.background},
  header: {height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10},
  brandIcon: {width: 34, height: 34, borderRadius: 11, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center'},
  brand: {flex: 1, fontSize: 18, color: C.ink, fontWeight: '800', letterSpacing: -0.35},
  headerTag: {paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, backgroundColor: C.pale},
  headerTagText: {fontSize: 9, color: C.primary, fontWeight: '900', letterSpacing: 0.8},
  headerIconButton: {width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.line},
  main: {flex: 1},
  content: {flex: 1},
  contentInner: {flexGrow: 1, padding: 18, justifyContent: 'center'},
  screenContent: {flexGrow: 1, padding: 16, paddingBottom: 20},
  tabs: {flexDirection: 'row', marginHorizontal: 16, marginTop: 4, marginBottom: 4, padding: 4, borderRadius: 14, backgroundColor: '#EDEFF5'},
  tab: {flex: 1, flexDirection: 'row', gap: 7, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11, paddingHorizontal: 5},
  activeTab: {backgroundColor: C.white, elevation: 1},
  tabText: {fontSize: 11, color: C.muted, fontWeight: '700'},
  activeTabText: {color: C.primary},
  panel: {width: '100%', backgroundColor: C.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.line},
  panelIcon: {width: 54, height: 54, borderRadius: 17, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12},
  panelTitle: {fontSize: 17, fontWeight: '800', color: C.ink, textAlign: 'center', marginBottom: 18},
  button: {minHeight: 46, borderRadius: 13, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 9, paddingHorizontal: 14},
  primaryButton: {backgroundColor: C.primary},
  secondaryButton: {backgroundColor: C.pale},
  disabled: {opacity: 0.4},
  buttonText: {fontSize: 13, fontWeight: '800', color: C.white},
  secondaryText: {color: C.primary},
  bottomNav: {minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 4, paddingTop: 5, paddingBottom: 3},
  bottomItem: {flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56, gap: 2},
  bottomIcon: {width: 38, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center'},
  bottomIconActive: {backgroundColor: C.pale},
  bottomLabel: {fontSize: 9, fontWeight: '700', color: C.muted},
  bottomLabelActive: {color: C.primary},
  toolGrid: {gap: 11},
  toolTile: {minHeight: 78, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12},
  tileIcon: {width: 42, height: 42, borderRadius: 13, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center'},
  tileTitle: {flex: 1, fontSize: 14, fontWeight: '800', color: C.ink},
  calculatorDisplay: {minHeight: 116, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 14, borderRadius: 14, backgroundColor: '#F7F8FC', marginBottom: 12},
  calcExpression: {fontSize: 22, color: C.ink, fontWeight: '700'},
  calcResult: {fontSize: 15, color: C.primary, fontWeight: '800', marginTop: 7},
  calcGrid: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8},
  calcKey: {width: '22%', minHeight: 53, borderRadius: 13, backgroundColor: '#F4F5F9', alignItems: 'center', justifyContent: 'center'},
  calcKeyZero: {width: '22%'},
  calcKeyOperator: {backgroundColor: C.pale},
  calcKeyClear: {backgroundColor: '#FCEEEE'},
  calcKeyText: {fontSize: 18, color: C.ink, fontWeight: '700'},
  calcKeyOperatorText: {color: C.primary},
  calcKeyClearText: {color: C.red},
  focusModeRow: {flexDirection: 'row', justifyContent: 'center', gap: 8},
  modeChip: {paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20, backgroundColor: '#F2F3F8'},
  modeChipActive: {backgroundColor: C.pale},
  modeChipText: {fontSize: 12, fontWeight: '700', color: C.muted},
  modeChipTextActive: {color: C.primary},
  timerCircle: {width: 220, height: 220, borderRadius: 110, borderWidth: 9, borderColor: C.pale, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: 25},
  timerText: {fontSize: 42, color: C.ink, fontWeight: '800', marginTop: 9, fontVariant: ['tabular-nums']},
  timerCaption: {fontSize: 10, letterSpacing: 1.4, fontWeight: '900', color: C.muted, marginTop: 4},
  timerActions: {flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 15},
  timerReset: {width: 48, height: 48, borderRadius: 16, backgroundColor: '#F2F3F8', alignItems: 'center', justifyContent: 'center'},
  timerStart: {minWidth: 140, height: 48, borderRadius: 15, backgroundColor: C.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9},
  timerStartText: {fontSize: 13, color: C.white, fontWeight: '800'},
  sessionCount: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 22},
  sessionCountText: {fontSize: 11, color: C.muted, fontWeight: '700'},
  countdownCard: {backgroundColor: C.pale, borderRadius: 16, alignItems: 'center', padding: 18, marginBottom: 14},
  countdownName: {fontSize: 14, color: C.ink, fontWeight: '800'},
  countdownNumber: {fontSize: 48, color: C.primary, fontWeight: '900', marginTop: 4},
  countdownLabel: {fontSize: 9, color: C.muted, fontWeight: '900', letterSpacing: 1.4},
  formInput: {minHeight: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: C.line, borderRadius: 12, color: C.ink, backgroundColor: '#FAFAFD', fontSize: 13, marginTop: 9},
  formGroup: {marginTop: 9},
  sectionTitle: {fontSize: 14, color: C.ink, fontWeight: '800'},
  daySelector: {gap: 7, paddingVertical: 12},
  dayChip: {minWidth: 43, paddingHorizontal: 9, height: 35, borderRadius: 10, backgroundColor: '#F2F3F8', alignItems: 'center', justifyContent: 'center'},
  dayChipActive: {backgroundColor: C.pale},
  dayChipText: {fontSize: 11, color: C.muted, fontWeight: '800'},
  dayChipTextActive: {color: C.primary},
  listDivider: {height: 1, backgroundColor: C.line, marginVertical: 14},
  emptyText: {fontSize: 12, color: C.muted, textAlign: 'center', paddingVertical: 18},
  dataRow: {minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#F0F1F6', paddingVertical: 7},
  rowIconSmall: {width: 34, height: 34, borderRadius: 11, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center'},
  dataCopy: {flex: 1},
  dataTitle: {fontSize: 13, color: C.ink, fontWeight: '800'},
  dataMeta: {fontSize: 10, color: C.muted, marginTop: 4},
  deleteButton: {width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
  inputWithButton: {flexDirection: 'row', alignItems: 'center', gap: 8},
  inlineInput: {flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: '#FAFAFD', paddingHorizontal: 12, fontSize: 13, color: C.ink},
  addIconButton: {width: 46, height: 46, borderRadius: 13, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center'},
  priorityRow: {flexDirection: 'row', gap: 8, marginTop: 10},
  priorityChip: {paddingHorizontal: 13, height: 31, borderRadius: 10, justifyContent: 'center', backgroundColor: '#F2F3F8'},
  priorityChipActive: {backgroundColor: C.pale},
  priorityText: {fontSize: 10, color: C.muted, fontWeight: '700'},
  priorityTextActive: {color: C.primary},
  taskStats: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 5},
  taskCount: {fontSize: 10, color: C.muted, fontWeight: '700'},
  checkButton: {width: 32, height: 38, alignItems: 'center', justifyContent: 'center'},
  completedText: {color: C.muted, textDecorationLine: 'line-through'},
  noteInput: {height: 130, paddingTop: 12},
  noteActions: {flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10},
  noteSaveWrap: {minWidth: 140},
  cancelEdit: {padding: 10},
  cancelEditText: {fontSize: 12, color: C.muted, fontWeight: '700'},
  noteCard: {flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F1F6'},
  noteCardBody: {flex: 1, gap: 5, paddingVertical: 4},
  notePreview: {fontSize: 11, color: C.muted, lineHeight: 16},
  selection: {marginTop: 15, paddingTop: 13, borderTopWidth: 1, borderTopColor: C.line},
  selectionText: {fontSize: 12, color: C.muted, textAlign: 'center'},
  fileRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 12, marginTop: 12, backgroundColor: '#F7F8FC', borderRadius: 12},
  fileCopy: {flex: 1},
  fileName: {fontSize: 12, color: C.ink, fontWeight: '700'},
  fileSize: {fontSize: 10, color: C.muted, marginTop: 4},
  sizeRow: {marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  sizeLabel: {fontSize: 12, color: C.ink, fontWeight: '700'},
  sizeInputWrap: {width: 108, height: 42, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 11, paddingHorizontal: 10, backgroundColor: '#FAFAFD'},
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
  settingsContent: {padding: 16, gap: 13, paddingBottom: 20},
  settingsCard: {backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14},
  settingsSection: {fontSize: 10, color: C.muted, fontWeight: '900', letterSpacing: 1.1, marginBottom: 9},
  rowIcon: {width: 34, height: 34, borderRadius: 11, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center'},
  rowCopy: {flex: 1},
  rowTitle: {fontSize: 12, color: C.ink, fontWeight: '800'},
  rowDetail: {fontSize: 10, color: C.muted, marginTop: 3, lineHeight: 15},
  updateStatus: {flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 54},
  statusDot: {width: 9, height: 9, borderRadius: 5, marginHorizontal: 12},
  statusOn: {backgroundColor: C.green},
  statusOff: {backgroundColor: '#D59A32'},
  settingsDivider: {height: 1, backgroundColor: C.line, marginVertical: 7},
  loading: {...StyleSheet.absoluteFillObject, backgroundColor: '#11142655', justifyContent: 'center', alignItems: 'center', padding: 28, zIndex: 30},
  loadingCard: {backgroundColor: C.white, borderRadius: 17, paddingVertical: 22, paddingHorizontal: 28, alignItems: 'center', minWidth: 170},
  loadingText: {fontSize: 12, color: C.ink, fontWeight: '700', marginTop: 12},
  dialogOverlay: {...StyleSheet.absoluteFillObject, zIndex: 40, backgroundColor: '#10132488', justifyContent: 'center', alignItems: 'center', padding: 25},
  dialogCard: {width: '100%', maxWidth: 360, borderRadius: 20, padding: 20, backgroundColor: C.white, alignItems: 'stretch'},
  dialogClose: {position: 'absolute', top: 13, right: 13, zIndex: 2, width: 30, height: 30, alignItems: 'center', justifyContent: 'center'},
  dialogIcon: {width: 46, height: 46, borderRadius: 15, alignSelf: 'center', backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center', marginBottom: 13},
  dialogTitle: {fontSize: 17, color: C.ink, fontWeight: '800', textAlign: 'center'},
  dialogMessage: {fontSize: 12, lineHeight: 19, color: C.muted, textAlign: 'center', marginTop: 8, marginBottom: 10},
  dialogCancel: {alignSelf: 'center', padding: 12},
  dialogCancelText: {fontSize: 12, color: C.muted, fontWeight: '700'},
  updateShade: {...StyleSheet.absoluteFillObject, zIndex: 20, backgroundColor: '#10132444', justifyContent: 'center', alignItems: 'center'},
  updateBusyCard: {backgroundColor: C.white, borderRadius: 17, paddingVertical: 22, paddingHorizontal: 26, alignItems: 'center'},
});

