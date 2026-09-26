/**
 * Report selectors — the parent-facing half of the marks maths.
 *
 * `computeMonthlyResults` / `computeTermResults` in `context/AppContext.tsx` own the
 * weightings (40% CA, 60% exam) and are deliberately untouched by the redesign. This
 * suite covers what the new screens add on top: which results belong to which period,
 * what a parent is told is still being published, and how a child's summary is chosen.
 *
 * The module under test is TypeScript. Node strips the types itself from v22.6, so the
 * import is attempted at run time and the suite reports "skipped" (rather than failing
 * the run) on a Node that cannot load it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

let selectors = null;
try {
  selectors = await import('../../lib/reportSelectors.ts');
} catch {
  selectors = null;
}

const skip = selectors === null
  ? 'this Node cannot load the app TypeScript sources (needs Node 22.6+)'
  : false;

/** A computed monthly result: `score`/`total` as `AppContext` emits them. */
function monthlyResult(studentId, subject, pct, date, month) {
  return {
    id: `monthly-${studentId}-${subject}-${month}`,
    studentId,
    subject,
    score: pct,
    total: 100,
    examType: 'monthly',
    month,
    date,
    components: [{ name: 'Quiz', score: pct, total: 100, weight: 60 }],
  };
}

/** A raw exam row, as `computePendingReports` expects it. */
function exam(studentId, subject, examType, date, { month = 'Sep', termId = null } = {}) {
  return { studentId, subject, examType, month, date, termId };
}

