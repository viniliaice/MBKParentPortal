-- Quiz System Tables
-- Each table uses IF NOT EXISTS so this migration is safe to re-run.

-- Question bank: teachers create questions here
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionBankId TEXT NOT NULL DEFAULT 'default',
  createdBy TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('multiple_choice', 'direct_answer')),
  prompt TEXT NOT NULL,
  options JSONB DEFAULT '[]'::jsonb,
  correctAnswer TEXT DEFAULT '',
  points INT DEFAULT 1,
  archived BOOL DEFAULT false,
  createdAt TIMESTAMPTZ DEFAULT now()
);

-- Quizzes: a collection of questions assigned to a class
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  classId TEXT NOT NULL,
  createdBy TEXT NOT NULL,
  openDate TIMESTAMPTZ NOT NULL,
  closeDate TIMESTAMPTZ NOT NULL,
  timeLimit INT DEFAULT NULL,
  shuffleQuestions BOOL DEFAULT true,
  shuffleOptions BOOL DEFAULT true,
  showResults BOOL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  createdAt TIMESTAMPTZ DEFAULT now()
);

-- Junction table: links quizzes to questions with snapshots
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quizId UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  questionId UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  orderIndex INT NOT NULL DEFAULT 0,
  promptSnapshot TEXT NOT NULL,
  optionsSnapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  typeSnapshot TEXT NOT NULL,
  correctAnswerSnapshot TEXT DEFAULT '',
  points INT NOT NULL DEFAULT 1,
  createdAt TIMESTAMPTZ DEFAULT now()
);

-- Student attempts: one per quiz per student
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quizId UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  studentId TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  score NUMERIC(5,2) DEFAULT 0,
  totalPoints NUMERIC(5,2) DEFAULT 0,
  startedAt TIMESTAMPTZ NOT NULL DEFAULT now(),
  submittedAt TIMESTAMPTZ DEFAULT now(),
  UNIQUE(quizId, studentId)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_quizzes_classId_status ON quizzes(classId, status);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quizId ON quiz_questions(quizId);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_studentId ON quiz_attempts(studentId);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quizId ON quiz_attempts(quizId);

-- Enable Row Level Security
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Open read policies (parents must see their children's data via application-level filtering)
CREATE POLICY IF NOT EXISTS "Read questions" ON questions FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Read quizzes" ON quizzes FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Read quiz_questions" ON quiz_questions FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Read quiz_attempts" ON quiz_attempts FOR SELECT USING (true);

-- Open insert/update policies
CREATE POLICY IF NOT EXISTS "Insert quiz_attempts" ON quiz_attempts FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Update quiz_attempts" ON quiz_attempts FOR UPDATE USING (true);
