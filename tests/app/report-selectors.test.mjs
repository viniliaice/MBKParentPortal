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
    assert.deepEqual(selectors.ACADEMIC_YEAR_MONTHS, ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']);
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
});
