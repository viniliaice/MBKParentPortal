/**
 * Disposable PostgreSQL harness — production-shaped.
 *
 * Boots an in-process PGlite database, emulates the Supabase pieces the SQL
 * depends on (`auth` schema, `auth.uid()`/`auth.jwt()`, the `anon` /
 * `authenticated` / `service_role` roles, a `net.http_post` stub), loads
 * `fixtures/production-baseline.sql` — the school's real schema, text ids,
 * quoted camelCase, role CHECK incl. supervisor/office — then applies the
 * migrations under test and seeds one small school.
 *
 * Nothing here touches the project: every test runs against this throw-away
 * database, which is the only safe way to prove how access rules behave.
 *
 * Usage:
 *   const h = await createDb();
 *   await h.asUser(h.ids.emails.parentA);
 *   const rows = await h.q('select id from public.students');
 */
import { PGlite } from '@electric-sql/pglite';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const BASELINE = path.join(ROOT, 'tests', 'db', 'fixtures', 'production-baseline.sql');
const LIVE_POLICIES = path.join(ROOT, 'tests', 'db', 'fixtures', 'live-policies.sql');

/**
 * The migrations this remediation adds. They are written for the production
 * schema (text ids) and must stay additive; see docs/schema.md.
 */
export const NEW_MIGRATIONS = [
  '20260923101000_parent_app_access.sql',
  '20260923102000_tighten_open_policies.sql',
  '20260923103000_staff_and_contact_profile_read.sql',
  '20260923104000_enable_rls_close_public_tables.sql',
  '20260923105000_fix_profiles_policy_recursion.sql',
  '20260923106000_parent_app_functions.sql',
  '20260923107000_message_recipients.sql',
];

/** Tables the app touches directly. */
export const APP_TABLES = [
  'profiles', 'students', 'exams', 'attendance', 'homework', 'announcements',
  'announcement_recipients', 'messages', 'quizzes', 'questions',
  'quiz_questions', 'quiz_attempts', 'academic_years', 'terms', 'subjects',
  'class_subjects', 'student_enrollments', 'student_lesson_progress',
];

