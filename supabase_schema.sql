-- ==============================================================================
-- AI INTERVIEW BOOTH - COMPLETE SUPABASE SCHEMA & STORED PROCEDURES
-- ==============================================================================
-- Run this complete script in your Supabase Dashboard:
-- Go to https://supabase.com/dashboard -> Select your project -> SQL Editor -> New query -> Paste & Run
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. INTERVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  job_description TEXT NOT NULL,
  recruiter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_practice BOOLEAN NOT NULL DEFAULT false,
  target_role TEXT,
  target_company TEXT,
  target_level TEXT,
  interviewer_personality TEXT,
  is_panel_mode BOOLEAN NOT NULL DEFAULT false
);

-- 2. QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0
);

-- 3. SESSIONS (Interview attempts / results)
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  interview_id UUID REFERENCES public.interviews(id) ON DELETE SET NULL,
  overall_score NUMERIC(5,2),
  overall_feedback TEXT,
  candidate_email TEXT,
  candidate_name TEXT
);

-- 4. SESSION ANSWERS
CREATE TABLE IF NOT EXISTS public.session_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  answer_text TEXT,
  score NUMERIC(5,2),
  strengths TEXT,
  improvements TEXT,
  order_index INT NOT NULL DEFAULT 0,
  category TEXT
);

-- 5. CODING QUESTIONS
CREATE TABLE IF NOT EXISTS public.coding_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  starter_code JSONB NOT NULL DEFAULT '{}'::jsonb,
  test_cases JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 6. CODING SESSIONS
CREATE TABLE IF NOT EXISTS public.coding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  interview_id UUID REFERENCES public.interviews(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  coding_question_id UUID REFERENCES public.coding_questions(id) ON DELETE SET NULL,
  language TEXT,
  submitted_code TEXT,
  test_results JSONB DEFAULT '[]'::jsonb,
  tests_passed INT DEFAULT 0,
  tests_total INT DEFAULT 0,
  ai_score NUMERIC(5,2),
  ai_feedback TEXT
);

-- 7. PREP PACKS (Company specific question sets)
CREATE TABLE IF NOT EXISTS public.prep_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  company_id TEXT UNIQUE NOT NULL,
  company_label TEXT NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_curated BOOLEAN NOT NULL DEFAULT false
);

-- 8. WEEKLY CHALLENGES
CREATE TABLE IF NOT EXISTS public.weekly_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  question_text TEXT NOT NULL,
  week_start_date DATE UNIQUE NOT NULL
);

-- 9. WEEKLY CHALLENGE ATTEMPTS
CREATE TABLE IF NOT EXISTS public.weekly_challenge_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  challenge_id UUID REFERENCES public.weekly_challenges(id) ON DELETE CASCADE NOT NULL,
  candidate_email TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  score NUMERIC(5,2),
  strengths TEXT,
  improvements TEXT,
  CONSTRAINT unique_challenge_candidate UNIQUE (challenge_id, candidate_email)
);

-- ==============================================================================
-- INDEXES FOR HIGH PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_questions_interview_id ON public.questions(interview_id);
CREATE INDEX IF NOT EXISTS idx_sessions_interview_id ON public.sessions(interview_id);
CREATE INDEX IF NOT EXISTS idx_sessions_candidate_email ON public.sessions(LOWER(candidate_email));
CREATE INDEX IF NOT EXISTS idx_session_answers_session_id ON public.session_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_coding_questions_interview_id ON public.coding_questions(interview_id);
CREATE INDEX IF NOT EXISTS idx_coding_sessions_session_id ON public.coding_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_weekly_attempts_candidate ON public.weekly_challenge_attempts(LOWER(candidate_email));

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prep_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_challenge_attempts ENABLE ROW LEVEL SECURITY;

