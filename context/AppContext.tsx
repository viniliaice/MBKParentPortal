import React, { createContext, useCallback, useContext, useEffect, useState, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  supabase,
  type SupabaseStudent,
  type SupabaseExam,
  type SupabaseAnnouncement,
  type SupabaseAcademicYear,
  type SupabaseMessage,
  type SupabaseContact,
  type SupabaseLessonProgress,
  type SupabaseLessonAttempt,
  type SupabaseGamification,
} from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { HomeworkItem, AttendanceRecord, AppMessage } from '@/data/mockData';
import { computeMasteryLevel, nextSrsDueDate } from '@/lib/mastery';
import {
  computeMonthlyResults,
  computeTermResults,
  computePendingReports,
  type PendingReport,
  type ReportComponent as ExamComponent,
  type ReportResult as ComputedResult,
} from '@/lib/reportSelectors';

export type { ExamComponent, ComputedResult };

export type AttemptSummary = { accuracyPct: number; completedAt: string | null };

const PROGRESS_KEY = '@mbk_learning_progress';
const GAMIFICATION_KEY = '@mbk_gamification';
/** The child the parent last looked at, so the app reopens on the same one. */
const SELECTED_CHILD_KEY = '@mbk_selected_child';
/** When the parent last opened the announcements list — drives the "new" marker. */
const ANNOUNCEMENTS_SEEN_KEY = '@mbk_announcements_seen';

const DEFAULT_GAMIFICATION: GamificationState = {
  currentStreak: 0, longestStreak: 0, lastLessonDate: null,
  level: 1, totalXPEarned: 0, dailyRewardClaimed: false, dailyRewardDate: null,
};

/**
 * The RPC raises stable codes so the UI can explain the failure without
 * leaking database details.
 */
function describeSendError(message: string): string {
  if (message.includes('recipient_not_authorized')) {
    return 'This person is not an authorized contact for your account.';
  }
  if (message.includes('empty_message')) {
    return 'Please enter a subject and a message.';
  }
  if (message.includes('no_profile')) {
    return 'Your session has expired. Please sign in again.';
  }
  if (message.includes('not_authenticated')) {
    return 'Please sign in again to send messages.';
  }
  return 'Could not send the message. Please try again.';
}

function localDateStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
  masteryLevel?: number;
  attemptsCount?: number;
  lastAttemptAt?: string | null;
  srsDueAt?: string | null;
  srsCorrectStreak?: number;
}

