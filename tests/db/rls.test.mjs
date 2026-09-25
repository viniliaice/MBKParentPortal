/**
 * RLS tests: what the remediation migrations do to the tables that had row level
 * security switched off.
 *
 * The suite loads the production-shaped fixture with its live policies (including
 * the ones that never match), applies the four remediation migrations, and then
 * asserts, table by table:
 *
 *   before: 16 tables had RLS off, so their policies were inert and the anon key
 *           could read and write them
 *   after:  RLS is on, the anon role gets nothing from the private tables, and
 *           every legitimate reader/writer still works
 *
 * If a test here fails, the corresponding live behaviour is wrong; these are the
 * rules that protect children's records, messages and report comments.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from './harness.mjs';

describe('RLS after the remediation migrations', () => {
  let h;
  let ids;

  before(async () => {
    h = await createDb();
    ids = h.ids;
  });

  after(async () => {
    await h.db.close();
  });

  describe('the leak is closed', () => {
    it('has RLS switched on for every table that had it off', async () => {
      await h.asOwner();
      const tables = [
        'academic_years', 'ai_review_logs', 'ai_reviews', 'announcement_recipients',
        'announcements', 'grade_scales', 'id_migration_map', 'lesson_period_ai_reviews',
        'messages', 'questions', 'quiz_questions', 'report_comments', 'report_config',
        'subjects', 'terms',
      ];
      const rows = await h.q(
        `select relname, relrowsecurity from pg_class where relname = any($1) and relkind = 'r'`,
        [tables],
      );
      assert.equal(rows.length, tables.length);
      for (const row of rows) {
        assert.equal(row.relrowsecurity, true, `RLS must be on for ${row.relname}`);
      }
    });

    it('gives the anon role nothing from the private tables', async () => {
      // This is the exposure that mattered: the anon key ships in the web page
      // and the app bundle.
      await h.asAnon();
      const privateTables = [
        'messages', 'report_comments', 'announcements', 'announcement_recipients',
        'questions', 'quiz_questions', 'ai_reviews', 'ai_review_logs',
        'lesson_period_ai_reviews', 'id_migration_map',
      ];
      for (const table of privateTables) {
        const res = await h.attempt(`select * from public.${table}`);
        if (res.ok) {
          assert.equal(res.rows.length, 0, `anon must see no rows in ${table}`);
        } else {
          assert.match(res.error.message, /permission denied|does not exist/i);
        }
      }
    });

    it('cannot be written to by anon either', async () => {
      await h.asAnon();
      const writes = [
        `insert into public.messages (id, "senderId", "recipientId", subject, body) values ('x', 'p-parent-a', 'p-teacher-a', 's', 'b')`,
        `update public.messages set subject = 'hacked'`,
        `delete from public.messages`,
        `insert into public.announcements (id, "className", message, "createdBy") values ('x', 'Grade 4A', 'm', 'p-admin')`,
        `insert into public.report_comments (id, "examId", subject) values ('x', 'e-child-a', 's')`,
        `insert into public.quiz_questions (id, "quizId", "questionId", "orderIndex", "promptSnapshot", "typeSnapshot") values ('x','q-4a','qn-1',0,'p','multiple_choice')`,
      ];
      for (const sql of writes) {
        const res = await h.attempt(sql);
        assert.equal(res.ok, false, `anon must not be able to run: ${sql}`);
      }
    });

    it('keeps the deliberately public reference data readable', async () => {
      // `Read terms`, `Read subjects`, `Read grades` and `Read config` are
      // `TO public USING (true)` in the live set: switching RLS on must not
      // change what a parent (or the website) can read.
      await h.asAnon();
      assert.ok((await h.q('select id from public.terms')).length >= 1, 'terms stay readable');
      assert.ok((await h.q('select id from public.subjects')).length >= 1, 'subjects stay readable');
      assert.ok((await h.q('select id from public.report_config')).length >= 1, 'report_config stays readable — seeded?');
    });
  });

  describe('messages', () => {
    before(async () => {
      await h.asUser(ids.emails.parentA);
    });

    it('lets a parent read their own thread and not another family’s', async () => {
      const mine = await h.q('select id, "senderId", "recipientId" from public.messages');
      assert.ok(mine.length >= 2, 'parent A is in two threads');
      assert.ok(mine.every(m => m.senderId === ids.parentA || m.recipientId === ids.parentA));

      await h.asUser(ids.emails.parentB);
      const theirs = await h.q('select id from public.messages');
      assert.ok(!theirs.some(m => m.id === 'm-1'), 'the thread between parent A and teacher A is invisible');
    });

    it('lets a parent send to the teacher of their child’s class', async () => {
      await h.asUser(ids.emails.parentA);
      const res = await h.attempt(
        `insert into public.messages (id, "senderId", "recipientId", subject, body)
         values ('m-new', $1, $2, 'Homework', 'Could we talk about it?')`,
        [ids.parentA, ids.teacherA],
      );
      assert.equal(res.ok, true, res.error?.message);
    });

    it('refuses a message that claims to come from somebody else', async () => {
      await h.asUser(ids.emails.parentA);
      const res = await h.attempt(
        `insert into public.messages (id, "senderId", "recipientId", subject, body)
         values ('m-spoof', $1, $2, 'Spoofed', 'Not mine')`,
        [ids.parentB, ids.teacherA],
      );
      assert.equal(res.ok, false, 'senderId must be the caller');
    });

    it('refuses a message to someone the sender has no relationship with', async () => {
      await h.asUser(ids.emails.parentA);
      const otherClassTeacher = await h.attempt(
        `insert into public.messages (id, "senderId", "recipientId", subject, body)
         values ('m-other-class', $1, $2, 'Hi', 'Body')`,
        [ids.parentA, ids.teacherB],
      );
      assert.equal(otherClassTeacher.ok, false, 'a parent cannot write to another class’s teacher');

      const unrelatedParent = await h.attempt(
        `insert into public.messages (id, "senderId", "recipientId", subject, body)
         values ('m-unrelated', $1, $2, 'Hi', 'Body')`,
        [ids.parentA, ids.parentB],
      );
      assert.equal(unrelatedParent.ok, false, 'nor to another parent');
    });

    it('lets the recipient mark a message read, and nobody else', async () => {
      // The recipient of m-1 is parent A.
      await h.asUser(ids.emails.parentA);
      assert.equal(await h.affected(`update public.messages set "readAt" = now() where id = 'm-1'`), 1);

      await h.asUser(ids.emails.teacherB);
      assert.equal(await h.affected(`update public.messages set "readAt" = now() where id = 'm-2'`), 0, 'not the thread they are not in');

      await h.asUser(ids.emails.parentA);
      assert.equal(await h.affected(`update public.messages set body = 'rewritten' where id = 'm-1'`), 0, 'and the text itself cannot be rewritten');
    });
  });

  describe('announcements', () => {
    it('lets a parent see their class’s notices', async () => {
      await h.asUser(ids.emails.parentA);
      const rows = await h.q('select id, "className" from public.announcements');
      assert.deepEqual(rows.map(r => r.id), ['an-4a']);
    });

    it('lets a teacher post to their own class but not another', async () => {
      await h.asUser(ids.emails.teacherA);
      const own = await h.attempt(
        `insert into public.announcements (id, "className", message, "createdBy")
         values ('an-new', 'Grade 4A', 'Trip on Friday', $1)`,
        [ids.teacherA],
      );
      assert.equal(own.ok, true, own.error?.message);

      const foreign = await h.attempt(
        `insert into public.announcements (id, "className", message, "createdBy")
         values ('an-foreign', 'Grade 4B', 'Not my class', $1)`,
        [ids.teacherA],
      );
      assert.equal(foreign.ok, false);
    });

    it('refuses an announcement signed by somebody else', async () => {
      await h.asUser(ids.emails.teacherA);
      const res = await h.attempt(
        `insert into public.announcements (id, "className", message, "createdBy")
         values ('an-spoof', 'Grade 4A', 'Spoofed', $1)`,
        [ids.teacherB],
      );
      assert.equal(res.ok, false);
    });
  });

  describe('quiz content', () => {
    it('lets a parent read the questions of their child’s quiz', async () => {
      await h.asUser(ids.emails.parentA);
      const rows = await h.q('select id from public.quiz_questions where "quizId" = $1', [ids.quizA]);
      assert.equal(rows.length, 2);
      assert.equal((await h.q('select id from public.quiz_questions where "quizId" = $1', [ids.quizB])).length, 0);
    });

    it('lets a teacher author their own quiz but not touch another’s', async () => {
      await h.asUser(ids.emails.teacherA);
      const own = await h.attempt(
        `insert into public.questions (id, prompt, type, "correctAnswer", "teacherId")
         values ('qn-new', '3 + 4 = ?', 'multiple_choice', 'A', $1)`,
        [ids.teacherA],
      );
      assert.equal(own.ok, true, own.error?.message);

      const foreignQuestion = await h.attempt(
        `insert into public.questions (id, prompt, type, "correctAnswer", "teacherId")
         values ('qn-foreign', 'Not mine', 'multiple_choice', 'A', $1)`,
        [ids.teacherB],
      );
      assert.equal(foreignQuestion.ok, false);

      const foreignQuiz = await h.attempt(
        `insert into public.quiz_questions (id, "quizId", "questionId", "orderIndex", "promptSnapshot", "typeSnapshot")
         values ('qq-foreign', 'q-4b', 'qn-1', 0, 'Not mine', 'multiple_choice')`,
        [],
      );
      assert.equal(foreignQuiz.ok, false, 'a teacher cannot edit another class’s quiz');
    });
  });

  describe('report comments', () => {
    it('now reaches the parent — the live rule never matched', async () => {
      await h.asOwner();
      await h.q(
        `insert into public.report_comments (id, "studentId", "termId", "teacherComment", "teacherId", "examId")
         values ('rc-child-a', 's-child-a', 'term-1', 'Good progress', 'p-teacher-a', 'e-child-a')`,
      );

      await h.asUser(ids.emails.parentA);
      const rows = await h.q('select id, "teacherComment" from public.report_comments');
      assert.deepEqual(rows.map(r => r.id), ['rc-child-a'], 'the fixed rule matches where (auth.uid())::text never did');

      await h.asUser(ids.emails.parentB);
      assert.equal((await h.q('select id from public.report_comments')).length, 0, 'another family sees nothing');
    });
  });

  describe('the staff paths that had to keep working', () => {
    it('keeps staff reads that were only working because RLS was off', async () => {
      // ai_reviews etc. had policies written but never applied; enabling RLS is
      // what makes them take effect.
      await h.asOwner();
      await h.q(
        `insert into public.lesson_plans (id, "teacher_id", "class_name", "week_label", title, "period_count")
         values ('lp-1', 'p-teacher-a', 'Grade 4A', 'W1', 'Fractions', 2)`,
      );
      await h.q(
        `insert into public.ai_reviews (id, plan_id, scores, executive_summary, total_score, percentage, performance_level)
         values ('ar-1', 'lp-1', '{}'::jsonb, 'Summary', 80, 80, 'Good')`,
      );

      await h.asUser(ids.emails.admin);
      assert.equal((await h.q('select id from public.ai_reviews')).length, 1, 'admin keeps its reviews');

      await h.asUser(ids.emails.teacherA);
      assert.equal((await h.q('select id from public.ai_reviews')).length, 1, 'the owning teacher keeps theirs');

      await h.asUser(ids.emails.teacherB);
      assert.equal((await h.q('select id from public.ai_reviews')).length, 0, 'another teacher does not gain access');
    });

    it('lets the office write reference data and keeps it readable to everyone', async () => {
      await h.asUser(ids.emails.admin);
      const res = await h.attempt(
        `insert into public.subjects (id, name) values ('sub-english', 'English')`,
      );
      assert.equal(res.ok, true, res.error?.message);

      await h.asUser(ids.emails.parentA);
      assert.ok((await h.q('select id from public.subjects')).length >= 2, 'parents still read subjects');

      const parentWrite = await h.attempt(`insert into public.subjects (id, name) values ('sub-x', 'Nope')`);
      assert.equal(parentWrite.ok, false, 'but parents cannot add subjects');
    });

    it('keeps the directory readable for the tiers that run the school', async () => {
      await h.asUser(ids.emails.office);
      assert.ok((await h.q('select id from public.profiles')).length >= 5, 'office reads the directory');

      await h.asUser(ids.emails.teacherA);
      const visible = await h.q('select id from public.profiles');
      assert.ok(visible.some(p => p.id === ids.parentA), 'a teacher keeps the families in their class');
      assert.ok(!visible.some(p => p.id === ids.parentB), 'and not another class’s');
    });
  });
});
