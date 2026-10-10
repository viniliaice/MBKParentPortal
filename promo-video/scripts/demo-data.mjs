const DEMO_PARENT_ID = 'capture-only-parent';
const DEMO_STUDENT_ID = 'demo-student-001';

const formatDate = date => date.toISOString().slice(0, 10);
const atNoon = date => `${formatDate(date)}T12:00:00.000Z`;

function shiftedDate(base, days) {
  const date = new Date(base);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function assessment({ id, studentId, subject, score, total, examType, assessmentLabel, month, date, termId }) {
  return {
    id,
    studentId,
    subject,
    score,
    total,
    examType,
    month,
    status: 'published',
    parentId: DEMO_PARENT_ID,
    date: formatDate(date),
    createdAt: atNoon(date),
    teacherId: 'demo-teacher-5a',
    termId,
    subjectId: null,
    assessmentLabel,
    entryState: null,
    uploadedBy: 'demo-teacher-5a',
  };
}

/**
 * Synthetic, capture-only records. They are returned only by Playwright's route
 * interceptor for example.supabase.co; the Expo app itself and school database are
 * never modified or contacted.
 */
export function buildDemoData(now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const year = today.getUTCFullYear();
  const monthIndex = today.getUTCMonth();
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(today);
  const academicYearStart = monthIndex >= 8 ? year : year - 1;
  const currentYearName = `${academicYearStart}-${academicYearStart + 1}`;
  const previousYearStart = academicYearStart - 1;
  const previousYearName = `${previousYearStart}-${previousYearStart + 1}`;
  const currentTermId = `demo-midterm-${academicYearStart}`;
  const previousTermId = `demo-final-${previousYearStart}`;
  const monthlyDate = new Date(Date.UTC(year, monthIndex, Math.max(1, today.getUTCDate() - 2)));
  const midtermDate = new Date(today);
  const previousFinalDate = new Date(Date.UTC(academicYearStart, 4, 18));
  const previousMonthDate = new Date(Date.UTC(academicYearStart, 4, 12));

  const students = [{
    id: DEMO_STUDENT_ID,
    name: 'Demo Student',
    className: 'Grade 5A',
    parentId: DEMO_PARENT_ID,
    retentionStatus: 'active',
    createdAt: `${academicYearStart}-09-01T09:00:00.000Z`,
  }];

  const currentSubjects = [
    {
      subject: 'Mathematics',
      ca: [
        { examType: 'Homework', assessmentLabel: 'HW1', score: 18, total: 20 },
        { examType: 'Attendance', assessmentLabel: 'ATTENDANCE', score: 20, total: 20 },
        { examType: 'Classwork', assessmentLabel: 'CPW1', score: 17, total: 20 },
        { examType: 'Discipline', assessmentLabel: 'DISCIPLINE', score: 9, total: 10 },
      ],
      quiz: { score: 22, total: 25 },
      midterm: 91,
    },
    {
      subject: 'English',
      ca: [
        { examType: 'Homework', assessmentLabel: 'HW1', score: 17, total: 20 },
        { examType: 'Attendance', assessmentLabel: 'ATTENDANCE', score: 19, total: 20 },
        { examType: 'Classwork', assessmentLabel: 'CPW1', score: 18, total: 20 },
        { examType: 'Discipline', assessmentLabel: 'DISCIPLINE', score: 9, total: 10 },
      ],
      quiz: { score: 21, total: 25 },
      midterm: 87,
    },
  ];

  const exams = [];
  for (const [subjectIndex, item] of currentSubjects.entries()) {
    item.ca.forEach((component, componentIndex) => {
      exams.push(assessment({
        ...component,
        id: `demo-current-${subjectIndex}-${componentIndex}`,
        studentId: DEMO_STUDENT_ID,
        subject: item.subject,
        month: monthName,
        date: shiftedDate(monthlyDate, -Math.min(3, componentIndex)),
        termId: currentTermId,
      }));
    });
    exams.push(assessment({
      id: `demo-current-${subjectIndex}-quiz`,
      studentId: DEMO_STUDENT_ID,
      subject: item.subject,
      score: item.quiz.score,
      total: item.quiz.total,
      examType: 'Monthly Test',
      assessmentLabel: 'MT',
      month: monthName,
      date: monthlyDate,
      termId: currentTermId,
    }));
    exams.push(assessment({
      id: `demo-current-${subjectIndex}-midterm`,
      studentId: DEMO_STUDENT_ID,
      subject: item.subject,
      score: item.midterm,
      total: 100,
      examType: 'Midterm',
      assessmentLabel: 'MIDTERM',
      month: '',
      date: midtermDate,
      termId: currentTermId,
    }));
  }

  const previousSubjects = [
    { subject: 'Mathematics', ca: 65, caTotal: 70, quiz: 23, final: 93 },
    { subject: 'English', ca: 63, caTotal: 70, quiz: 22, final: 89 },
  ];
  for (const [subjectIndex, item] of previousSubjects.entries()) {
    exams.push(assessment({
      id: `demo-previous-${subjectIndex}-ca`,
      studentId: DEMO_STUDENT_ID,
      subject: item.subject,
      score: item.ca,
      total: item.caTotal,
      examType: 'Classwork',
      assessmentLabel: 'CA',
      month: 'May',
      date: previousMonthDate,
      termId: previousTermId,
    }));
    exams.push(assessment({
      id: `demo-previous-${subjectIndex}-quiz`,
      studentId: DEMO_STUDENT_ID,
      subject: item.subject,
      score: item.quiz,
      total: 25,
      examType: 'Monthly Test',
      assessmentLabel: 'MT',
      month: 'May',
      date: previousMonthDate,
      termId: previousTermId,
    }));
    exams.push(assessment({
      id: `demo-previous-${subjectIndex}-final`,
      studentId: DEMO_STUDENT_ID,
      subject: item.subject,
      score: item.final,
      total: 100,
      examType: 'Final',
      assessmentLabel: 'FINAL',
      month: '',
      date: previousFinalDate,
      termId: previousTermId,
    }));
  }

  const attendance = Array.from({ length: 10 }, (_, index) => {
    const date = shiftedDate(today, -(index + 1));
    const status = index === 4 ? 'late' : 'present';
    return {
      id: `demo-attendance-${index + 1}`,
      studentId: DEMO_STUDENT_ID,
      date: formatDate(date),
      status,
      note: status === 'late' ? 'Arrived after morning assembly' : '',
    };
  });

  const homework = [
    {
      id: 'demo-homework-pending',
      studentId: DEMO_STUDENT_ID,
      subject: 'Mathematics',
      title: 'Equivalent fractions',
      dueDate: formatDate(shiftedDate(today, 3)),
      status: 'pending',
      description: 'Complete the practice questions on equivalent fractions.',
    },
    {
      id: 'demo-homework-submitted',
      studentId: DEMO_STUDENT_ID,
      subject: 'English',
      title: 'Reading response',
      dueDate: formatDate(shiftedDate(today, 1)),
      status: 'submitted',
      description: 'Write a short response to this week’s reading passage.',
    },
    {
      id: 'demo-homework-graded',
      studentId: DEMO_STUDENT_ID,
      subject: 'Mathematics',
      title: 'Number patterns',
      dueDate: formatDate(shiftedDate(today, -4)),
      status: 'graded',
      description: 'Identify and explain the next number in each pattern.',
    },
  ];

  const inboxMessages = [
    {
      id: 'demo-message-unread',
      senderId: 'demo-teacher-5a',
      recipientId: DEMO_PARENT_ID,
      senderName: 'Grade 5A Teacher',
      recipientName: 'Demo Parent',
      senderRole: 'teacher',
      recipientRole: 'parent',
      subject: 'Monthly progress update',
      body: 'Demo message: the monthly report is ready to review in Marks.',
      readAt: null,
      createdAt: `${formatDate(today)}T09:10:00.000Z`,
    },
    {
      id: 'demo-message-read',
      senderId: 'demo-school-office',
      recipientId: DEMO_PARENT_ID,
      senderName: 'School Office',
      recipientName: 'Demo Parent',
      senderRole: 'office',
      recipientRole: 'parent',
      subject: 'Midterm information',
      body: 'Demo message: please check the school notice for midterm dates.',
      readAt: `${formatDate(today)}T08:30:00.000Z`,
      createdAt: `${formatDate(today)}T08:15:00.000Z`,
    },
  ];

  const sentMessages = [{
    id: 'demo-message-sent',
    senderId: DEMO_PARENT_ID,
    recipientId: 'demo-teacher-5a',
    senderName: 'Demo Parent',
    recipientName: 'Grade 5A Teacher',
    senderRole: 'parent',
    recipientRole: 'teacher',
    subject: 'Demo question',
    body: 'Sample message in the capture-only sent folder.',
    readAt: `${formatDate(today)}T10:00:00.000Z`,
    createdAt: `${formatDate(today)}T10:00:00.000Z`,
  }];

  const announcements = [{
    id: 'demo-announcement-1',
    className: 'Grade 5A',
    message: 'DEMO NOTICE: sample school updates appear here when shared by the school.',
    createdBy: 'demo-school-office',
    createdAt: `${formatDate(today)}T07:30:00.000Z`,
  }];

  const academicYears = [
    {
      id: 'demo-academic-year-current',
      name: currentYearName,
      startDate: `${academicYearStart}-09-01`,
      endDate: `${academicYearStart + 1}-08-31`,
      isCurrent: true,
      createdAt: `${academicYearStart}-09-01T09:00:00.000Z`,
    },
    {
      id: 'demo-academic-year-previous',
      name: previousYearName,
      startDate: `${previousYearStart}-09-01`,
      endDate: `${academicYearStart}-08-31`,
      isCurrent: false,
      createdAt: `${previousYearStart}-09-01T09:00:00.000Z`,
    },
  ];

  return {
    monthName,
    monthShort: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(today),
    parentId: DEMO_PARENT_ID,
    studentId: DEMO_STUDENT_ID,
    students,
    exams,
    attendance,
    homework,
    inboxMessages,
    sentMessages,
    announcements,
    academicYears,
  };
}
