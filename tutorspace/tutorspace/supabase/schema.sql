-- ============================================================
--  TUTORAT PLATFORM — Supabase Schema
--  Exécuter dans l'éditeur SQL de Supabase
-- ============================================================

-- 1. PROFILES (étend auth.users)
CREATE TABLE public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email       TEXT NOT NULL,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger : crée un profil dès l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE WHEN NEW.email = 'farha.maouedj@proton.me' THEN 'admin' ELSE 'student' END,
    CASE WHEN NEW.email = 'farha.maouedj@proton.me' THEN TRUE ELSE FALSE END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. MATIÈRES
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

-- 3. EXERCICES
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

-- 4. CANVAS DATA (tracés sauvegardés)
CREATE TABLE public.canvas_data (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  panel       TEXT NOT NULL CHECK (panel IN ('left', 'right')),  -- left=prof énoncé, right=élève travail
  strokes     JSONB NOT NULL DEFAULT '[]',   -- tableau de tracés [{points, color, width, tool}]
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exercise_id, user_id, panel)
);

-- 5. MESSAGES VOCAUX
CREATE TABLE public.voice_messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role_type   TEXT NOT NULL CHECK (role_type IN ('prof_explanation', 'student_question')),
  audio_url   TEXT NOT NULL,
  duration    INTEGER,  -- secondes
  transcript  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ANNOTATIONS PROF (corrections sur travail élève)
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
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_data    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations    ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Lecture profil propre" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ));
CREATE POLICY "Mise à jour profil propre" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- SUBJECTS (lecture pour tous les approuvés)
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
CREATE POLICY "Écriture canvas propre" ON public.canvas_data
  FOR ALL USING (user_id = auth.uid());

-- VOICE MESSAGES
CREATE POLICY "Lecture voix" ON public.voice_messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_approved = TRUE
  ));
CREATE POLICY "Écriture voix propre" ON public.voice_messages
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
-- STORAGE BUCKETS (créer dans le dashboard Supabase Storage)
-- ============================================================
-- Bucket 1 : "exercise-files"  (PDFs et images des exercices)
-- Bucket 2 : "voice-messages"  (fichiers audio WebM/MP4)
-- Policies : lecture pour is_approved=true, écriture pour admin (exercise-files) / tous approuvés (voice-messages)
