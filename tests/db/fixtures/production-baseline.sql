-- ============================================================================
-- Production baseline — the real Supabase shape, as a disposable test fixture.
--
-- Source: the schema dump the school provided (text primary keys, quoted
-- camelCase columns, role CHECK constraint incl. supervisor/office, real FKs).
--
-- Sanitisation applied so it can actually run in PGlite:
--   * truncated CHECKs in the dump (`NOT VALI`) completed to `NOT VALID`;
--   * `terms.months ARRAY` -> `text[]`, `lesson_plan_periods.day USER-DEFINED`
--     -> `text` (the enum's identity is not in the dump);
--   * `id bigint DEFAULT nextval(...)` kept, with the two sequences created;
--   * table order corrected so every foreign key target exists first;
--   * no RLS policies are defined here: production has policies, and they are
--     pasted in separately once the school sends `pg_policies`. Until then the
--     tests treat the baseline as "tables exist, policies pending".
--
-- This file is a test fixture. It is never applied to production.
-- ============================================================================

create sequence if not exists audit_logs_id_seq;
create sequence if not exists release_log_id_seq;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

CREATE TABLE public.academic_years (
  id text NOT NULL,
  name text NOT NULL,
  "startDate" date NOT NULL,
  "endDate" date NOT NULL,
  "isCurrent" boolean DEFAULT false,
  "createdAt" timestamp with time zone DEFAULT now(),
  CONSTRAINT academic_years_pkey PRIMARY KEY (id)
);

CREATE TABLE public.subjects (
  id text NOT NULL,
  name text NOT NULL UNIQUE,
  "shortName" text,
  "createdAt" timestamp with time zone DEFAULT now(),
  color text,
  "weeklyLessons" integer NOT NULL DEFAULT 5,
  department text,
  CONSTRAINT subjects_pkey PRIMARY KEY (id)
);

CREATE TABLE public.grade_scales (
  id text NOT NULL,
  "minScore" numeric NOT NULL,
  "maxScore" numeric NOT NULL,
  grade text NOT NULL,
  remark text NOT NULL,
  gpa numeric,
  CONSTRAINT grade_scales_pkey PRIMARY KEY (id)
);

CREATE TABLE public.report_config (
  id text NOT NULL DEFAULT 'default',
  "caWeight" numeric NOT NULL DEFAULT 0.30,
  "midtermWeight" numeric NOT NULL DEFAULT 0.30,
  "finalWeight" numeric NOT NULL DEFAULT 0.40,
  "caTypes" text[] DEFAULT '{CA,Homework,Classwork,Quiz}',
  "updatedAt" timestamp with time zone DEFAULT now(),
  CONSTRAINT report_config_pkey PRIMARY KEY (id)
);

CREATE TABLE public.id_migration_map (
  old_id text,
  new_id uuid,
  email text
);

-- ---------------------------------------------------------------------------
-- People and families
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id text NOT NULL,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin', 'teacher', 'parent', 'supervisor', 'office'])),
  phone1 text,
  phone2 text,
  xafada text,
  udow text,
  paymentnumber text,
  "assignedClasses" jsonb,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "assignedSubjects" jsonb,
  fcm_token text,
  auth_id uuid,
  photo_url timestamp without time zone,
  expo_push_token text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT fk_users_auth_id FOREIGN KEY (auth_id) REFERENCES auth.users(id)
);

CREATE TABLE public.terms (
  id text NOT NULL,
  name text NOT NULL,
  "academicYearId" text NOT NULL,
  "startDate" date NOT NULL,
  "endDate" date NOT NULL,
  "isCurrent" boolean DEFAULT false,
  months text[] NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now(),
  CONSTRAINT terms_pkey PRIMARY KEY (id),
  CONSTRAINT "terms_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES public.academic_years(id)
);

