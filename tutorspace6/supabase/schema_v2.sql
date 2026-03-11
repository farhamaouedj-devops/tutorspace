-- ============================================================
--  TUTORAT PLATFORM v2 — Supabase Schema COMPLET
--  Dans SQL Editor : sélectionner tout et Run
-- ============================================================

-- Supprimer les anciennes tables si elles existent
DROP TABLE IF EXISTS public.annotations CASCADE;
DROP TABLE IF EXISTS public.voice_messages CASCADE;
DROP TABLE IF EXISTS public.canvas_data CASCADE;
DROP TABLE IF EXISTS public.exercises CASCADE;
DROP TABLE IF EXISTS public.subjects CASCADE;
DROP TABLE IF EXISTS public.student_prof CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 1. PROFILES
CREATE TABLE public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email       TEXT NOT NULL,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  prof_code   TEXT UNIQUE,  -- code unique généré pour chaque prof
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ASSOCIATION ÉLÈVE ↔ PROF
CREATE TABLE public.student_prof (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  prof_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, prof_id)
);

-- 3. MATIÈRES
CREATE TABLE public.subjects (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  icon       TEXT NOT NULL DEFAULT '📚',
  color      TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.subjects (name, icon, color) VALUES
  ('Mathématiques', '📐', '#f59e0b'),
  ('Français',      '✏️', '#10b981'),
  ('Sciences',      '🔬', '#3b82f6'),
  ('Histoire',      '🏛️', '#8b5cf6'),
  ('Anglais',       '🌍', '#ef4444'),
  ('Philosophie',   '💭', '#06b6d4');

-- 4. EXERCICES
CREATE TABLE public.exercises (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id   UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  pdf_url      TEXT,
  image_url    TEXT,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CANVAS DATA
CREATE TABLE public.canvas_data (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  panel       TEXT NOT NULL CHECK (panel IN ('left', 'right')),
  strokes     JSONB NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exercise_id, user_id, panel)
);

-- 6. MESSAGES VOCAUX
CREATE TABLE public.voice_messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role_type   TEXT NOT NULL CHECK (role_type IN ('prof_explanation', 'student_question')),
  audio_url   TEXT NOT NULL,
  duration    INTEGER,
  transcript  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ANNOTATIONS
CREATE TABLE public.annotations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE CASCADE NOT NULL,
  student_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  strokes     JSONB NOT NULL DEFAULT '[]',
  comment     TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exercise_id, student_id)
);

-- ============================================================
-- TRIGGER : crée un profil à l'inscription
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
  user_approved BOOLEAN;
  user_prof_code TEXT;
BEGIN
  -- Récupérer les métadonnées
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  
  -- L'admin principal est toujours approuvé
  IF NEW.email = 'farha.maouedj@proton.me' THEN
    user_role := 'admin';
    user_approved := TRUE;
    user_prof_code := substring(md5(random()::text) from 1 for 8);
  ELSIF user_role = 'admin' THEN
    -- Un prof s'inscrit avec le bon rôle
    user_approved := FALSE; -- le prof principal doit valider
    user_prof_code := substring(md5(random()::text) from 1 for 8);
  ELSE
    user_approved := FALSE;
    user_prof_code := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, is_approved, prof_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    user_role,
    user_approved,
    user_prof_code
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_prof   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_data    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations    ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Lecture profil" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ));
CREATE POLICY "Lecture profil code" ON public.profiles
  FOR SELECT USING (true); -- permet de chercher un prof par son code à l'inscription
CREATE POLICY "Update profil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- STUDENT_PROF
CREATE POLICY "Lecture associations" ON public.student_prof
  FOR SELECT USING (
    student_id = auth.uid() OR prof_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
CREATE POLICY "Création association" ON public.student_prof
  FOR INSERT WITH CHECK (student_id = auth.uid());

-- SUBJECTS
CREATE POLICY "Lecture matières" ON public.subjects
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_approved = TRUE
  ));
CREATE POLICY "CRUD matières admin" ON public.subjects
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- EXERCISES
CREATE POLICY "Lecture exercices" ON public.exercises
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_approved = TRUE
  ));
CREATE POLICY "CRUD exercices admin" ON public.exercises
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- CANVAS DATA
CREATE POLICY "Lecture canvas" ON public.canvas_data
  FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
CREATE POLICY "Ecriture canvas" ON public.canvas_data
  FOR ALL USING (user_id = auth.uid());

-- VOICE MESSAGES
CREATE POLICY "Lecture voix" ON public.voice_messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_approved = TRUE
  ));
CREATE POLICY "Ecriture voix" ON public.voice_messages
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ANNOTATIONS
CREATE POLICY "Lecture annotations" ON public.annotations
  FOR SELECT USING (
    student_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
CREATE POLICY "CRUD annotations admin" ON public.annotations
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- ============================================================
-- STORAGE POLICIES
-- ============================================================
CREATE POLICY "Public read exercise-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'exercise-files');

CREATE POLICY "Public read voice-messages"
ON storage.objects FOR SELECT
USING (bucket_id = 'voice-messages');

CREATE POLICY "Auth upload exercise-files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'exercise-files' AND auth.role() = 'authenticated');

CREATE POLICY "Auth upload voice-messages"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'voice-messages' AND auth.role() = 'authenticated');

-- ============================================================
-- REMETTRE LE COMPTE ADMIN À JOUR
-- ============================================================
UPDATE public.profiles
SET is_approved = TRUE, role = 'admin', prof_code = substring(md5(random()::text) from 1 for 8)
WHERE email = 'farha.maouedj@proton.me';

UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'farha.maouedj@proton.me';
