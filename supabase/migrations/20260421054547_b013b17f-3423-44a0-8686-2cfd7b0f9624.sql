
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by everyone"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Enhancements history
CREATE TABLE public.enhancements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('image','video','webcam','sample')),
  thumbnail_url TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.enhancements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own enhancements"
  ON public.enhancements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own enhancements"
  ON public.enhancements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own enhancements"
  ON public.enhancements FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own enhancements"
  ON public.enhancements FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_enhancements_user_created ON public.enhancements(user_id, created_at DESC);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_enhancements_updated_at
  BEFORE UPDATE ON public.enhancements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for enhancement thumbnails (private, per-user folders)
INSERT INTO storage.buckets (id, name, public) VALUES ('enhancements', 'enhancements', false);

CREATE POLICY "Users read own enhancement files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'enhancements' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own enhancement files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'enhancements' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own enhancement files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'enhancements' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own enhancement files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'enhancements' AND auth.uid()::text = (storage.foldername(name))[1]);