CREATE TABLE public.students (
  id text NOT NULL,
  name text NOT NULL,
  "className" text NOT NULL,
  "parentId" text,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "govId" text,
  transport text CHECK (transport IS NULL OR transport = ANY (ARRAY['WALKER', 'CAR', 'DRIVER', 'LEFT']) OR transport ~ '^\d+$'),
  "parentPhone" text,
  "familyId" text,
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT "students_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.profiles(id)
);

CREATE TABLE public.class_subjects (
  id text NOT NULL,
  "className" text NOT NULL,
  "subjectId" text NOT NULL,
  "teacherId" text,
  "createdAt" date,
  CONSTRAINT class_subjects_pkey PRIMARY KEY (id),
  CONSTRAINT "class_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES public.subjects(id),
  CONSTRAINT "class_subjects_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public.profiles(id)
);

-- ---------------------------------------------------------------------------
-- Records
-- ---------------------------------------------------------------------------

CREATE TABLE public.exams (
  id text NOT NULL,
  "studentId" text NOT NULL,
  subject text NOT NULL,
  score numeric,
  total integer NOT NULL,
  "examType" text NOT NULL CONSTRAINT exams_examType_check CHECK ("examType" = ANY (ARRAY['CA', 'Homework', 'Classwork', 'Quiz', 'Midterm', 'Final', 'Attendance', 'Discipline'])),
  month text NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['pending', 'approved', 'rejected'])),
  "parentId" text,
  date date NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "teacherId" text NOT NULL,
  "termId" text,
  "subjectId" text,
  "assessmentLabel" text CONSTRAINT exams_assessmentLabel_check CHECK ("assessmentLabel" IS NULL OR ("assessmentLabel" = ANY (ARRAY['HW1', 'HW2', 'HW3', 'HW4', 'CPW1', 'CPW2', 'CPW3', 'CPW4', 'ATTENDANCE', 'MT', 'AKHLAAQ']))),
  "entryState" text NOT NULL DEFAULT 'scored' CONSTRAINT exams_entryState_check CHECK ("entryState" = ANY (ARRAY['scored', 'absent', 'not_applicable'])),
  "uploadedBy" text,
  CONSTRAINT exams_pkey PRIMARY KEY (id),
  CONSTRAINT "exams_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES public.profiles(id),
  CONSTRAINT "exams_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id),
  CONSTRAINT "exams_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.profiles(id),
  CONSTRAINT "exams_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public.profiles(id),
  CONSTRAINT "exams_termId_fkey" FOREIGN KEY ("termId") REFERENCES public.terms(id),
  CONSTRAINT "exams_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES public.subjects(id)
);

CREATE TABLE public.attendance (
  id text NOT NULL,
  "studentId" text NOT NULL,
  "className" text NOT NULL,
  date date NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['present', 'absent', 'late'])),
  note text,
  "teacherId" text NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT "attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id),
  CONSTRAINT "attendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public.profiles(id)
);

CREATE TABLE public.announcements (
  id text NOT NULL,
  "className" text NOT NULL,
  message text NOT NULL,
  "createdBy" text NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT "announcements_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.profiles(id)
);

CREATE TABLE public.announcement_recipients (
  id text NOT NULL,
  "announcementId" text NOT NULL,
  "parentId" text NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT announcement_recipients_pkey PRIMARY KEY (id),
  CONSTRAINT "announcement_recipients_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES public.announcements(id),
  CONSTRAINT "announcement_recipients_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.profiles(id)
);

CREATE TABLE public.messages (
  id text NOT NULL,
  "senderId" text NOT NULL,
  "recipientId" text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  "readAt" timestamp with time zone,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES public.profiles(id),
  CONSTRAINT "messages_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES public.profiles(id)
);

