import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, type SupabaseStudent, type SupabaseExam, type SupabaseAnnouncement, type SupabaseMessage } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { HomeworkItem, AttendanceRecord, AppMessage } from '@/data/mockData';

const PROGRESS_KEY = '@mbk_learning_progress';
const GAMIFICATION_KEY = '@mbk_gamification';

interface GamificationState {
  currentStreak: number;
  longestStreak: number;
  lastLessonDate: string | null;
  level: number;
  totalXPEarned: number;
  dailyRewardClaimed: boolean;
  dailyRewardDate: string | null;
}

interface ActivityResult {
  activityId: string;
  type: string;
  correct: boolean;
  timeSpentMs: number;
}

interface LessonProgress {
  lessonId: string;
  completed: boolean;
  xpEarned: number;
  correctCount: number;
  totalActivities: number;
  completedAt?: string;
  activityResults?: ActivityResult[];
}

export function computeMastery(lessonProgress: Record<string, LessonProgress>): Record<string, { correct: number; total: number; pct: number }> {
  const mastery: Record<string, { correct: number; total: number; pct: number }> = {};
  for (const lp of Object.values(lessonProgress)) {
    if (!lp.activityResults) continue;
    for (const ar of lp.activityResults) {
      if (!mastery[ar.type]) mastery[ar.type] = { correct: 0, total: 0, pct: 0 };
      mastery[ar.type].total++;
      if (ar.correct) mastery[ar.type].correct++;
    }
  }
  for (const key of Object.keys(mastery)) {
    mastery[key].pct = Math.round((mastery[key].correct / mastery[key].total) * 100);
  }
  return mastery;
}

export interface ExamComponent {
  name: string;
  score: number;
  total: number;
  weight: number;
}

export interface ComputedResult {
  id: string;
  studentId: string;
  subject: string;
  score: number;
  total: number;
  examType: string;
  month: string;
  date: string;
  components: ExamComponent[];
}

interface AppContextType {
  loading: boolean;
  students: StudentData[];
  homework: HomeworkItem[];
  attendance: AttendanceRecord[];
  results: ComputedResult[];
  announcements: AnnouncementData[];
  messages: AppMessage[];
  unreadCount: number;
  markRead: (id: string) => void;
  sendMessage: (msg: Omit<AppMessage, 'id' | 'createdAt' | 'isRead'>) => void;
  lessonProgress: Record<string, LessonProgress>;
  saveLessonProgress: (p: LessonProgress) => void;
  getTotalXP: (studentId?: string) => number;
  gamification: GamificationState;
}

interface StudentData {
  id: string;
  name: string;
  className: string;
  grade: string;
  avatarColor: string;
}

interface AnnouncementData {
  id: string;
  title: string;
  body: string;
  date: string;
  category: 'general' | 'event' | 'urgent' | 'academic';
  className?: string;
}

const AVATAR_COLORS = ['#3D5AFE', '#00BCD4', '#2ECC71', '#F59E0B', '#EC4899', '#8B5CF6'];
function getAvatarColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

function parseClassName(className: string): { className: string; grade: string } {
  const match = className.match(/Grade\s+(\d+[A-Z]?)/i) || className.match(/(\d+[A-Z]?)/);
  return {
    className,
    grade: match ? `Grade ${match[1]}` : className,
  };
}