export function computeMastery(lessonProgress: Record<string, LessonProgress>, subjectLessonIds?: Set<string>): Record<string, { correct: number; total: number; pct: number }> {
  const mastery: Record<string, { correct: number; total: number; pct: number }> = {};
  for (const lp of Object.values(lessonProgress)) {
    if (subjectLessonIds && !subjectLessonIds.has(lp.lessonId)) continue;
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

export interface SendMessageInput {
  recipientId: string;
  subject: string;
  body: string;
}

export interface SendMessageResult {
  ok: boolean;
  /** Already user-facing text; the RPC's error codes map to these. */
  error?: string;
}



interface AppContextType {
  loading: boolean;
  /** Reloads everything from Supabase — used by pull-to-refresh and retry. */
  refresh: () => Promise<void>;
  /** Set when the children query failed, so screens can offer a retry instead of an empty list. */
  error: string | null;
  students: StudentData[];
  /** The child every screen shows: home, marks, attendance. Null until the first load. */
  selectedStudentId: string | null;
  selectedStudent: StudentData | null;
  setSelectedStudentId: (id: string) => void;
  homework: HomeworkItem[];
  attendance: AttendanceRecord[];
  results: ComputedResult[];
  /** Subjects the school has started but not published — never shown as a zero. */
  pendingReports: PendingReport[];
  academicYears: SupabaseAcademicYear[];
  announcements: AnnouncementData[];
  announcementsSeenAt: string | null;
  markAnnouncementsSeen: () => void;
  newAnnouncementsCount: number;
  messages: AppMessage[];
  unreadCount: number;
  /** Unread messages plus announcements the parent has not opened yet. */
  unreadCommunications: number;
  markRead: (id: string) => void;
  /**
   * Sends a message through the send_message() RPC: sender, sender name and
   * role are taken from the session server-side, and the recipient is validated
   * against the school relationship. The client never supplies identities.
   */
  sendMessage: (input: SendMessageInput) => Promise<SendMessageResult>;
  /** People the signed-in user is authorized to message (from list_contacts()). */
  contacts: SupabaseContact[];
  loadContacts: () => Promise<SupabaseContact[]>;
  lessonProgress: Record<string, LessonProgress>;
  lessonAttempts: Record<string, AttemptSummary[]>;
  saveLessonProgress: (p: LessonProgress) => void;
  saveLessonAttempt: (lessonId: string, correctCount: number, totalActivities: number, activityResults: ActivityResult[]) => void;
  updateSrsState: (lessonId: string, correct: boolean) => void;
  getTotalXP: (studentId?: string) => number;
  gamification: GamificationState;
}

export interface StudentData {
  id: string;
  name: string;
  className: string;
  grade: string;
  avatarColor: string;
}

export interface AnnouncementData {
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



const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [rawExams, setRawExams] = useState<SupabaseExam[]>([]);
  const [rawAttendance, setRawAttendance] = useState<AttendanceRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lessonProgress, setLessonProgress] = useState<Record<string, LessonProgress>>({});
  const [lessonAttempts, setLessonAttempts] = useState<Record<string, AttemptSummary[]>>({});
  const [gamification, setGamification] = useState<GamificationState>(DEFAULT_GAMIFICATION);
  const [gamRespExists, setGamRespExists] = useState(false);
  const [contacts, setContacts] = useState<SupabaseContact[]>([]);
  const [academicYears, setAcademicYears] = useState<SupabaseAcademicYear[]>([]);
  const [selectedStudentId, setSelectedStudentIdState] = useState<string | null>(null);
  const [announcementsSeenAt, setAnnouncementsSeenAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  /**
   * Exams that exist but cannot be turned into a report yet. Derived from the same
   * rows the calculations above use, so a subject can only be in one place: either it
   * has a computed result, or the app says what is still missing.
   */
  const pendingReports = useMemo(() => computePendingReports(rawExams), [rawExams]);

  const loadData = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!user) { setLoading(false); return; }
    if (!silent) setLoading(true);
    setError(null);

    const [studentResp, progResp, gamResp, attemptsResp] = await Promise.all([
      supabase.from('students').select('*').eq('parentId', user.id),
      supabase.from('lesson_progress').select('*').eq('parent_id', user.id),
      supabase.from('gamification').select('*').eq('parent_id', user.id).maybeSingle(),
      supabase.from('lesson_attempts').select('*').eq('parent_id', user.id).order('completed_at', { ascending: true }),
    ]);

    if (studentResp.error || !studentResp.data) {
      setError('We could not load your children’s records. Please check your connection and try again.');
      setLoading(false);
      return;
    }
    const mapped = (studentResp.data as SupabaseStudent[]).map((s, i) => ({
      id: s.id,
      name: s.name,
      className: s.className,
      grade: parseClassName(s.className).grade,
      avatarColor: getAvatarColor(i),
    }));
    setStudents(mapped);

    if (progResp.data) {
      const progressMap: Record<string, LessonProgress> = {};
      for (const row of progResp.data as SupabaseLessonProgress[]) {
        progressMap[row.lesson_id] = {
          lessonId: row.lesson_id,
          completed: row.completed,
          xpEarned: row.xp_earned,
          correctCount: row.correct_count,
          totalActivities: row.total_activities,
          completedAt: row.completed_at || undefined,
          activityResults: row.activity_results || [],
          masteryLevel: row.mastery_level ?? 0,
          attemptsCount: row.attempts_count ?? 0,
          lastAttemptAt: row.last_attempt_at ?? null,
          srsDueAt: row.srs_due_at ?? null,
          srsCorrectStreak: row.srs_correct_streak ?? 0,
        };
      }
      setLessonProgress(progressMap);
    }

    if (attemptsResp.data) {
      const attemptsMap: Record<string, AttemptSummary[]> = {};
      for (const row of attemptsResp.data as SupabaseLessonAttempt[]) {
        if (!attemptsMap[row.lesson_id]) attemptsMap[row.lesson_id] = [];
        attemptsMap[row.lesson_id].push({
          accuracyPct: row.accuracy_pct,
          completedAt: row.completed_at,
        });
      }
      setLessonAttempts(attemptsMap);
    }

    if (gamResp.data) {
      const g = gamResp.data as SupabaseGamification;
      setGamification({
        currentStreak: g.current_streak,
        longestStreak: g.longest_streak,
        lastLessonDate: g.last_lesson_date,
        level: g.level,
        totalXPEarned: g.total_xp_earned,
        dailyRewardClaimed: g.daily_reward_claimed,
        dailyRewardDate: g.daily_reward_date,
      });
      setGamRespExists(true);
    }

    const studentIds = mapped.map(s => s.id);
    if (studentIds.length > 0) {
      const [examResult, attResult, inboxResult, sentResult, annResult, hwResult, yearResult] = await Promise.all([
        supabase.from('exams').select('*').in('studentId', studentIds),
        supabase.from('attendance').select('*').in('studentId', studentIds),
        supabase.from('messages').select('*').eq('recipientId', user.id),
        supabase.from('messages').select('*').eq('senderId', user.id),
        supabase.from('announcements').select('*'),
        supabase.from('homework').select('*').in('studentId', studentIds),
        supabase.from('academic_years').select('*').order('startDate', { ascending: false }),
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
      if (hwResult.data) {
        setHomework((hwResult.data as any[]).map(h => ({
          id: h.id,
          studentId: h.studentId,
          subject: h.subject,
          title: h.title,
          dueDate: h.dueDate,
          status: h.status as 'pending' | 'submitted' | 'graded',
          description: h.description || '',
        })));
      }
      if (yearResult.data) {
        setAcademicYears(yearResult.data as SupabaseAcademicYear[]);
      }

      const allMessages: AppMessage[] = [];
      if (inboxResult.data) {
        allMessages.push(...(inboxResult.data as SupabaseMessage[]).map(m => ({
          id: m.id,
          senderId: m.senderId,
          senderName: m.senderName ?? 'School',
          recipientId: m.recipientId,
          recipientName: m.recipientName ?? 'You',
          subject: m.subject,
          body: m.body,
          isRead: m.readAt !== null,
          createdAt: m.createdAt,
          isInbox: true,
        })));
      }
      if (sentResult.data) {
        allMessages.push(...(sentResult.data as SupabaseMessage[]).map(m => ({
          id: m.id,
          senderId: m.senderId,
          senderName: m.senderName ?? 'You',
          recipientId: m.recipientId,
          recipientName: m.recipientName ?? 'Recipient',
          subject: m.subject,
          body: m.body,
          isRead: true,
          createdAt: m.createdAt,
          isInbox: false,
        })));
      }
      allMessages.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setMessages(allMessages);

      if (annResult.data) {
        const mappedAnnouncements: AnnouncementData[] = (annResult.data as SupabaseAnnouncement[]).map(a => ({
          id: a.id,
          // The table has no title column: the class is the closest thing to one, and
          // a school-wide notice is simply the school's.
          title: a.className ? `${a.className} announcement` : 'School announcement',
          body: a.message,
          date: a.createdAt,
          category: 'general' as const,
          className: a.className,
        }));
        mappedAnnouncements.sort((a, b) => b.date.localeCompare(a.date));
        setAnnouncements(mappedAnnouncements);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refresh = useCallback(async () => {
    // Pull-to-refresh must not swap the screen for a skeleton, hence `silent`.
    await loadData({ silent: true });
  }, [loadData]);

  // Keep the remembered child valid: a stored id wins while that child is still in
  // the family, otherwise the first child is shown.
  useEffect(() => {
    if (students.length === 0) {
      setSelectedStudentIdState(null);
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(SELECTED_CHILD_KEY)
      .catch(() => null)
      .then(stored => {
        if (cancelled) return;
        setSelectedStudentIdState(current => {
          const candidate = current ?? stored;
          return candidate && students.some(s => s.id === candidate) ? candidate : students[0].id;
        });
      });
    return () => { cancelled = true; };
  }, [students]);

  const setSelectedStudentId = useCallback((id: string) => {
    setSelectedStudentIdState(id);
    AsyncStorage.setItem(SELECTED_CHILD_KEY, id).catch(() => {
      // The switch still applies for this session even if it cannot be stored.
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(ANNOUNCEMENTS_SEEN_KEY)
      .then(value => { if (value) setAnnouncementsSeenAt(value); })
      .catch(() => {
        // Without the marker every announcement simply reads as new.
      });
  }, []);

  const markAnnouncementsSeen = useCallback(() => {
    const now = new Date().toISOString();
    setAnnouncementsSeenAt(now);
    AsyncStorage.setItem(ANNOUNCEMENTS_SEEN_KEY, now).catch(() => {
      // Best effort: the marker resets on the next launch.
    });
  }, []);

  const selectedStudent = useMemo(
    () => students.find(s => s.id === selectedStudentId) ?? students[0] ?? null,
    [students, selectedStudentId],
  );

  const unreadCount = messages.filter(m => m.isInbox && !m.isRead).length;

  const newAnnouncementsCount = useMemo(
    () => announcements.filter(a => !announcementsSeenAt || a.date > announcementsSeenAt).length,
    [announcements, announcementsSeenAt],
  );

  const unreadCommunications = unreadCount + newAnnouncementsCount;

  const markRead = async (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m));
    // Only the recipient may mark a message read; the RPC enforces that.
    await supabase.rpc('mark_message_read', { p_message: id });
  };

  const loadContacts = async (): Promise<SupabaseContact[]> => {
    const { data, error } = await supabase.rpc('list_contacts');
    if (error || !data) return [];
    const list = data as SupabaseContact[];
    setContacts(list);
    return list;
  };

  const sendMessage = async ({ recipientId, subject, body }: SendMessageInput): Promise<SendMessageResult> => {
    const { data, error } = await supabase.rpc('send_message', {
      p_recipient: recipientId,
      p_subject: subject,
      p_body: body,
    });

    if (error) {
      return { ok: false, error: describeSendError(error.message) };
    }

    const now = new Date().toISOString();
    const recipient = contacts.find(c => c.id === recipientId);
    const sent: AppMessage = {
      id: String(data),
      senderId: user?.id ?? '',
      senderName: 'You',
      recipientId,
      recipientName: recipient?.name ?? 'Recipient',
      subject,
      body,
      isRead: true,
      createdAt: now,
      isInbox: false,
    };
    setMessages(prev => [sent, ...prev]);
    return { ok: true };
  };

  const saveLessonProgress = (p: LessonProgress) => {
    const prev = lessonProgress[p.lessonId];
    const wasCompleted = prev?.completed;
    const updated = { ...lessonProgress, [p.lessonId]: p };
    setLessonProgress(updated);
    const today = localDateStr();
    const newGam = { ...gamification };

    if (p.completed && !wasCompleted) {
      newGam.totalXPEarned += p.xpEarned;

      if (gamification.lastLessonDate !== today) {
        const y = new Date(); y.setDate(y.getDate() - 1);
        const yStr = localDateStr(y);
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
    }

    setGamification(newGam);

    (async () => {
      await supabase.from('lesson_progress').upsert({
        parent_id: user!.id,
        lesson_id: p.lessonId,
        completed: p.completed,
        xp_earned: p.xpEarned,
        correct_count: p.correctCount,
        total_activities: p.totalActivities,
        completed_at: p.completedAt || null,
        activity_results: p.activityResults || null,
        mastery_level: p.masteryLevel ?? 0,
        attempts_count: p.attemptsCount ?? 0,
        last_attempt_at: p.lastAttemptAt ?? null,
        srs_due_at: p.srsDueAt ?? null,
        srs_correct_streak: p.srsCorrectStreak ?? 0,
      }, { onConflict: 'parent_id,lesson_id' });

      if (!gamRespExists) {
        await supabase.from('gamification').insert({
          parent_id: user!.id,
          current_streak: newGam.currentStreak,
          longest_streak: newGam.longestStreak,
          last_lesson_date: newGam.lastLessonDate,
          level: newGam.level,
          total_xp_earned: newGam.totalXPEarned,
          daily_reward_claimed: newGam.dailyRewardClaimed,
          daily_reward_date: newGam.dailyRewardDate,
        });
        setGamRespExists(true);
      } else {
        await supabase.from('gamification').update({
          current_streak: newGam.currentStreak,
          longest_streak: newGam.longestStreak,
          last_lesson_date: newGam.lastLessonDate,
          level: newGam.level,
          total_xp_earned: newGam.totalXPEarned,
          daily_reward_claimed: newGam.dailyRewardClaimed,
          daily_reward_date: newGam.dailyRewardDate,
        }).eq('parent_id', user!.id);
      }
    })();
  };

  const saveLessonAttempt = (lessonId: string, correctCount: number, totalActivities: number, activityResults: ActivityResult[]) => {
    const prev = lessonProgress[lessonId];
    const prevAttempts = lessonAttempts[lessonId] ?? [];
    const attemptNumber = (prev?.attemptsCount ?? 0) + 1;
    const accuracyPct = totalActivities > 0 ? Math.round((correctCount / totalActivities) * 100) : 0;
    const newAttempt: AttemptSummary = { accuracyPct, completedAt: new Date().toISOString() };
    const allAttempts = [...prevAttempts, newAttempt];
    const masteryLevel = computeMasteryLevel(allAttempts);
    const completed = accuracyPct >= 100 || (prev?.completed ?? false);

    setLessonAttempts(prevA => ({ ...prevA, [lessonId]: allAttempts }));

    const updatedProgress: LessonProgress = {
      ...prev,
      lessonId,
      completed,
      xpEarned: prev?.xpEarned ?? 0,
      correctCount,
      totalActivities,
      completedAt: completed ? new Date().toISOString() : prev?.completedAt,
      activityResults,
      masteryLevel,
      attemptsCount: attemptNumber,
      lastAttemptAt: newAttempt.completedAt,
      srsDueAt: prev?.srsDueAt ?? null,
      srsCorrectStreak: prev?.srsCorrectStreak ?? 0,
    };
    setLessonProgress(prevP => ({ ...prevP, [lessonId]: updatedProgress }));

    (async () => {
      await supabase.from('lesson_attempts').insert({
        parent_id: user!.id,
        lesson_id: lessonId,
        attempt_number: attemptNumber,
        correct_count: correctCount,
        total_activities: totalActivities,
        accuracy_pct: accuracyPct,
        activity_results: activityResults,
        completed_at: newAttempt.completedAt,
      });
      await supabase.from('lesson_progress').upsert({
        parent_id: user!.id,
        lesson_id: lessonId,
        completed,
        xp_earned: updatedProgress.xpEarned,
        correct_count: correctCount,
        total_activities: totalActivities,
        completed_at: updatedProgress.completedAt || null,
        activity_results: activityResults,
        mastery_level: masteryLevel,
        attempts_count: attemptNumber,
        last_attempt_at: newAttempt.completedAt,
        srs_due_at: updatedProgress.srsDueAt ?? null,
        srs_correct_streak: updatedProgress.srsCorrectStreak ?? 0,
      }, { onConflict: 'parent_id,lesson_id' });
    })();
  };

  const updateSrsState = (lessonId: string, correct: boolean) => {
    const prev = lessonProgress[lessonId];
    if (!prev) return;
    const newStreak = correct ? (prev.srsCorrectStreak ?? 0) + 1 : 0;
    const newDue = nextSrsDueDate(newStreak);
    const updated = { ...prev, srsCorrectStreak: newStreak, srsDueAt: newDue };
    setLessonProgress(prevP => ({ ...prevP, [lessonId]: updated }));
    (async () => {
      await supabase.from('lesson_progress').update({
        srs_correct_streak: newStreak,
        srs_due_at: newDue,
      }).eq('parent_id', user!.id).eq('lesson_id', lessonId);
    })();
  };

  const getTotalXP = () => {
    return Object.values(lessonProgress)
      .filter(p => p.completed)
      .reduce((sum, p) => sum + p.xpEarned, 0);
  };

  return (
    <AppContext.Provider value={{
      loading, refresh, error, students,
      selectedStudentId, selectedStudent, setSelectedStudentId,
      homework, attendance: rawAttendance, results, pendingReports, academicYears,
      announcements, announcementsSeenAt, markAnnouncementsSeen, newAnnouncementsCount,
      messages, unreadCount, unreadCommunications, markRead, sendMessage, contacts, loadContacts,
      lessonProgress, lessonAttempts, saveLessonProgress, saveLessonAttempt, updateSrsState, getTotalXP, gamification,
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