CREATE TABLE public.audit_logs (
  id bigint NOT NULL DEFAULT nextval('audit_logs_id_seq'),
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.grade_uploads (
  id text NOT NULL,
  "uploadedBy" text NOT NULL,
  "payload_hash" text NOT NULL,
  status text NOT NULL CHECK (status = 'completed'),
  result jsonb NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT grade_uploads_pkey PRIMARY KEY (id),
  CONSTRAINT "grade_uploads_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES public.profiles(id)
);

CREATE TABLE public.report_comments (
  id text NOT NULL,
  "studentId" text,
  "termId" text,
  "teacherComment" text,
  "principalComment" text,
  "teacherId" text,
  "createdAt" timestamp with time zone DEFAULT now(),
  "examId" text NOT NULL UNIQUE,
  subject text DEFAULT 'heloo',
  CONSTRAINT report_comments_pkey PRIMARY KEY (id),
  CONSTRAINT "report_comments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public.profiles(id),
  CONSTRAINT "report_comments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id),
  CONSTRAINT "report_comments_termId_fkey" FOREIGN KEY ("termId") REFERENCES public.terms(id),
  CONSTRAINT "report_comments_examId_fkey" FOREIGN KEY ("examId") REFERENCES public.exams(id)
);

CREATE TABLE public.grade_correction_audit (
  id text NOT NULL,
  exam_id text,
  student_id text,
  class_name text,
  subject_id text,
  subject text,
  assessment_label text,
  exam_type text,
  term_id text,
  assessment_date date,
  old_score numeric,
  new_score numeric,
  old_entry_state text,
  new_entry_state text,
  old_status text,
  new_status text,
  reason text NOT NULL,
  corrected_by text NOT NULL,
  corrected_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'admin_correction',
  CONSTRAINT grade_correction_audit_pkey PRIMARY KEY (id),
  CONSTRAINT grade_correction_audit_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id),
  CONSTRAINT grade_correction_audit_corrected_by_fkey FOREIGN KEY (corrected_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.student_promotions (
  id text NOT NULL,
  "studentId" text NOT NULL,
  "fromClass" text NOT NULL,
  "toClass" text NOT NULL,
  "academicYearId" text,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'promotion' CHECK (source = ANY (ARRAY['promotion', 'class_import'])),
  CONSTRAINT student_promotions_pkey PRIMARY KEY (id),
  CONSTRAINT "student_promotions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id),
  CONSTRAINT "student_promotions_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES public.academic_years(id)
);

CREATE TABLE public.student_enrollments (
  id text NOT NULL,
  "studentId" text NOT NULL,
  "className" text NOT NULL,
  "academicYearId" text,
  "termId" text,
  "effectiveFrom" date NOT NULL,
  "effectiveTo" date,
  reason text NOT NULL DEFAULT 'backfill' CHECK (reason = ANY (ARRAY['backfill', 'promotion', 'import', 'transfer', 'correction', 'manual'])),
  "sourceRef" text,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT student_enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT "student_enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id),
  CONSTRAINT "student_enrollments_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES public.academic_years(id),
  CONSTRAINT "student_enrollments_termId_fkey" FOREIGN KEY ("termId") REFERENCES public.terms(id)
);

CREATE TABLE public.student_lesson_progress (
  student_id uuid NOT NULL,
  lesson_id text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  xp_earned integer NOT NULL DEFAULT 0,
  total_attempts integer NOT NULL DEFAULT 1,
  correct_count integer NOT NULL DEFAULT 0,
  total_activities integer NOT NULL DEFAULT 0,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT student_lesson_progress_pkey PRIMARY KEY (student_id, lesson_id)
);

-- ---------------------------------------------------------------------------
-- Pickups and release
-- ---------------------------------------------------------------------------

CREATE TABLE public.authorized_pickups (
  id text NOT NULL,
  name text NOT NULL,
  "phoneNumber" text NOT NULL,
  relationship text,
  "photoPath" text,
  "addedByStaffId" text NOT NULL,
  "addedAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT authorized_pickups_pkey PRIMARY KEY (id)
);

CREATE TABLE public.authorized_pickup_students (
  "authorizedPickupId" text NOT NULL,
  "studentId" text NOT NULL,
  CONSTRAINT authorized_pickup_students_pkey PRIMARY KEY ("authorizedPickupId", "studentId"),
  CONSTRAINT "authorized_pickup_students_authorizedPickupId_fkey" FOREIGN KEY ("authorizedPickupId") REFERENCES public.authorized_pickups(id),
  CONSTRAINT "authorized_pickup_students_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id)
);

CREATE TABLE public.release_log (
  id bigint NOT NULL DEFAULT nextval('release_log_id_seq'),
  "studentId" text NOT NULL,
  "familyId" text NOT NULL,
  "staffId" text NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "pickupPersonId" text,
  CONSTRAINT release_log_pkey PRIMARY KEY (id),
  CONSTRAINT "release_log_pickuppersonid_fkey" FOREIGN KEY ("pickupPersonId") REFERENCES public.authorized_pickups(id),
  CONSTRAINT "release_log_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id),
  CONSTRAINT "release_log_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES public.profiles(id)
);

-- ---------------------------------------------------------------------------
-- Lesson planning and AI review
-- ---------------------------------------------------------------------------

CREATE TABLE public.unit_plans (
  id text NOT NULL,
  name text NOT NULL,
  "subject_id" text NOT NULL,
  "class_name" text NOT NULL,
  "term_id" text NOT NULL,
  "week_number_start" integer NOT NULL CHECK ("week_number_start" >= 1),
  "week_number_end" integer NOT NULL,
  objectives text NOT NULL,
  "teacher_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unit_plans_pkey PRIMARY KEY (id),
  CONSTRAINT unit_plans_subject_id_fkey FOREIGN KEY ("subject_id") REFERENCES public.subjects(id),
  CONSTRAINT unit_plans_term_id_fkey FOREIGN KEY ("term_id") REFERENCES public.terms(id),
  CONSTRAINT unit_plans_teacher_id_fkey FOREIGN KEY ("teacher_id") REFERENCES public.profiles(id)
);

CREATE TABLE public.lesson_plans (
  id text NOT NULL,
  "teacher_id" text NOT NULL,
  "subject_id" text,
  "class_name" text NOT NULL,
  "week_label" text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft', 'submitted', 'in_review', 'approved', 'rejected', 'ai_failed', 'revision_requested'])),
  "period_count" integer NOT NULL CHECK ("period_count" >= 1),
  "previous_score" integer,
  "previous_reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "unit_id" text,
  "ai_started_at" timestamp with time zone,
  "ai_failure_reason" text,
  "revision_note" text,
  "revision_requested_at" timestamp with time zone,
  CONSTRAINT lesson_plans_pkey PRIMARY KEY (id),
  CONSTRAINT lesson_plans_unit_id_fkey FOREIGN KEY ("unit_id") REFERENCES public.unit_plans(id),
  CONSTRAINT lesson_plans_teacher_id_fkey FOREIGN KEY ("teacher_id") REFERENCES public.profiles(id),
  CONSTRAINT lesson_plans_subject_id_fkey FOREIGN KEY ("subject_id") REFERENCES public.subjects(id)
);

CREATE TABLE public.lesson_plan_periods (
  id text NOT NULL,
  plan_id text NOT NULL,
  day text NOT NULL,
  period_number integer NOT NULL CHECK (period_number >= 1),
  topic text NOT NULL,
  activities text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  objective text,
  slide_number text,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  subject text,
  class_name text,
  is_free boolean NOT NULL DEFAULT false,
  CONSTRAINT lesson_plan_periods_pkey PRIMARY KEY (id),
  CONSTRAINT lesson_plan_periods_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.lesson_plans(id)
);

CREATE TABLE public.homework (
  id text NOT NULL,
  "studentId" text NOT NULL,
  "className" text NOT NULL,
  subject text NOT NULL,
  title text NOT NULL,
  description text,
  "dueDate" date NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['assigned', 'submitted', 'graded'])),
  "teacherId" text NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  lesson_plan_period_id text,
  CONSTRAINT homework_pkey PRIMARY KEY (id),
  CONSTRAINT "homework_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id),
  CONSTRAINT "homework_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public.profiles(id),
  CONSTRAINT homework_lesson_plan_period_id_fkey FOREIGN KEY (lesson_plan_period_id) REFERENCES public.lesson_plan_periods(id)
);