describe('report selectors', { skip }, () => {
  it('rounds a percentage the same way the app always has', () => {
    assert.equal(selectors.percentage(80, 100), 80);
    assert.equal(selectors.percentage(2, 3), 67);
    assert.equal(selectors.percentage(5, 0), 0);
  });

  it('applies the school grade bands', () => {
    assert.equal(selectors.gradeFor(90, 100), 'A+');
    assert.equal(selectors.gradeFor(89, 100), 'A');
    assert.equal(selectors.gradeFor(80, 100), 'A');
    assert.equal(selectors.gradeFor(70, 100), 'B+');
    assert.equal(selectors.gradeFor(60, 100), 'B');
    assert.equal(selectors.gradeFor(50, 100), 'C');
    assert.equal(selectors.gradeFor(40, 100), 'D');
    assert.equal(selectors.gradeFor(39, 100), 'F');
  });

  it('picks the theme tone a mark should be shown in', () => {
    const tones = { success: 'green', warning: 'amber', danger: 'red' };
    assert.equal(selectors.gradeColorFor(95, 100, tones), 'green');
    assert.equal(selectors.gradeColorFor(80, 100, tones), 'green');
    assert.equal(selectors.gradeColorFor(79, 100, tones), 'amber');
    assert.equal(selectors.gradeColorFor(60, 100, tones), 'amber');
    assert.equal(selectors.gradeColorFor(59, 100, tones), 'red');
  });

  it('summarises a period as the average of its subjects', () => {
    const summary = selectors.summarisePeriod([
      monthlyResult('a', 'Maths', 80, '2025-09-15T00:00:00.000Z', 'Sep'),
      monthlyResult('a', 'English', 50, '2025-09-16T00:00:00.000Z', 'Sep'),
    ]);

    assert.equal(summary.count, 2);
    assert.equal(summary.averagePct, 65);
    assert.equal(summary.grade, 'B');
    assert.deepEqual(summary.strongest, { subject: 'Maths', pct: 80 }, '80% is at the strong threshold');
    assert.deepEqual(summary.attention, [{ subject: 'English', pct: 50 }]);
  });

  it('names the strongest subject and everything needing attention', () => {
    const summary = selectors.summarisePeriod([
      monthlyResult('a', 'Maths', 95, '2025-09-15T00:00:00.000Z', 'Sep'),
      monthlyResult('a', 'English', 30, '2025-09-16T00:00:00.000Z', 'Sep'),
    ]);

    assert.equal(summary.averagePct, 63);
    assert.deepEqual(summary.strongest, { subject: 'Maths', pct: 95 });
    assert.deepEqual(summary.attention, [{ subject: 'English', pct: 30 }]);
  });

  it('summarises an empty period without inventing a mark', () => {
    const summary = selectors.summarisePeriod([]);
    assert.equal(summary.averagePct, 0);
    assert.equal(summary.count, 0);
    assert.equal(summary.strongest, null);
    assert.deepEqual(summary.attention, []);
  });

  it('rolls the academic year over in September', () => {
    assert.equal(selectors.academicYearKey('2025-09-15T00:00:00.000Z'), '2025-2026');
    assert.equal(selectors.academicYearKey('2026-06-10T00:00:00.000Z'), '2025-2026');
    assert.equal(selectors.academicYearKey('2026-08-20T00:00:00.000Z'), '2025-2026');
    assert.equal(selectors.academicYearKey('2026-09-15T00:00:00.000Z'), '2026-2027');
    assert.equal(selectors.academicYearKey('not a date'), '');
  });

  it('maps calendar months onto the academic calendar', () => {
    assert.equal(selectors.academicMonthLabel(8), 'Sep');
    assert.equal(selectors.academicMonthLabel(11), 'Dec');
    assert.equal(selectors.academicMonthLabel(0), 'Jan');
    assert.equal(selectors.academicMonthLabel(5), 'Jun');
    assert.equal(selectors.academicMonthLabel(6), 'Jul');
    assert.equal(selectors.academicMonthLabel(7), 'Aug');
    assert.deepEqual(selectors.ACADEMIC_YEAR_MONTHS, ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']);
  });

  it('keeps the same month of two different years apart', () => {
    const lastYear = monthlyResult('a', 'Maths', 70, '2024-09-15T00:00:00.000Z', 'Sep');
    const thisYear = monthlyResult('a', 'Maths', 80, '2025-09-15T00:00:00.000Z', 'Sep');
    const december = monthlyResult('a', 'Maths', 60, '2025-12-10T00:00:00.000Z', 'Dec');

    assert.deepEqual(selectors.filterByMonth([lastYear, thisYear, december], 'Sep', '2025-2026'), [thisYear]);
    assert.deepEqual(selectors.filterByMonth([lastYear, thisYear, december], 'Jan', '2025-2026'), []);
    assert.equal(selectors.latestMonthWithData([thisYear, december]), 'Dec');
    assert.equal(selectors.latestMonthWithData([lastYear]), 'Sep');
    assert.equal(selectors.latestMonthWithData([]), null);
  });

  it('reports a monthly report as pending until the school publishes both halves', () => {
    const caOnly = [exam('a', 'Maths', 'Homework', '2025-09-10T00:00:00.000Z')];
    const pendingMonthly = selectors
      .computePendingReports(caOnly)
      .filter(p => p.period === 'monthly');

    assert.equal(pendingMonthly.length, 1);
    assert.equal(pendingMonthly[0].subject, 'Maths');
    assert.deepEqual(pendingMonthly[0].missing, ['quiz']);

    const complete = [
      ...caOnly,
      exam('a', 'Maths', 'Quiz', '2025-09-20T00:00:00.000Z'),
    ];
    assert.deepEqual(
      selectors.computePendingReports(complete).filter(p => p.period === 'monthly'),
      [],
      'a complete monthly group has a computed result and must not also be pending',
    );
  });

  it('reports a term report as pending until the components and the exam both exist', () => {
    const exams = [
      // A midterm exam with no continuous assessment behind it.
      exam('a', 'English', 'Midterm', '2025-10-01T00:00:00.000Z', { termId: 't1' }),
      // Continuous assessment with no exam of either kind.
      exam('a', 'Science', 'Quiz', '2025-10-02T00:00:00.000Z', { termId: 't1' }),
    ];

    const pending = selectors.computePendingReports(exams);
    const forPeriod = period => pending.filter(p => p.period === period).map(p => ({
      subject: p.subject,
      missing: p.missing,
    }));

    assert.deepEqual(forPeriod('midterm'), [
      { subject: 'English', missing: ['classwork, homework and quiz'] },
      { subject: 'Science', missing: ['midterm exam'] },
    ]);
    assert.deepEqual(forPeriod('final'), [
      { subject: 'Science', missing: ['final exam'] },
    ]);
  });

  it('does not warn about a subject the school has not started', () => {
    assert.deepEqual(selectors.computePendingReports([]), []);
  });

  it('scopes pending work to the period being viewed', () => {
    const pending = [
      { id: 'p-sep', studentId: 'a', subject: 'Science', period: 'monthly', month: 'Sep',
        date: '2025-09-20T00:00:00.000Z', missing: ['quiz'] },
      { id: 'p-dec', studentId: 'a', subject: 'Maths', period: 'monthly', month: 'Dec',
        date: '2025-12-12T00:00:00.000Z', missing: ['quiz'] },
      { id: 'p-midterm', studentId: 'a', subject: 'English', period: 'midterm', month: '',
        date: '2025-10-01T00:00:00.000Z', missing: ['classwork, homework and quiz'] },
      { id: 'p-last-year', studentId: 'a', subject: 'Somali', period: 'monthly', month: 'Sep',
        date: '2024-09-20T00:00:00.000Z', missing: ['quiz'] },
    ];
    const ids = items => items.map(p => p.id);

    assert.deepEqual(
      ids(selectors.pendingForView(pending, 'monthly', { month: 'Sep', yearKey: '2025-2026' })),
      ['p-sep'],
      'only September of the year being viewed',
    );
    assert.deepEqual(
      ids(selectors.pendingForView(pending, 'monthly', { yearKey: '2025-2026' })),
      ['p-sep', 'p-dec'],
      'without a month, every month of that period in the year',
    );
    assert.deepEqual(
      ids(selectors.pendingForView(pending, 'midterm', { yearKey: '2025-2026' })),
      ['p-midterm'],
      'a different period never borrows the monthly list',
    );
    assert.deepEqual(selectors.pendingForView([], 'final'), []);
  });

  it('summarises the child from their most recent report', () => {
    const results = [
      monthlyResult('a', 'Maths', 80, '2025-09-15T00:00:00.000Z', 'Sep'),
      monthlyResult('a', 'Maths', 40, '2025-12-10T00:00:00.000Z', 'Dec'),
      monthlyResult('b', 'Maths', 90, '2025-12-11T00:00:00.000Z', 'Dec'),
    ];
    const pending = [{
      id: 'p1', studentId: 'a', subject: 'English', period: 'monthly', month: 'Dec',
      date: '2025-12-12T00:00:00.000Z', missing: ['quiz'],
    }];

    const childA = selectors.summariseChild(results, pending, 'a');
    assert.equal(childA.hasAnyResult, true);
    assert.equal(childA.period, 'monthly');
    assert.equal(childA.month, 'Dec');
    assert.equal(childA.label, 'Dec 2025 monthly report');
    assert.equal(childA.averagePct, 40);
    assert.equal(childA.grade, 'D');
    assert.equal(childA.subjectCount, 1);
    assert.equal(childA.latestAssessment.pct, 40);
    assert.deepEqual(childA.pending.map(p => p.subject), ['English']);
    assert.deepEqual(childA.latestPending.map(p => p.subject), ['English'],
      'the pending work shown beside the summary is the summary period’s');
    assert.equal(childA.period, 'monthly');
    assert.equal(childA.month, 'Dec');

    const childB = selectors.summariseChild(results, pending, 'b');
    assert.equal(childB.averagePct, 90);
    assert.equal(childB.latestAssessment.subject, 'Maths');
    assert.deepEqual(childB.pending, [], 'another child’s pending work is never shown here');

    const childC = selectors.summariseChild(results, pending, 'c');
    assert.equal(childC.hasAnyResult, false);
    assert.equal(childC.period, null);
    assert.equal(childC.label, '');
    assert.equal(childC.subjectCount, 0);
    assert.deepEqual(childC.latestPending, []);

    // December is the month being summarised, so September's missing quiz — and the
    // midterm still to be sat — must not appear next to it.
    const childD = selectors.summariseChild(results, [
      { id: 'p-sep', studentId: 'a', subject: 'Science', period: 'monthly', month: 'Sep',
        date: '2025-09-20T00:00:00.000Z', missing: ['quiz'] },
      { id: 'p-dec', studentId: 'a', subject: 'Maths', period: 'monthly', month: 'Dec',
        date: '2025-12-12T00:00:00.000Z', missing: ['quiz'] },
      { id: 'p-term', studentId: 'a', subject: 'English', period: 'midterm', month: '',
        date: '2025-10-01T00:00:00.000Z', missing: ['midterm exam'] },
    ], 'a');
    assert.deepEqual(childD.latestPending.map(p => p.id), ['p-dec']);
    assert.equal(childD.pending.length, 3, 'the full list is still available');
  });

  describe('date handling — date is authoritative for exam month', () => {
    it('derives month from date regardless of stored month field', () => {
      // Prompt regression case:
      // month = "August", date = "2026-09-17" -> Expected: September
      const assessmentA = {
        subject: 'Science',
        score: '20',
        total: 20,
        examType: 'Attendance',
        month: 'August',
        status: 'approved',
        date: '2026-09-17',
        assessmentLabel: 'ATTENDANCE',
        entryState: 'scored',
      };
      assert.equal(selectors.getExamMonth(assessmentA), 'September');

      // month = "September", date = "2026-09-17" -> Expected: September
      const assessmentB = {
        subject: 'Science',
        score: '20',
        total: 20,
        examType: 'Attendance',
        month: 'September',
        status: 'approved',
        date: '2026-09-17',
        assessmentLabel: 'ATTENDANCE',
        entryState: 'scored',
      };
      assert.equal(selectors.getExamMonth(assessmentB), 'September');

      // date = 2026-08-15 -> August
      assert.equal(selectors.getExamMonth({ month: 'September', date: '2026-08-15' }), 'August');
      assert.equal(selectors.getExamMonth({ month: 'August', date: '2026-08-15' }), 'August');
      assert.equal(selectors.getExamMonth('2026-08-15'), 'August');
      assert.equal(selectors.getExamMonth('2026-09-17'), 'September');
    });

    it('falls back to stored month when date is missing or invalid', () => {
      assert.equal(selectors.getExamMonth({ month: 'August', date: '' }), 'August');
      assert.equal(selectors.getExamMonth({ month: 'September', date: 'invalid-date' }), 'September');
    });
  });

  describe('assessment classification and mapping', () => {
    it('maps Homework, Attendance, Classwork, Discipline to CA', () => {
      assert.equal(selectors.classifyAssessment({ examType: 'Homework' }), 'ca');
      assert.equal(selectors.classifyAssessment({ examType: 'Attendance' }), 'ca');
      assert.equal(selectors.classifyAssessment({ examType: 'Classwork' }), 'ca');
      assert.equal(selectors.classifyAssessment({ examType: 'Discipline' }), 'ca');
      assert.equal(selectors.classifyAssessment({ assessmentLabel: 'ATTENDANCE' }), 'ca');
      assert.equal(selectors.classifyAssessment({ assessmentLabel: 'AKHLAAQ' }), 'ca');
      assert.equal(selectors.classifyAssessment({ assessmentLabel: 'HW1' }), 'ca');
      assert.equal(selectors.classifyAssessment({ assessmentLabel: 'CPW2' }), 'ca');
      assert.equal(selectors.classifyAssessment({ examType: 'CA' }), 'ca');
    });

    it('maps Quiz and Monthly Test to quiz (60% component)', () => {
      assert.equal(selectors.classifyAssessment({ examType: 'Quiz' }), 'quiz');
      assert.equal(selectors.classifyAssessment({ examType: 'Monthly Test' }), 'quiz');
      assert.equal(selectors.classifyAssessment({ assessmentLabel: 'MT' }), 'quiz');
      assert.equal(selectors.classifyAssessment({ assessmentLabel: 'QUIZ' }), 'quiz');
      assert.equal(selectors.classifyAssessment({ assessmentLabel: 'MONTHLY TEST' }), 'quiz');
    });
  });

  describe('CA and Quiz weighting', () => {
    it('verifies Homework, Attendance, Classwork, and Discipline all contribute to 40% CA', () => {
      const exams = [
        { studentId: 's1', subject: 'Science', examType: 'Homework', score: 30, total: 40, date: '2026-09-10' },
        { studentId: 's1', subject: 'Science', examType: 'Attendance', score: 20, total: 20, date: '2026-09-17' },
        { studentId: 's1', subject: 'Science', examType: 'Classwork', score: 35, total: 40, date: '2026-09-12' },
        { studentId: 's1', subject: 'Science', examType: 'Discipline', score: 15, total: 20, date: '2026-09-20' },
        { studentId: 's1', subject: 'Science', examType: 'Quiz', score: 50, total: 60, date: '2026-09-25' },
      ];

      const calc = selectors.calculateMonthlyScore(exams);
      assert.ok(calc);
      // Total CA = 30 + 20 + 35 + 15 = 100 out of 40 + 20 + 40 + 20 = 120 -> 83%
      assert.equal(calc.caScore, 100);
      assert.equal(calc.caTotal, 120);
      assert.equal(calc.caPct, 83);
      // Quiz = 50 / 60 -> 83%
      assert.equal(calc.quizScore, 50);
      assert.equal(calc.quizTotal, 60);
      assert.equal(calc.quizPct, 83);
      // Final = round(83 * 0.4 + 83 * 0.6) = 83
      assert.equal(calc.finalScore, 83);
    });

    it('verifies Quiz/Monthly Test contributes 60% and CA contributes 40%', () => {
      // Case 1: CA = 100%, Quiz = 0% -> Final should be 40
      const caOnlyScored = [
        { studentId: 's1', subject: 'Maths', examType: 'Homework', score: 40, total: 40, date: '2026-09-10' },
        { studentId: 's1', subject: 'Maths', examType: 'Quiz', score: 0, total: 60, date: '2026-09-25' },
      ];
      const calc1 = selectors.calculateMonthlyScore(caOnlyScored);
      assert.equal(calc1.caPct, 100);
      assert.equal(calc1.quizPct, 0);
      assert.equal(calc1.finalScore, 40); // 100 * 0.4 + 0 * 0.6 = 40

      // Case 2: CA = 0%, Quiz = 100% -> Final should be 60
      const quizOnlyScored = [
        { studentId: 's1', subject: 'Maths', examType: 'Homework', score: 0, total: 40, date: '2026-09-10' },
        { studentId: 's1', subject: 'Maths', examType: 'Quiz', score: 60, total: 60, date: '2026-09-25' },
      ];
      const calc2 = selectors.calculateMonthlyScore(quizOnlyScored);
      assert.equal(calc2.caPct, 0);
      assert.equal(calc2.quizPct, 100);
      assert.equal(calc2.finalScore, 60); // 0 * 0.4 + 100 * 0.6 = 60
    });
  });

  describe('handling missing CA components', () => {
    it('normalizes CA across available components without penalizing missing ones with zero', () => {
      // Exact prompt example:
      // Homework: 35/40
      // Attendance: 20/20
      // Classwork: 34/40
      // Discipline: not entered
      // Quiz: 42/60
      const exams = [
        { studentId: 's1', subject: 'Science', examType: 'Homework', score: 35, total: 40, date: '2026-09-10' },
        { studentId: 's1', subject: 'Science', examType: 'Attendance', score: 20, total: 20, date: '2026-09-15' },
        { studentId: 's1', subject: 'Science', examType: 'Classwork', score: 34, total: 40, date: '2026-09-20' },
        { studentId: 's1', subject: 'Science', examType: 'Quiz', score: 42, total: 60, date: '2026-09-25' },
      ];

      const calc = selectors.calculateMonthlyScore(exams);
      assert.ok(calc);
      // CA score: 35 + 20 + 34 = 89
      assert.equal(calc.caScore, 89);
      // CA total: 40 + 20 + 40 = 100 (Discipline is not added as 0/something)
      assert.equal(calc.caTotal, 100);
      assert.equal(calc.caPct, 89);
      // Quiz score: 42, total: 60 -> 70%
      assert.equal(calc.quizScore, 42);
      assert.equal(calc.quizTotal, 60);
      assert.equal(calc.quizPct, 70);
      // Final Monthly Score = round(89 * 0.4 + 70 * 0.6) = round(35.6 + 42) = 78
      assert.equal(calc.finalScore, 78);
    });

    it('updates monthly result correctly once Discipline is entered', () => {
      const initialExams = [
        { studentId: 's1', subject: 'Science', examType: 'Homework', score: 35, total: 40, date: '2026-09-10' },
        { studentId: 's1', subject: 'Science', examType: 'Attendance', score: 20, total: 20, date: '2026-09-15' },
        { studentId: 's1', subject: 'Science', examType: 'Classwork', score: 34, total: 40, date: '2026-09-20' },
        { studentId: 's1', subject: 'Science', examType: 'Quiz', score: 42, total: 60, date: '2026-09-25' },
      ];

      const initialCalc = selectors.calculateMonthlyScore(initialExams);
      assert.equal(initialCalc.finalScore, 78);

      // Now teacher enters Discipline: 12/20
      const disciplineExam = {
        studentId: 's1',
        subject: 'Science',
        examType: 'Discipline',
        assessmentLabel: 'AKHLAAQ',
        score: 12,
        total: 20,
        date: '2026-09-22',
      };

      const updatedCalc = selectors.calculateMonthlyScore([...initialExams, disciplineExam]);
      // CA score: 89 + 12 = 101 out of 100 + 20 = 120 -> 101/120 = 84.17% -> 84%
      assert.equal(updatedCalc.caScore, 101);
      assert.equal(updatedCalc.caTotal, 120);
      assert.equal(updatedCalc.caPct, 84);
      // Quiz score: 42/60 -> 70%
      assert.equal(updatedCalc.quizScore, 42);
      assert.equal(updatedCalc.quizTotal, 60);
      assert.equal(updatedCalc.quizPct, 70);
      // Final: round(84 * 0.4 + 70 * 0.6) = round(33.6 + 42) = 76
      assert.equal(updatedCalc.finalScore, 76);

      const computedResults = selectors.computeMonthlyResults([...initialExams, disciplineExam]);
      assert.equal(computedResults.length, 1);
      assert.equal(computedResults[0].score, 76);
      assert.equal(computedResults[0].components[0].score, 84);
      assert.equal(computedResults[0].components[1].score, 70);
    });
  });

  describe('attendance regression', () => {
    it('treats Attendance 20/20 dated 2026-09-17 as CA in September, NOT a standalone 100% exam', () => {
      const attendanceRecord = {
        studentId: 's1',
        subject: 'Science',
        score: '20',
        total: 20,
        examType: 'Attendance',
        month: 'August', // Stale month
        status: 'approved',
        date: '2026-09-17',
        assessmentLabel: 'ATTENDANCE',
        entryState: 'scored',
      };

      // 1. Belongs to September based on the date
      assert.equal(selectors.getExamMonth(attendanceRecord), 'September');

      // 2. Classified as CA
      assert.equal(selectors.classifyAssessment(attendanceRecord), 'ca');

      // 3. Alone without a quiz, does NOT produce a standalone 100% monthly exam
      const resultsAlone = selectors.computeMonthlyResults([attendanceRecord]);
      assert.equal(resultsAlone.length, 0, 'Attendance alone does not produce a 100% monthly result');

      // Reported as pending quiz
      const pending = selectors
        .computePendingReports([attendanceRecord])
        .filter(p => p.period === 'monthly');
      assert.equal(pending.length, 1);
      assert.equal(pending[0].period, 'monthly');
      assert.equal(pending[0].month, 'September');
      assert.deepEqual(pending[0].missing, ['quiz']);

      // 4. With Quiz, contributes to CA 40%
      const quizRecord = {
        studentId: 's1',
        subject: 'Science',
        score: 50,
        total: 60,
        examType: 'Quiz',
        month: 'September',
        status: 'approved',
        date: '2026-09-25',
        assessmentLabel: 'MT',
        entryState: 'scored',
      };

      const results = selectors.computeMonthlyResults([attendanceRecord, quizRecord]);
      assert.equal(results.length, 1);
      const res = results[0];
      assert.equal(res.month, 'September');
      assert.equal(res.examType, 'monthly');
      // CA is 20/20 = 100%. Quiz is 50/60 = 83%. Final = round(100 * 0.4 + 83 * 0.6) = round(40 + 49.8) = 90
      assert.equal(res.score, 90);
      assert.equal(res.components[0].weight, 40);
      assert.equal(res.components[0].score, 100);
      assert.equal(res.components[1].weight, 60);
      assert.equal(res.components[1].score, 83);
    });
  });

  describe('monthly filtering by authoritative date', () => {
    it('ensures August assessments appear under August and September under September', () => {
      const augRecord = {
        id: 'res-aug',
        studentId: 's1',
        subject: 'Science',
        score: 85,
        total: 100,
        examType: 'monthly',
        month: 'September', // Stale month in record
        date: '2026-08-15',
        components: [],
      };
      const sepRecord = {
        id: 'res-sep',
        studentId: 's1',
        subject: 'Science',
        score: 78,
        total: 100,
        examType: 'monthly',
        month: 'August', // Stale month in record
        date: '2026-09-17',
        components: [],
      };

      const results = [augRecord, sepRecord];

      // August filter returns only the August-dated record (even though its month says 'September')
      const augFiltered = selectors.filterByMonth(results, 'Aug', '2025-2026');
      assert.deepEqual(augFiltered.map(r => r.id), ['res-aug']);

      // Also works when passed full name 'August'
      const augustFiltered = selectors.filterByMonth(results, 'August', '2025-2026');
      assert.deepEqual(augustFiltered.map(r => r.id), ['res-aug']);

      // September filter returns only the September-dated record (even though its month says 'August')
      const sepFiltered = selectors.filterByMonth(results, 'Sep', '2026-2027');
      assert.deepEqual(sepFiltered.map(r => r.id), ['res-sep']);

      const septemberFiltered = selectors.filterByMonth(results, 'September', '2026-2027');
      assert.deepEqual(septemberFiltered.map(r => r.id), ['res-sep']);
    });
  });

  describe('end-to-end monthly report verification for parent UI', () => {
    it('verifies exact fields, pending states, and updates between calculation and UI', () => {
      // Step 1: Database record with stale month
      // month = "August", date = "2026-09-17"
      const caRecords = [
        {
          id: 'exam-hw',
          studentId: 'pupil-1',
          subject: 'Science',
          examType: 'Homework',
          assessmentLabel: 'HW1',
          score: '35',
          total: 40,
          month: 'August', // Stale
          date: '2026-09-17',
          status: 'approved',
          entryState: 'scored',
        },
        {
          id: 'exam-att',
          studentId: 'pupil-1',
          subject: 'Science',
          examType: 'Attendance',
          assessmentLabel: 'ATTENDANCE',
          score: 20,
          total: 20,
          month: 'August', // Stale
          date: '2026-09-17',
          status: 'approved',
          entryState: 'scored',
        },
        {
          id: 'exam-cw',
          studentId: 'pupil-1',
          subject: 'Science',
          examType: 'Classwork',
          assessmentLabel: 'CPW1',
          score: 34,
          total: 40,
          month: 'August', // Stale
          date: '2026-09-17',
          status: 'approved',
          entryState: 'scored',
        },
      ];

      // Verification: Without quiz, no standalone result is published
      const resultsBeforeQuiz = selectors.computeMonthlyResults(caRecords);
      assert.equal(resultsBeforeQuiz.length, 0);

      // Pending state: Quiz is missing
      const pendingBefore = selectors
        .computePendingReports(caRecords)
        .filter(p => p.period === 'monthly');
      assert.equal(pendingBefore.length, 1);
      assert.equal(pendingBefore[0].month, 'September', 'Derived month is September');
      assert.equal(pendingBefore[0].subject, 'Science');
      assert.deepEqual(pendingBefore[0].missing, ['quiz']);

      // UI View Scoping: Pending item appears in September view, NOT August view
      const inSepView = selectors.pendingForView(pendingBefore, 'monthly', { month: 'Sep', yearKey: '2026-2027' });
      assert.equal(inSepView.length, 1);
      const inAugView = selectors.pendingForView(pendingBefore, 'monthly', { month: 'Aug', yearKey: '2025-2026' });
      assert.equal(inAugView.length, 0);

      // Step 2: Quiz is entered
      const quizRecord = {
        id: 'exam-qz',
        studentId: 'pupil-1',
        subject: 'Science',
        examType: 'Quiz',
        assessmentLabel: 'MT',
        score: 42,
        total: 60,
        month: 'September',
        date: '2026-09-25',
        status: 'approved',
        entryState: 'scored',
      };

      const allRecords = [...caRecords, quizRecord];

      // Verification: Pending resolved
      const pendingAfter = selectors
        .computePendingReports(allRecords)
        .filter(p => p.period === 'monthly');
      assert.equal(pendingAfter.length, 0);

      // Computed Results
      const resultsAfterQuiz = selectors.computeMonthlyResults(allRecords);
      assert.equal(resultsAfterQuiz.length, 1);
      const res = resultsAfterQuiz[0];

      // Month attribution
      assert.equal(res.month, 'September');
      assert.equal(res.subject, 'Science');

      // Final percentage: round(89 * 0.4 + 70 * 0.6) = 78
      assert.equal(res.score, 78);
      assert.equal(res.total, 100);

      // Breakdown components:
      // CA component: 40% weight, 89% score
      const caComponent = res.components.find(c => c.weight === 40);
      assert.ok(caComponent);
      assert.equal(caComponent.score, 89);
      assert.equal(caComponent.total, 100);

      // Quiz component: 60% weight, 70% score
      const quizComponent = res.components.find(c => c.weight === 60);
      assert.ok(quizComponent);
      assert.equal(quizComponent.score, 70);
      assert.equal(quizComponent.total, 100);

      // UI helper assertions:
      // Label formatted on SubjectResultCard
      assert.equal(selectors.formatMonthYear(res.date, res.month), 'Sep 2026');
      // Grade band
      assert.equal(selectors.gradeFor(res.score, res.total), 'B+');
      // Month counts and filters for MarksScreen chips
      const counts = selectors.monthlyMonthCounts(resultsAfterQuiz);
      assert.equal(counts.get('Sep'), 1);
      assert.equal(counts.get('Aug'), undefined);

      const filteredSep = selectors.filterByMonth(resultsAfterQuiz, 'Sep', '2026-2027');
      assert.equal(filteredSep.length, 1);
      const filteredAug = selectors.filterByMonth(resultsAfterQuiz, 'Aug', '2025-2026');
      assert.equal(filteredAug.length, 0);
    });
  });
});
