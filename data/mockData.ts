export interface Student {
  id: string;
  name: string;
  className: string;
  grade: string;
  avatarColor: string;
}

export interface HomeworkItem {
  id: string;
  studentId: string;
  subject: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'submitted' | 'graded';
  description: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  note?: string;
}

export interface ExamResult {
  id: string;
  studentId: string;
  subject: string;
  score: number;
  total: number;
  examType: string;
  month: string;
  date: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  date: string;
  category: 'general' | 'event' | 'urgent' | 'academic';
  className?: string;
}

export interface AppMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  isInbox: boolean;
}

export function getGrade(score: number, total: number): string {
  const p = (score / total) * 100;
  if (p >= 90) return 'A+';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B+';
  if (p >= 60) return 'B';
  if (p >= 50) return 'C';
  if (p >= 40) return 'D';
  return 'F';
}

export function getGradeColor(score: number, total: number): string {
  const p = (score / total) * 100;
  if (p >= 80) return '#2ECC71';
  if (p >= 60) return '#F59E0B';
  return '#FF5370';
}