CREATE TABLE public.ai_reviews (
  id text NOT NULL,
  plan_id text NOT NULL UNIQUE,
  scores jsonb NOT NULL,
  executive_summary text NOT NULL,
  total_score integer NOT NULL,
  percentage integer NOT NULL,
  performance_level text NOT NULL,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  improvements jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_summary_notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  additional_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'reviewed'])),
  supervisor_comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT ai_reviews_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.lesson_plans(id)
);

CREATE TABLE public.ai_review_logs (
  id text NOT NULL,
  plan_id text,
  teacher_id text,
  outcome text NOT NULL CHECK (outcome = ANY (ARRAY['success', 'timeout', 'api_error', 'unit_match_error', 'malformed_json', 'rate_limit', 'save_error', 'unknown'])),
  error_code text,
  message text,
  latency_ms integer,
  attempt integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_review_logs_pkey PRIMARY KEY (id),
  CONSTRAINT ai_review_logs_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.lesson_plans(id),
  CONSTRAINT ai_review_logs_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.lesson_period_ai_reviews (
  id text NOT NULL,
  plan_id text NOT NULL,
  period_id text,
  period_order integer NOT NULL,
  alignment_status text NOT NULL CHECK (alignment_status = ANY (ARRAY['fully_aligned', 'partially_aligned', 'not_aligned'])),
  review_text text NOT NULL,
  alignment_reason text,
  alignment_gap text,
  suggested_activities jsonb,
  unit_plan_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  revision_status text NOT NULL DEFAULT 'not_applicable' CHECK (revision_status = ANY (ARRAY['included', 'missing', 'not_applicable'])),
  revision_reason text,
  CONSTRAINT lesson_period_ai_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT lesson_period_ai_reviews_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.lesson_plans(id),
  CONSTRAINT lesson_period_ai_reviews_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.lesson_plan_periods(id),
  CONSTRAINT lesson_period_ai_reviews_unit_plan_id_fkey FOREIGN KEY (unit_plan_id) REFERENCES public.unit_plans(id)
);

-- ---------------------------------------------------------------------------
-- Quizzes
-- ---------------------------------------------------------------------------

CREATE TABLE public.quizzes (
  id text NOT NULL,
  "className" text NOT NULL,
  subject text NOT NULL,
  title text NOT NULL,
  description text,
  "openDate" date NOT NULL,
  "dueDate" date NOT NULL,
  "timeLimit" integer,
  "questionOrder" text DEFAULT 'created' CHECK ("questionOrder" = ANY (ARRAY['created', 'randomized'])),
  "teacherId" text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft', 'active', 'closed'])),
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  lesson_plan_id text,
  auto_generated boolean NOT NULL DEFAULT false,
  CONSTRAINT quizzes_pkey PRIMARY KEY (id),
  CONSTRAINT "quizzes_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public.profiles(id),
  CONSTRAINT quizzes_lesson_plan_id_fkey FOREIGN KEY (lesson_plan_id) REFERENCES public.lesson_plans(id)
);

CREATE TABLE public.questions (
  id text NOT NULL,
  prompt text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['multiple_choice', 'direct_answer'])),
  options jsonb,
  "correctAnswer" text,
  rubric text,
  "teacherId" text NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  source_lesson_plan_id text,
  source_quiz_id text,
  source_auto_generated boolean NOT NULL DEFAULT false,
  source_subject_id text,
  source_class_name text,
  CONSTRAINT questions_pkey PRIMARY KEY (id),
  CONSTRAINT "questions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public.profiles(id),
  CONSTRAINT questions_source_lesson_plan_id_fkey FOREIGN KEY (source_lesson_plan_id) REFERENCES public.lesson_plans(id),
  CONSTRAINT questions_source_quiz_id_fkey FOREIGN KEY (source_quiz_id) REFERENCES public.quizzes(id),
  CONSTRAINT questions_source_subject_id_fkey FOREIGN KEY (source_subject_id) REFERENCES public.subjects(id)
);