const BOOTSTRAP_SQL = `
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  created_at timestamptz not null default now()
);

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

-- Supabase provides auth.role(); it is used by a live profiles policy.
create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'role'
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

create schema if not exists net;

-- pg_net is not available inside PGlite; the triggers only call it.
create or replace function net.http_post(
  url text,
  body jsonb default '{}'::jsonb,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb,
  timeout_milliseconds integer default 5000
)
returns bigint
language sql
as $$ select 1::bigint $$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase grants these; live policies call auth.uid()/auth.role() from inside
-- the policy expression, which is evaluated as the calling role.
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;

-- Supabase grants these by default, which is why the lockdown migration has to
-- take them away again.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

const read = file => readFileSync(file, 'utf8');

/** Migrations named in NEW_MIGRATIONS that are not on disk yet. */
export const MISSING_MIGRATIONS = NEW_MIGRATIONS.filter(
  name => !existsSync(path.join(MIGRATIONS_DIR, name)),
);

/** Applies every migration under test, in filename order (skips missing ones). */
export async function applyMigrations(db, names = NEW_MIGRATIONS) {
  for (const name of names) {
    const file = path.join(MIGRATIONS_DIR, name);
    if (!existsSync(file)) continue;
    await db.exec(read(file));
  }
}

export async function createDb({ migrations = true } = {}) {
  const db = new PGlite();
  await db.exec(BOOTSTRAP_SQL);
  await db.exec(read(BASELINE));
  // The live policy set, so tests start from the state the project is actually in.
  await db.exec(read(LIVE_POLICIES));

  if (Array.isArray(migrations)) {
    // An explicit list, so a test can reproduce a state between two files.
    await applyMigrations(db, migrations);
  } else if (migrations) {
    await applyMigrations(db);
  }

  const asOwner = async () => {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  };

  const asAnon = async () => {
    await db.exec(`reset role; select set_config('request.jwt.claims', '{}', false); set role anon;`);
  };

  const asServiceRole = async () => {
    await db.exec(`reset role; select set_config('request.jwt.claims', '{}', false); set role service_role;`);
  };

  /** Signs in as the profile that owns `email` (claims + SET ROLE authenticated). */
  const asUser = async email => {
    await db.exec('reset role;');
    const { rows } = await db.query('select id from auth.users where email = $1', [email]);
    if (!rows.length) throw new Error(`no auth user for ${email}`);
    const claims = JSON.stringify({ sub: rows[0].id, email, role: 'authenticated' });
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
    await db.exec('set role authenticated;');
  };

  const q = async (sql, params = []) => (await db.query(sql, params)).rows;

  /** Runs a statement and reports the error instead of throwing. */
  const attempt = async (sql, params = []) => {
    try {
      const result = await db.query(sql, params);
      return { ok: true, rows: result.rows, affectedRows: result.affectedRows ?? 0, error: null };
    } catch (error) {
      return { ok: false, rows: [], affectedRows: 0, error };
    }
  };

  /** How many rows a write actually touched (RLS filters silently, it does not raise). */
  const affected = async (sql, params = []) => (await attempt(sql, params)).affectedRows;

  const ids = await seed(db);

  return { db, ids, asOwner, asAnon, asUser, asServiceRole, q, attempt, affected };
}

/** Deterministic auth uuids, keyed by profile id. */
const AUTH_IDS = {
  'p-parent-a': '00000000-0000-4000-8000-0000000000a1',
  'p-parent-b': '00000000-0000-4000-8000-0000000000a2',
  'p-teacher-a': '00000000-0000-4000-8000-0000000000a3',
  'p-teacher-b': '00000000-0000-4000-8000-0000000000a4',
  'p-supervisor': '00000000-0000-4000-8000-0000000000a5',
  'p-office': '00000000-0000-4000-8000-0000000000a6',
  'p-admin': '00000000-0000-4000-8000-0000000000a7',
  'p-parent-new': '00000000-0000-4000-8000-0000000000a8',
  'p-pending-parent': '00000000-0000-4000-8000-0000000000a9',
};

/**
 * One small school in the production shape: two families, two class teachers, a
 * supervisor, an office account, a principal and the records the app reads.
 */
export async function seed(db) {
  const profile = async (id, name, email, role, extra = {}) => {
    const authId = AUTH_IDS[id];
    if (authId) {
      await db.query('insert into auth.users (id, email) values ($1, $2)', [authId, email]);
    }
    await db.query(
      `insert into public.profiles (id, name, email, role, "assignedClasses", "assignedSubjects", auth_id, phone1)
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, '+252-00-000')`,
      [
        id, name, email, role,
        extra.assignedClasses ? JSON.stringify(extra.assignedClasses) : null,
        extra.assignedSubjects ? JSON.stringify(extra.assignedSubjects) : null,
        extra.provisionedOnly ? null : authId,
      ],
    );
  };

  await profile('p-parent-a', 'Amina Yusuf', 'parent.a@example.com', 'parent');
  await profile('p-parent-b', 'Bashir Ali', 'parent.b@example.com', 'parent');
  await profile('p-teacher-a', 'Teacher A', 'teacher.a@example.com', 'teacher', {
    assignedClasses: ['Grade 4A'], assignedSubjects: ['sub-maths'],
  });
  await profile('p-teacher-b', 'Teacher B', 'teacher.b@example.com', 'teacher', {
    assignedClasses: ['Grade 4B'], assignedSubjects: ['sub-maths'],
  });
  await profile('p-supervisor', 'Supervisor', 'supervisor@example.com', 'supervisor', {
    assignedClasses: ['Grade 4A', 'Grade 4B'],
  });
  await profile('p-office', 'Office', 'office@example.com', 'office');
  await profile('p-admin', 'Principal', 'admin@example.com', 'admin');

  // Provisioned by the school, not signed in yet: the sign-in bootstrap has to
  // claim this one by verified email.
  await profile('p-pending-parent', 'New Parent', 'parent.new@example.com', 'parent', { provisionedOnly: true });

  await db.query(
    `insert into public.students (id, name, "className", "parentId", "familyId", "parentPhone")
     values ('s-child-a', 'Yusuf A', 'Grade 4A', 'p-parent-a', 'fam-a', '+252-00-111'),
            ('s-child-a2', 'Yusuf A (sibling)', 'Grade 4A', 'p-parent-a', 'fam-a', '+252-00-111'),
            ('s-child-b', 'Ali B', 'Grade 4B', 'p-parent-b', 'fam-b', '+252-00-222')`,
  );

  await db.query(
    `insert into public.academic_years (id, name, "startDate", "endDate", "isCurrent")
     values ('ay-2026', '2026/2027', '2026-09-01', '2027-06-30', true)`,
  );

  await db.query(
    `insert into public.report_config (id) values ('default')`,
  );

  await db.query(
    `insert into public.grade_scales (id, "minScore", "maxScore", grade, remark)
     values ('gs-a', 80, 100, 'A', 'Excellent')`,
  );

  await db.query(
    `insert into public.terms (id, name, "academicYearId", "startDate", "endDate", "isCurrent", months)
     values ('term-1', 'Term 1', 'ay-2026', '2026-09-01', '2026-12-15', true, '{9,10,11,12}')`,
  );

  await db.query(
    `insert into public.subjects (id, name, "shortName") values ('sub-maths', 'Mathematics', 'MATH')`,
  );

  await db.query(
    `insert into public.class_subjects (id, "className", "subjectId", "teacherId")
     values ('cs-4a-maths', 'Grade 4A', 'sub-maths', 'p-teacher-a'),
            ('cs-4b-maths', 'Grade 4B', 'sub-maths', 'p-teacher-b')`,
  );

  // Marks: one approved (visible) and one awaiting approval.
  await db.query(
    `insert into public.exams (id, "studentId", subject, score, total, "examType", month, status, "parentId", date, "teacherId", "termId", "subjectId", "assessmentLabel")
     values ('e-child-a', 's-child-a', 'Mathematics', 18, 20, 'CA', 'September', 'approved', 'p-parent-a', '2026-09-10', 'p-teacher-a', 'term-1', 'sub-maths', 'CPW1'),
            ('e-child-a-pending', 's-child-a', 'Mathematics', 15, 20, 'Homework', 'September', 'pending', 'p-parent-a', '2026-09-12', 'p-teacher-a', 'term-1', 'sub-maths', 'HW1'),
            ('e-child-b', 's-child-b', 'Mathematics', 12, 20, 'CA', 'September', 'approved', 'p-parent-b', '2026-09-10', 'p-teacher-b', 'term-1', 'sub-maths', 'CPW1')`,
  );

  await db.query(
    `insert into public.attendance (id, "studentId", "className", date, status, "teacherId")
     values ('a-child-a', 's-child-a', 'Grade 4A', '2026-09-14', 'present', 'p-teacher-a'),
            ('a-child-b', 's-child-b', 'Grade 4B', '2026-09-14', 'absent', 'p-teacher-b')`,
  );

  await db.query(
    `insert into public.homework (id, "studentId", "className", subject, title, description, "dueDate", status, "teacherId")
     values ('h-child-a', 's-child-a', 'Grade 4A', 'Mathematics', 'Fractions', 'Worksheet 4', '2026-09-20', 'assigned', 'p-teacher-a'),
            ('h-child-b', 's-child-b', 'Grade 4B', 'Mathematics', 'Fractions', 'Worksheet 4', '2026-09-20', 'assigned', 'p-teacher-b')`,
  );

  await db.query(
    `insert into public.announcements (id, "className", message, "createdBy")
     values ('an-4a', 'Grade 4A', 'Sports day on Thursday', 'p-teacher-a'),
            ('an-4b', 'Grade 4B', 'Library visit', 'p-teacher-b')`,
  );

  // Three threads: two involve parent A, one is between the other two adults.
  await db.query(
    `insert into public.messages (id, "senderId", "recipientId", subject, body)
     values ('m-1', 'p-teacher-a', 'p-parent-a', 'Welcome', 'Hello from the class teacher'),
            ('m-2', 'p-parent-b', 'p-parent-a', 'Unrelated', 'A message from another family'),
            ('m-3', 'p-teacher-b', 'p-parent-b', 'Library', 'Books due back Friday')`,
  );

  await db.query(
    `insert into public.student_lesson_progress (student_id, lesson_id, completed, xp_earned, correct_count, total_activities)
     values ('${AUTH_IDS['p-parent-a']}', 'lesson-1', true, 40, 4, 5)`,
  );

  // Quizzes in the production vocabulary: questionOrder is created|randomized.
  const today = new Date();
  const day = offset => {
    const d = new Date(today.getTime() + offset * 86400000);
    return d.toISOString().slice(0, 10);
  };

  await db.query(
    `insert into public.quizzes (id, "className", subject, title, description, "openDate", "dueDate", "timeLimit", "questionOrder", "teacherId", status)
     values ('q-4a', 'Grade 4A', 'Mathematics', 'Fractions quiz', 'Week 3', $1, $2, 15, 'created', 'p-teacher-a', 'active'),
            ('q-4b', 'Grade 4B', 'Mathematics', 'Fractions quiz', 'Week 3', $1, $2, 15, 'created', 'p-teacher-b', 'active')`,
    [day(-1), day(2)],
  );

  await db.query(
    `insert into public.questions (id, prompt, type, options, "correctAnswer", "teacherId")
     values ('qn-1', '1/2 = ?', 'multiple_choice', '[{"label":"A","text":"0.5"},{"label":"B","text":"2"}]'::jsonb, 'A', 'p-teacher-a'),
            ('qn-2', '2/4 = ?', 'multiple_choice', '[{"label":"A","text":"0.5"},{"label":"B","text":"4"}]'::jsonb, 'A', 'p-teacher-a')`,
  );

  await db.query(
    `insert into public.quiz_questions (id, "quizId", "questionId", "orderIndex", points, "promptSnapshot", "optionsSnapshot", "correctAnswerSnapshot", "typeSnapshot")
     values ('qq-1', 'q-4a', 'qn-1', 0, 1, '1/2 = ?', '[{"label":"A","text":"0.5"},{"label":"B","text":"2"}]'::jsonb, 'A', 'multiple_choice'),
            ('qq-2', 'q-4a', 'qn-2', 1, 1, '2/4 = ?', '[{"label":"A","text":"0.5"},{"label":"B","text":"4"}]'::jsonb, 'A', 'multiple_choice')`,
  );

  await db.query(
    `insert into public.quiz_attempts (id, "quizId", "studentId", answers, "totalEarned", "totalPossible", status, "submittedAt")
     values ('qa-1', 'q-4a', 's-child-a', '[{"questionId":"qq-1","answer":"A","score":1}]'::jsonb, 1, 2, 'submitted', now())`,
  );

  return {
    parentA: 'p-parent-a',
    parentB: 'p-parent-b',
    teacherA: 'p-teacher-a',
    teacherB: 'p-teacher-b',
    supervisor: 'p-supervisor',
    office: 'p-office',
    admin: 'p-admin',
    pendingParent: 'p-pending-parent',
    childA: 's-child-a',
    childA2: 's-child-a2',
    childB: 's-child-b',
    quizA: 'q-4a',
    quizB: 'q-4b',
    authIds: AUTH_IDS,
    emails: {
      parentA: 'parent.a@example.com',
      parentB: 'parent.b@example.com',
      teacherA: 'teacher.a@example.com',
      teacherB: 'teacher.b@example.com',
      supervisor: 'supervisor@example.com',
      office: 'office@example.com',
      admin: 'admin@example.com',
      pendingParent: 'parent.new@example.com',
    },
  };
}