function getPct(score: number, total: number): number {
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

function computeMonthlyResults(
  exams: SupabaseExam[],
  attendanceMap: Map<string, Map<string, { present: number; total: number }>>,
): ComputedResult[] {
  const results: ComputedResult[] = [];
  const groups = new Map<string, SupabaseExam[]>();

  for (const e of exams) {
    if (['CA', 'Homework', 'Classwork', 'Quiz'].includes(e.examType)) {
      const key = `${e.studentId}||${e.subject}||${e.month}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }
  }

  for (const [key, group] of groups) {
    const [studentId, subject, month] = key.split('||');
    const caExams = group.filter(e => e.examType !== 'Quiz');
    const quizExams = group.filter(e => e.examType === 'Quiz');
    if (caExams.length === 0 || quizExams.length === 0) continue;

    const caScore = caExams.reduce((s, e) => s + e.score, 0);
    const caTotal = caExams.reduce((s, e) => s + e.total, 0);

    const monthlyAtt = attendanceMap.get(studentId);
    const attPct = monthlyAtt && monthlyAtt.size > 0
      ? [...monthlyAtt.values()].reduce((s, v) => s + v.present, 0) / Math.max([...monthlyAtt.values()].reduce((s, v) => s + v.total, 0), 1)
      : 1;
    const attScore = Math.round(attPct * 20);
    const totalScore = caScore + attScore;
    const totalTotal = caTotal + 20;

    const quizScore = quizExams.reduce((s, e) => s + e.score, 0);
    const quizTotal = quizExams.reduce((s, e) => s + e.total, 0);

    const caPct = getPct(totalScore, totalTotal);
    const quizPct = getPct(quizScore, quizTotal);
    const finalPct = Math.round(caPct * 0.4 + quizPct * 0.6);

    results.push({
      id: `monthly-${studentId}-${subject}-${month}`,
      studentId, subject,
      score: finalPct, total: 100,
      examType: 'monthly',
      month, date: group[0].date,
      components: [
        { name: 'CA (Homework + Classwork + Attendance)', score: caPct, total: 100, weight: 40 },
        { name: 'Quiz', score: quizPct, total: 100, weight: 60 },
      ],
    });
  }
  return results;
}

function computeTermResults(
  exams: SupabaseExam[],
  examTypeFilter: 'Midterm' | 'Final',
  outputType: string,
): ComputedResult[] {
  const results: ComputedResult[] = [];
  const groups = new Map<string, SupabaseExam[]>();

  const componentTypes = ['CA', 'Homework', 'Classwork', 'Quiz'];

  for (const e of exams) {
    if (e.examType === examTypeFilter || componentTypes.includes(e.examType)) {
      const key = `${e.studentId}||${e.subject}||${e.termId || 'default'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }
  }

  for (const [key, group] of groups) {
    const [studentId, subject] = key.split('||');
    const targetExams = group.filter(e => e.examType === examTypeFilter);
    const compExams = group.filter(e => componentTypes.includes(e.examType));
    if (targetExams.length === 0 || compExams.length === 0) continue;

    const compScore = compExams.reduce((s, e) => s + e.score, 0);
    const compTotal = compExams.reduce((s, e) => s + e.total, 0);
    const compPct = getPct(compScore, compTotal);

    const examScore = targetExams.reduce((s, e) => s + e.score, 0);
    const examTotal = targetExams.reduce((s, e) => s + e.total, 0);
    const examPct = getPct(examScore, examTotal);

    const finalPct = Math.round(compPct * 0.4 + examPct * 0.6);

    results.push({
      id: `${outputType}-${studentId}-${subject}`,
      studentId, subject,
      score: finalPct, total: 100,
      examType: outputType,
      month: '', date: targetExams[0].date,
      components: [
        { name: 'CA (Homework + Classwork + Quiz)', score: compPct, total: 100, weight: 40 },
        { name: `${examTypeFilter} Exam`, score: examPct, total: 100, weight: 60 },
      ],
    });
  }
  return results;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [rawExams, setRawExams] = useState<SupabaseExam[]>([]);
  const [rawAttendance, setRawAttendance] = useState<AttendanceRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [homework] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lessonProgress, setLessonProgress] = useState<Record<string, LessonProgress>>({});
  const [gamification, setGamification] = useState<GamificationState>({
    currentStreak: 0, longestStreak: 0, lastLessonDate: null,
    level: 1, totalXPEarned: 0, dailyRewardClaimed: false, dailyRewardDate: null,
  });

  const attendanceMap = useMemo(() => {
    const map = new Map<string, Map<string, { present: number; total: number }>>();
    for (const r of rawAttendance) {
      if (!map.has(r.studentId)) map.set(r.studentId, new Map());
      const sm = map.get(r.studentId)!;
      const month = r.date.substring(0, 7);
      if (!sm.has(month)) sm.set(month, { present: 0, total: 0 });
      const m = sm.get(month)!;
      m.total++;
      if (r.status === 'present') m.present++;
    }
    return map;
  }, [rawAttendance]);

  const results = useMemo(() => {
    const monthly = computeMonthlyResults(rawExams, attendanceMap);
    const midterm = computeTermResults(rawExams, 'Midterm', 'midterm');
    const final = computeTermResults(rawExams, 'Final', 'final');
    return [...monthly, ...midterm, ...final];
  }, [rawExams, attendanceMap]);

  useEffect(() => {
    (async () => {
      const [progVal, gamVal] = await Promise.all([
        AsyncStorage.getItem(PROGRESS_KEY),
        AsyncStorage.getItem(GAMIFICATION_KEY),
      ]);
      if (progVal) setLessonProgress(JSON.parse(progVal));
      if (gamVal) setGamification(prev => ({ ...prev, ...JSON.parse(gamVal) }));
    })();
  }, []);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    (async () => {
      const { data: studentData, error: studentErr } = await supabase.from('students').select('*').eq('parentId', user.id);
      if (studentErr || !studentData) { setLoading(false); return; }
      const mapped = (studentData as SupabaseStudent[]).map((s, i) => ({
        id: s.id,
        name: s.name,
        className: s.className,
        grade: parseClassName(s.className).grade,
        avatarColor: getAvatarColor(i),
      }));
      setStudents(mapped);

      const studentIds = mapped.map(s => s.id);
      if (studentIds.length > 0) {
        const [examResult, attResult, inboxResult, sentResult, annResult] = await Promise.all([
          supabase.from('exams').select('*').in('studentId', studentIds),
          supabase.from('attendance').select('*').in('studentId', studentIds),
          supabase.from('messages').select('*').eq('recipientId', user.id),
          supabase.from('messages').select('*').eq('senderId', user.id),
          supabase.from('announcements').select('*'),
        ]);

        if (examResult.data) {
          setRawExams(examResult.data as SupabaseExam[]);
        }
        if (attResult.data) {
          setRawAttendance((attResult.data as any[]).map(a => ({
            id: a.id,
            studentId: a.studentId,
            date: a.date,
            status: a.status as 'present' | 'absent' | 'late',
            note: a.note || '',
          })));
        }

        const allMessages: AppMessage[] = [];
        if (inboxResult.data) {
          allMessages.push(...(inboxResult.data as SupabaseMessage[]).map(m => ({
            id: m.id, senderId: m.senderId, senderName: m.senderId,
            recipientId: m.recipientId, recipientName: 'You',
            subject: m.subject, body: m.body,
            isRead: m.readAt !== null, createdAt: m.createdAt, isInbox: true,
          })));
        }
        if (sentResult.data) {
          allMessages.push(...(sentResult.data as SupabaseMessage[]).map(m => ({
            id: m.id, senderId: m.senderId, senderName: 'You',
            recipientId: m.recipientId, recipientName: m.recipientId,
            subject: m.subject, body: m.body,
            isRead: true, createdAt: m.createdAt, isInbox: false,
          })));
        }
        setMessages(allMessages);

        if (annResult.data) {
          setAnnouncements((annResult.data as SupabaseAnnouncement[]).map(a => ({
            id: a.id, title: a.className ? `${a.className} Announcement` : 'Announcement',
            body: a.message, date: a.createdAt, category: 'general' as const, className: a.className,
          })));
        }
      }
      setLoading(false);
    })();
  }, [user]);

  const unreadCount = messages.filter(m => m.isInbox && !m.isRead).length;

  const markRead = async (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m));
    await supabase.from('messages').update({ readAt: new Date().toISOString() }).eq('id', id);
  };

  const sendMessage = async (msg: Omit<AppMessage, 'id' | 'createdAt' | 'isRead'>) => {
    const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const newMsg: AppMessage = {
      ...msg,
      id: newId,
      createdAt: new Date().toISOString(),
      isRead: true,
    };
    setMessages(prev => [newMsg, ...prev]);

    await supabase.from('messages').insert({
      id: newId,
      senderId: msg.senderId,
      recipientId: msg.recipientId,
      subject: msg.subject,
      body: msg.body,
      readAt: null,
      createdAt: new Date().toISOString(),
    });
  };

  const saveLessonProgress = async (p: LessonProgress) => {
    const updated = { ...lessonProgress, [p.lessonId]: p };
    setLessonProgress(updated);
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(updated));

    const today = new Date().toISOString().split('T')[0];
    const newGam = { ...gamification };
    newGam.totalXPEarned += p.xpEarned;

    if (gamification.lastLessonDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().split('T')[0];
      if (gamification.lastLessonDate === yStr) {
        newGam.currentStreak += 1;
      } else {
        newGam.currentStreak = 1;
      }
      newGam.longestStreak = Math.max(newGam.longestStreak, newGam.currentStreak);
      newGam.lastLessonDate = today;
      newGam.dailyRewardClaimed = false;
    }

    if (!newGam.dailyRewardClaimed) {
      newGam.dailyRewardClaimed = true;
      newGam.dailyRewardDate = today;
      newGam.totalXPEarned += 10;
    }

    newGam.level = Math.floor(newGam.totalXPEarned / 200) + 1;
    setGamification(newGam);
    await AsyncStorage.setItem(GAMIFICATION_KEY, JSON.stringify(newGam));
  };

  const getTotalXP = () => {
    return Object.values(lessonProgress)
      .filter(p => p.completed)
      .reduce((sum, p) => sum + p.xpEarned, 0);
  };

  return (
    <AppContext.Provider value={{
      loading, students, homework, attendance: rawAttendance, results, announcements,
      messages, unreadCount, markRead, sendMessage,
      lessonProgress, saveLessonProgress, getTotalXP, gamification,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