CREATE TABLE public.quiz_questions (
  id text NOT NULL,
  "quizId" text NOT NULL,
  "questionId" text NOT NULL,
  "orderIndex" integer NOT NULL,
  points integer NOT NULL DEFAULT 1,
  "promptSnapshot" text NOT NULL,
  "optionsSnapshot" jsonb,
  "correctAnswerSnapshot" text,
  "typeSnapshot" text NOT NULL,
  CONSTRAINT quiz_questions_pkey PRIMARY KEY (id),
  CONSTRAINT "quiz_questions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES public.quizzes(id),
  CONSTRAINT "quiz_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES public.questions(id)
);

CREATE TABLE public.quiz_attempts (
  id text NOT NULL,
  "quizId" text NOT NULL,
  "studentId" text NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  "totalEarned" integer DEFAULT 0,
  "totalPossible" integer DEFAULT 0,
  "startedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "submittedAt" timestamp with time zone,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status = ANY (ARRAY['in_progress', 'submitted', 'graded'])),
  CONSTRAINT quiz_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT "quiz_attempts_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES public.quizzes(id),
  CONSTRAINT "quiz_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id)
);

-- ---------------------------------------------------------------------------
-- Student merge / deduplication audit
-- ---------------------------------------------------------------------------

CREATE TABLE public.student_merge_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  "canonicalStudentId" text NOT NULL,
  "duplicateStudentId" text NOT NULL,
  "performedBy" text,
  "mergedAt" timestamp with time zone NOT NULL DEFAULT now(),
  reason text NOT NULL DEFAULT 'duplicate_student_consolidation',
  source text NOT NULL DEFAULT 'merge_duplicate_student',
  "beforeCounts" jsonb NOT NULL,
  "afterCounts" jsonb,
  "enrollmentActions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  conflicts jsonb NOT NULL DEFAULT '[]'::jsonb,
  canonical_student_id text,
  duplicate_student_id text,
  performed_by text,
  merged_at timestamp with time zone DEFAULT now(),
  before_counts jsonb DEFAULT '{}'::jsonb,
  after_counts jsonb DEFAULT '{}'::jsonb,
  enrollment_actions jsonb DEFAULT '{}'::jsonb,
  details jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT student_merge_audit_pkey PRIMARY KEY (id)
);