-- Allow anonymous + authenticated users access
DO $$
BEGIN
  -- interviews
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'interviews' AND policyname = 'Allow all access to interviews') THEN
    CREATE POLICY "Allow all access to interviews" ON public.interviews FOR ALL USING (true) WITH CHECK (true);
  END IF;
  
  -- questions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'questions' AND policyname = 'Allow all access to questions') THEN
    CREATE POLICY "Allow all access to questions" ON public.questions FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- sessions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'Allow all access to sessions') THEN
    CREATE POLICY "Allow all access to sessions" ON public.sessions FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- session_answers
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_answers' AND policyname = 'Allow all access to session_answers') THEN
    CREATE POLICY "Allow all access to session_answers" ON public.session_answers FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- coding_questions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coding_questions' AND policyname = 'Allow all access to coding_questions') THEN
    CREATE POLICY "Allow all access to coding_questions" ON public.coding_questions FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- coding_sessions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coding_sessions' AND policyname = 'Allow all access to coding_sessions') THEN
    CREATE POLICY "Allow all access to coding_sessions" ON public.coding_sessions FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- prep_packs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prep_packs' AND policyname = 'Allow all access to prep_packs') THEN
    CREATE POLICY "Allow all access to prep_packs" ON public.prep_packs FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- weekly_challenges
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_challenges' AND policyname = 'Allow all access to weekly_challenges') THEN
    CREATE POLICY "Allow all access to weekly_challenges" ON public.weekly_challenges FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- weekly_challenge_attempts
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_challenge_attempts' AND policyname = 'Allow all access to weekly_challenge_attempts') THEN
    CREATE POLICY "Allow all access to weekly_challenge_attempts" ON public.weekly_challenge_attempts FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ==============================================================================
-- STORED FUNCTIONS / RPCs
-- ==============================================================================

-- 1. get_session_report
CREATE OR REPLACE FUNCTION public.get_session_report(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session JSONB;
  v_interview JSONB;
  v_answers JSONB;
  v_coding_session JSONB;
  v_coding_question JSONB;
BEGIN
  SELECT to_jsonb(s) INTO v_session FROM public.sessions s WHERE s.id = p_session_id;
  IF v_session IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(i) INTO v_interview FROM public.interviews i WHERE i.id = (v_session->>'interview_id')::UUID;
  
  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.order_index ASC), '[]'::jsonb)
  INTO v_answers
  FROM public.session_answers a
  WHERE a.session_id = p_session_id;

  SELECT to_jsonb(cs) INTO v_coding_session
  FROM public.coding_sessions cs
  WHERE cs.session_id = p_session_id
  ORDER BY cs.created_at DESC
  LIMIT 1;

  IF v_coding_session IS NOT NULL AND v_coding_session->>'coding_question_id' IS NOT NULL THEN
    SELECT to_jsonb(cq) INTO v_coding_question
    FROM public.coding_questions cq
    WHERE cq.id = (v_coding_session->>'coding_question_id')::UUID;
  END IF;

  RETURN jsonb_build_object(
    'session', v_session,
    'interview', v_interview,
    'answers', v_answers,
    'coding_session', v_coding_session,
    'coding_question', v_coding_question
  );
END;
$$;

