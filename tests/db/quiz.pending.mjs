/*
 * PENDING REWRITE — NOT RUN BY `npm test`.
 *
 * These suites were written against the schema this repository recreates
 * (uuid ids, no pre-existing policies). The live database is different: text
 * primary keys, `profiles.id` as a school business id unrelated to auth,
 * roles including supervisor/office, and existing policies. A suite that passes
 * against a schema the school does not have proves nothing, so the file is kept
 * as reference (it documents the behaviour we still want to verify) and is
 * excluded from the suite until it is rewritten on tests/db/fixtures/
 * production-baseline.sql. See tests/db/README.md.
 */
/**
 * Quiz end-to-end tests: teacher creates a quiz and its questions, the child's
 * family sees it only while it is open, the attempt is taken and scored, and the
 * results/history screens read exactly what the database allows.
 *
 * Runs in both schema scenarios (fresh database / database that already had the
 * unversioned quiz tables) because the reconciliation has to produce the same
 * shape either way. See harness.mjs.
 */
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from './harness.mjs';

for (const legacyQuizTables of [false, true]) {
  const scenario = legacyQuizTables ? 'reconciled quiz tables' : 'fresh database';

  describe(`quizzes (${scenario})`, () => {
    let h;
    let ids;

    before(async () => {
      h = await createDb({ legacyQuizTables });
      ids = h.ids;
    });

    after(async () => {
      await h.db.close();
    });

    // -------------------------------------------------------------------
    // creation
    // -------------------------------------------------------------------

    describe('creation', () => {
      beforeEach(async () => {
        await h.asUser(ids.emails.teacherA);
      });

      it('lets a teacher create a quiz for their own class', async () => {
        const res = await h.attempt(
          `insert into public.quizzes ("className", subject, title, description, "teacherId", "timeLimit", "questionOrder", status, "openDate", "dueDate")
           values ('Grade 4A', 'Maths', 'Shapes quiz', 'Week 4', $1, 20, 'random', 'draft', now(), now() + interval '7 days')`,
          [ids.teacherA],
        );
        assert.equal(res.ok, true, res.error?.message);
      });

      it('refuses a quiz for another class', async () => {
        const res = await h.attempt(
          `insert into public.quizzes ("className", subject, title, "teacherId", status)
           values ('Grade 4B', 'Maths', 'Not mine', $1, 'draft')`,
          [ids.teacherA],
        );
        assert.equal(res.ok, false, 'a teacher cannot set work for another class');
      });

      it('refuses a quiz attributed to another teacher', async () => {
        const res = await h.attempt(
          `insert into public.quizzes ("className", subject, title, "teacherId", status)
           values ('Grade 4A', 'Maths', 'Impersonation', $1, 'draft')`,
          [ids.teacherB],
        );
        assert.equal(res.ok, false);
      });

      it('lets a teacher add questions to their own quiz', async () => {
        const created = await h.attempt(
          `insert into public.quizzes ("className", subject, title, "teacherId", status, "openDate", "dueDate")
           values ('Grade 4A', 'Maths', 'Fractions quiz 2', $1, 'active', now() - interval '1 hour', now() + interval '1 day')
           returning id`,
          [ids.teacherA],
        );
        assert.equal(created.ok, true, `a teacher can read back the quiz they just created: ${created.error?.message}`);
        assert.equal(created.rows.length, 1);

        const res = await h.attempt(
          `insert into public.quiz_questions ("quizId", "orderIndex", "promptSnapshot", "optionsSnapshot", "typeSnapshot", "correctAnswerSnapshot", points)
           values ($1, 0, '3 + 4 = ?', '[{"label":"A","text":"7"},{"label":"B","text":"8"}]'::jsonb, 'multiple_choice', 'A', 2)`,
          [created.rows[0].id],
        );
        assert.equal(res.ok, true, res.error?.message);
      });

      it('refuses to add questions to another teacher’s quiz', async () => {
        const res = await h.attempt(
          `insert into public.quiz_questions ("quizId", "orderIndex", "promptSnapshot", "typeSnapshot")
           values ($1, 0, 'Not mine', 'multiple_choice')`,
          [ids.quizB],
        );
        assert.equal(res.ok, false);
      });

      it('refuses parents any authoring', async () => {
        await h.asUser(ids.emails.parentA);
        const quiz = await h.attempt(
          `insert into public.quizzes ("className", subject, title, "teacherId", status)
           values ('Grade 4A', 'Maths', 'Parent-made', $1, 'draft')`,
          [ids.teacherA],
        );
        assert.equal(quiz.ok, false);

        const question = await h.attempt(
          `insert into public.quiz_questions ("quizId", "orderIndex", "promptSnapshot", "typeSnapshot")
           values ($1, 0, 'Parent-made', 'multiple_choice')`,
          [ids.quizA],
        );
        assert.equal(question.ok, false);
      });
    });

    // -------------------------------------------------------------------
    // legacy data
    // -------------------------------------------------------------------

    if (legacyQuizTables) {
      describe('migration of pre-existing quiz data', () => {
        it('moved the old folded columns onto the canonical ones without losing data', async () => {
          await h.asOwner();
          const rows = await h.q(
            `select id, "className", "dueDate", "timeLimit", "questionOrder", "showResults", status
             from public.quizzes where id = '22222222-2222-2222-2222-222222222222'`,
          );
          assert.equal(rows.length, 1, 'the old row still exists');
          const legacy = rows[0];
          assert.equal(legacy.className, 'Grade 4A', 'classid became className');
          assert.notEqual(legacy.dueDate, null, 'closeDate became dueDate');
          assert.equal(legacy.timeLimit, 10, 'timelimit became timeLimit');
          assert.equal(legacy.questionOrder, 'random', 'shuffleQuestions=true became questionOrder=random');
          assert.equal(legacy.showResults, true);
          assert.equal(legacy.status, 'active');
        });

        it('kept the pre-existing attempt and mapped its scores', async () => {
          await h.asOwner();
          const rows = await h.q(
            `select "studentId", "totalEarned", "totalPossible", status, "submittedAt"
             from public.quiz_attempts where id = '44444444-4444-4444-4444-444444444444'`,
          );
          assert.equal(rows.length, 1);
          assert.equal(rows[0].studentId, 'legacy-student');
          assert.equal(Number(rows[0].totalEarned), 1, 'score became totalEarned');
          assert.equal(Number(rows[0].totalPossible), 2, 'totalPoints became totalPossible');
          assert.notEqual(rows[0].submittedAt, null);
        });

        it('kept the pre-existing question and its snapshot', async () => {
          await h.asOwner();
          const rows = await h.q(
            `select "promptSnapshot", "orderIndex", points from public.quiz_questions
             where id = '33333333-3333-3333-3333-333333333333'`,
          );
          assert.equal(rows.length, 1);
          assert.equal(rows[0].promptSnapshot, 'Legacy question');
          assert.equal(rows[0].points, 2);
        });
      });
    }

    // -------------------------------------------------------------------
    // what a family sees
    // -------------------------------------------------------------------

    describe('listing and windows', () => {
      beforeEach(async () => {
        await h.asUser(ids.emails.parentA);
      });

      it('returns the class’s open quiz through the app’s own query shape', async () => {
        const rows = await h.q(
          `select id, "className", title, "questionOrder", "timeLimit" from public.quizzes
           where "className" = $1 and status = 'active' and "openDate" <= now() and "dueDate" >= now()`,
          ['Grade 4A'],
        );
        assert.ok(rows.some(r => r.id === ids.quizA), 'the open quiz is listed');
      });

      it('hides a quiz that is closed, future-dated or expired', async () => {
        await h.asOwner();
        await h.q(
          `insert into public.quizzes (id, "className", subject, title, "teacherId", status, "openDate", "dueDate")
           values ('70000000-0000-4000-8000-000000000001', 'Grade 4A', 'Maths', 'Future', $1, 'active', now() + interval '1 day', now() + interval '2 days'),
                  ('70000000-0000-4000-8000-000000000002', 'Grade 4A', 'Maths', 'Expired', $1, 'active', now() - interval '2 days', now() - interval '1 day'),
                  ('70000000-0000-4000-8000-000000000003', 'Grade 4A', 'Maths', 'Closed', $1, 'closed', now() - interval '1 day', now() + interval '1 day')`,
          [ids.teacherA],
        );

        await h.asUser(ids.emails.parentA);
        const rows = await h.q(
          `select id from public.quizzes
           where "className" = $1 and status = 'active' and "openDate" <= now() and "dueDate" >= now()`,
          ['Grade 4A'],
        );
        const visible = new Set(rows.map(r => r.id));
        assert.ok(visible.has(ids.quizA));
        assert.ok(!visible.has('70000000-0000-4000-8000-000000000001'), 'a future quiz is not listed');
        assert.ok(!visible.has('70000000-0000-4000-8000-000000000002'), 'an expired quiz is not listed');
        assert.ok(!visible.has('70000000-0000-4000-8000-000000000003'), 'a closed quiz is not listed');
      });

      it('counts questions with the app’s query', async () => {
        const rows = await h.q('select "quizId" from public.quiz_questions where "quizId" = $1', [ids.quizA]);
        assert.equal(rows.length, 2);
      });

      it('never exposes the other class’s quiz or questions', async () => {
        assert.equal((await h.q('select id from public.quizzes where id = $1', [ids.quizB])).length, 0);
        assert.equal((await h.q('select id from public.quiz_questions where "quizId" = $1', [ids.quizB])).length, 0);
      });

      it('documents the known limitation: the answer key ships to the client', async () => {
        // The pre-existing design grades answers in the app, so the snapshot
        // (including the correct answer) has to be readable by the family. It is
        // recorded here rather than hidden: the fix is a server-side grading RPC
        // (see docs/security-model.md, follow-ups).
        const rows = await h.q('select "correctAnswerSnapshot" from public.quiz_questions where "quizId" = $1', [ids.quizA]);
        assert.ok(rows.every(r => typeof r.correctAnswerSnapshot === 'string'));
      });
    });

    // -------------------------------------------------------------------
    // taking the quiz
    // -------------------------------------------------------------------

    describe('attempts', () => {
      let attemptId;

      beforeEach(async () => {
        await h.asUser(ids.emails.parentA);
      });

      it('stores an attempt with the parent derived from the child', async () => {
        const answers = [
          { questionId: 'q1', answer: 'A', isCorrect: true, score: 1, feedback: '' },
          { questionId: 'q2', answer: 'B', isCorrect: false, score: 0, feedback: '' },
        ];
        const res = await h.attempt(
          `insert into public.quiz_attempts ("quizId", "studentId", answers, "totalEarned", "totalPossible", status, "startedAt", "submittedAt")
           values ($1, $2, $3::jsonb, 1, 2, 'submitted', now() - interval '5 minutes', now())
           returning id, "parentId", answers, "totalEarned", "totalPossible", status`,
          [ids.quizA, ids.childA, JSON.stringify(answers)],
        );
        assert.equal(res.ok, true, res.error?.message);
        attemptId = res.rows[0].id;

        assert.equal(res.rows[0].parentId, ids.parentA, 'parentId is derived, never supplied');
        assert.equal(Number(res.rows[0].totalEarned), 1);
        assert.equal(Number(res.rows[0].totalPossible), 2);
        assert.equal(res.rows[0].status, 'submitted');
        assert.equal(res.rows[0].answers.length, 2);
      });

      it('neutralises a spoofed parentId instead of trusting it', async () => {
        const res = await h.attempt(
          `insert into public.quiz_attempts ("quizId", "studentId", "parentId", answers, "totalEarned", "totalPossible", status)
           values ($1, $2, $3, '[]'::jsonb, 0, 2, 'submitted')
           returning "parentId"`,
          [ids.quizA, ids.childA2, ids.parentB],
        );
        // Either the write is refused or the value is overwritten — what must
        // never happen is a row attributed to the other family.
        if (res.ok) {
          assert.equal(res.rows[0].parentId, ids.parentA, 'the trigger replaced the spoofed parent');
        }

        await h.asOwner();
        const spoofed = await h.q('select count(*)::int c from public.quiz_attempts where "parentId" = $1', [ids.parentB]);
        assert.equal(spoofed[0].c, 0, 'nothing is attributed to the spoofed parent');
      });

      it('refuses a second attempt for the same quiz and child', async () => {
        const res = await h.attempt(
          `insert into public.quiz_attempts ("quizId", "studentId", answers, "totalEarned", "totalPossible", status)
           values ($1, $2, '[]'::jsonb, 0, 2, 'submitted')`,
          [ids.quizA, ids.childA],
        );
        assert.equal(res.ok, false);
        assert.equal(res.error.code, '23505', 'the unique constraint is what the app reports as "already submitted"');
      });

      it('refuses an attempt for another family’s child', async () => {
        const res = await h.attempt(
          `insert into public.quiz_attempts ("quizId", "studentId", answers, "totalEarned", "totalPossible", status)
           values ($1, $2, '[]'::jsonb, 0, 2, 'submitted')`,
          [ids.quizB, ids.childB],
        );
        assert.equal(res.ok, false);
      });

      it('refuses an attempt on a quiz for another class', async () => {
        const res = await h.attempt(
          `insert into public.quiz_attempts ("quizId", "studentId", answers, "totalEarned", "totalPossible", status)
           values ($1, $2, '[]'::jsonb, 0, 2, 'submitted')`,
          [ids.quizB, ids.childA],
        );
        assert.equal(res.ok, false, 'the attempt is only visible to the family because it is theirs');
      });

      it('reads the result screen’s single attempt and the history list', async () => {
        const one = await h.q('select id, "quizId", answers, status from public.quiz_attempts where id = $1', [attemptId]);
        assert.equal(one.length, 1);
        assert.equal(one[0].quizId, ids.quizA);

        const history = await h.q(
          'select id, "submittedAt" from public.quiz_attempts where "studentId" = $1 order by "submittedAt" desc',
          [ids.childA],
        );
        assert.ok(history.length >= 1);
      });

      it('hides other families’ attempts and other classes’ attempts', async () => {
        assert.equal((await h.q('select id from public.quiz_attempts where "studentId" = $1', [ids.childB])).length, 0);

        await h.asUser(ids.emails.parentB);
        assert.equal((await h.q('select id from public.quiz_attempts where "studentId" = $1', [ids.childA])).length, 0);
      });

      it('does not let a parent rewrite or delete an attempt', async () => {
        await h.asUser(ids.emails.parentA);
        assert.equal(await h.affected(`update public.quiz_attempts set "totalEarned" = 99`), 0);
        assert.equal(await h.affected(`delete from public.quiz_attempts`), 0);
      });
    });

    // -------------------------------------------------------------------
    // grading
    // -------------------------------------------------------------------

    describe('grading', () => {
      // Each test starts from exactly one known attempt, so assertions do not
      // depend on how many rows an earlier test left behind.
      beforeEach(async () => {
        await h.asOwner();
        await h.q('delete from public.quiz_attempts');
        await h.q(
          `insert into public.quiz_attempts ("quizId", "studentId", answers, "totalEarned", "totalPossible", status)
           values ($1, $2, '[]'::jsonb, 1, 2, 'submitted')`,
          [ids.quizA, ids.childA],
        );
      });

      it('lets the class teacher grade, and freezes the attempt identity', async () => {
        await h.asOwner();
        const before = (await h.q('select id, "studentId", "quizId", "parentId" from public.quiz_attempts'))[0];

        await h.asUser(ids.emails.teacherA);
        const graded = await h.attempt(
          `update public.quiz_attempts
           set status = 'graded', "totalEarned" = 2, "studentId" = $1, "quizId" = $2, "parentId" = $3
           where id = $4`,
          [ids.childB, ids.quizB, ids.parentB, before.id],
        );
        assert.equal(graded.ok, true, graded.error?.message);

        await h.asOwner();
        const after_ = (await h.q('select "studentId", "quizId", "parentId", status, "totalEarned", "gradedAt" from public.quiz_attempts where id = $1', [before.id]))[0];
        assert.equal(after_.studentId, before.studentId, 'studentId is frozen for a non-admin');
        assert.equal(after_.quizId, before.quizId, 'quizId is frozen');
        assert.equal(after_.parentId, before.parentId, 'parentId is frozen');
        assert.equal(after_.status, 'graded');
        assert.equal(Number(after_.totalEarned), 2);
        assert.notEqual(after_.gradedAt, null, 'grading stamps the time');
      });

      it('does not let another class’s teacher grade', async () => {
        await h.asOwner();
        const attempt = (await h.q('select id from public.quiz_attempts'))[0];

        await h.asUser(ids.emails.teacherB);
        assert.equal(await h.affected(`update public.quiz_attempts set status = 'graded' where id = $1`, [attempt.id]), 0);
      });

      it('only an admin may delete an attempt', async () => {
        await h.asOwner();
        const attempt = (await h.q('select id from public.quiz_attempts'))[0];

        await h.asUser(ids.emails.teacherA);
        assert.equal(await h.affected('delete from public.quiz_attempts where id = $1', [attempt.id]), 0);

        await h.asUser(ids.emails.admin);
        assert.equal(await h.affected('delete from public.quiz_attempts where id = $1', [attempt.id]), 1);
      });
    });
  });
}