CREATE TABLE public.student_merge_audits (
  id text NOT NULL,
  canonical_id text NOT NULL,
  duplicate_id text NOT NULL,
  admin_id text,
  reason text,
  before_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_counts jsonb,
  enrollment_action jsonb,
  exam_conflicts jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  batch_id text,
  batch_policy text,
  batch_size integer,
  merge_kind text NOT NULL DEFAULT 'individual',
  CONSTRAINT student_merge_audits_pkey PRIMARY KEY (id)
);

CREATE TABLE public.student_merge_batches (
  id text NOT NULL,
  admin_id text,
  policy text NOT NULL DEFAULT 'safe_batch_parent_assigned_keeper',
  chunk_size integer NOT NULL,
  chunks_run integer NOT NULL DEFAULT 1,
  reason text,
  requested_pairs integer NOT NULL DEFAULT 0,
  merged_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  blocked_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  remaining_eligible integer,
  chunk_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT student_merge_batches_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- Row level security: enabled, policies pasted in separately (production has
-- them; this fixture leaves them out until the school sends pg_policies).
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'academic_years', 'announcements', 'attendance', 'exams', 'homework',
    'messages', 'profiles', 'quiz_attempts', 'quiz_questions', 'quizzes',
    'questions', 'students', 'student_lesson_progress', 'announcement_recipients',
    'release_log', 'authorized_pickups', 'authorized_pickup_students',
    'student_promotions', 'student_enrollments', 'report_comments', 'grade_uploads'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