-- 2. get_candidate_history
CREATE OR REPLACE FUNCTION public.get_candidate_history(p_email TEXT)
RETURNS TABLE (
  session_id UUID,
  interview_id UUID,
  interview_title TEXT,
  overall_score NUMERIC,
  created_at TIMESTAMPTZ,
  candidate_name TEXT,
  coding_ai_score NUMERIC,
  coding_tests_passed INT,
  coding_tests_total INT,
  coding_language TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS session_id,
    s.interview_id,
    COALESCE(i.target_role, i.job_description, 'Mock Interview') AS interview_title,
    s.overall_score,
    s.created_at,
    s.candidate_name,
    cs.ai_score AS coding_ai_score,
    cs.tests_passed AS coding_tests_passed,
    cs.tests_total AS coding_tests_total,
    cs.language AS coding_language
  FROM public.sessions s
  LEFT JOIN public.interviews i ON i.id = s.interview_id
  LEFT JOIN LATERAL (
    SELECT ai_score, tests_passed, tests_total, language
    FROM public.coding_sessions
    WHERE session_id = s.id
    ORDER BY created_at DESC
    LIMIT 1
  ) cs ON true
  WHERE LOWER(s.candidate_email) = LOWER(TRIM(p_email))
  ORDER BY s.created_at DESC;
END;
$$;

-- 3. get_candidate_session_detail
CREATE OR REPLACE FUNCTION public.get_candidate_session_detail(p_session_id UUID, p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT candidate_email INTO v_email FROM public.sessions WHERE id = p_session_id;
  IF v_email IS NULL OR LOWER(TRIM(v_email)) != LOWER(TRIM(p_email)) THEN
    RETURN NULL;
  END IF;
  RETURN public.get_session_report(p_session_id);
END;
$$;

-- 4. get_candidate_percentile
CREATE OR REPLACE FUNCTION public.get_candidate_percentile(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg_score NUMERIC;
  v_total_sessions INT;
  v_below_count INT;
  v_percentile INT;
BEGIN
  SELECT AVG(overall_score) INTO v_avg_score
  FROM public.sessions
  WHERE LOWER(candidate_email) = LOWER(TRIM(p_email)) AND overall_score IS NOT NULL;

  IF v_avg_score IS NULL THEN
    RETURN jsonb_build_object('percentile', NULL, 'sample_size', 0);
  END IF;

  SELECT COUNT(*) INTO v_total_sessions FROM public.sessions WHERE overall_score IS NOT NULL;
  SELECT COUNT(*) INTO v_below_count FROM public.sessions WHERE overall_score IS NOT NULL AND overall_score <= v_avg_score;

  IF v_total_sessions = 0 THEN
    v_percentile := 50;
  ELSE
    v_percentile := ROUND((v_below_count::NUMERIC / v_total_sessions::NUMERIC) * 100);
  END IF;

  RETURN jsonb_build_object('percentile', v_percentile, 'sample_size', v_total_sessions);
END;
$$;

-- 5. get_candidate_streak
CREATE OR REPLACE FUNCTION public.get_candidate_streak(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_sessions INT;
  v_last_active TIMESTAMPTZ;
  v_current_streak INT := 0;
  v_longest_streak INT := 0;
  v_prev_date DATE;
  v_temp_streak INT := 0;
  r RECORD;
BEGIN
  SELECT COUNT(*), MAX(created_at)
  INTO v_total_sessions, v_last_active
  FROM public.sessions
  WHERE LOWER(candidate_email) = LOWER(TRIM(p_email));

  IF v_total_sessions = 0 OR v_total_sessions IS NULL THEN
    RETURN jsonb_build_object('current_streak', 0, 'longest_streak', 0, 'total_sessions', 0, 'last_active_date', NULL);
  END IF;

  FOR r IN (
    SELECT DISTINCT DATE(created_at AT TIME ZONE 'Asia/Kolkata') as session_date
    FROM public.sessions
    WHERE LOWER(candidate_email) = LOWER(TRIM(p_email))
    ORDER BY session_date ASC
  ) LOOP
    IF v_prev_date IS NULL THEN
      v_temp_streak := 1;
    ELSIF r.session_date = v_prev_date + INTERVAL '1 day' THEN
      v_temp_streak := v_temp_streak + 1;
    ELSIF r.session_date > v_prev_date + INTERVAL '1 day' THEN
      v_temp_streak := 1;
    END IF;

    IF v_temp_streak > v_longest_streak THEN
      v_longest_streak := v_temp_streak;
    END IF;
    v_prev_date := r.session_date;
  END LOOP;

  IF v_prev_date = CURRENT_DATE OR v_prev_date = CURRENT_DATE - INTERVAL '1 day' THEN
    v_current_streak := v_temp_streak;
  ELSE
    v_current_streak := 0;
  END IF;

  RETURN jsonb_build_object(
    'current_streak', v_current_streak,
    'longest_streak', v_longest_streak,
    'total_sessions', v_total_sessions,
    'last_active_date', v_last_active
  );
END;
$$;

-- 6. get_weekly_challenge_stats
CREATE OR REPLACE FUNCTION public.get_weekly_challenge_stats(p_challenge_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INT;
  v_avg NUMERIC;
  v_high NUMERIC;
BEGIN
  SELECT
    COUNT(*),
    COALESCE(ROUND(AVG(score), 1), 0),
    COALESCE(MAX(score), 0)
  INTO v_total, v_avg, v_high
  FROM public.weekly_challenge_attempts
  WHERE challenge_id = p_challenge_id;

  RETURN jsonb_build_object(
    'total_attempts', v_total,
    'average_score', v_avg,
    'highest_score', v_high
  );
END;
$$;

-- 7. get_my_weekly_challenge_attempt
CREATE OR REPLACE FUNCTION public.get_my_weekly_challenge_attempt(p_challenge_id UUID, p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_res JSONB;
BEGIN
  SELECT to_jsonb(a)
  INTO v_res
  FROM public.weekly_challenge_attempts a
  WHERE a.challenge_id = p_challenge_id AND LOWER(a.candidate_email) = LOWER(TRIM(p_email))
  LIMIT 1;

  RETURN v_res;
END;
$$;
