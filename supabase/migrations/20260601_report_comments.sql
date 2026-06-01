-- FR-048 — Report comments / discussion
-- Tabel komentar diskusi pada laporan banjir. Sudah diterapkan ke DB live.

CREATE TABLE IF NOT EXISTS public.report_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_comments_body_check CHECK (char_length(body) BETWEEN 1 AND 500)
);

CREATE INDEX IF NOT EXISTS idx_report_comments_report
  ON public.report_comments (report_id, created_at);

ALTER TABLE public.report_comments ENABLE ROW LEVEL SECURITY;

-- Semua orang boleh membaca (komentar dihapus ditampilkan sebagai placeholder di UI)
DROP POLICY IF EXISTS rc_select_all ON public.report_comments;
CREATE POLICY rc_select_all ON public.report_comments
  FOR SELECT USING (true);

-- Hanya user terautentikasi, hanya atas nama dirinya sendiri
DROP POLICY IF EXISTS rc_insert_auth ON public.report_comments;
CREATE POLICY rc_insert_auth ON public.report_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Soft-delete / edit oleh penulis sendiri atau admin
DROP POLICY IF EXISTS rc_update_own ON public.report_comments;
CREATE POLICY rc_update_own ON public.report_comments
  FOR UPDATE USING (
    (auth.uid() = user_id) OR (public.get_user_role() = 'admin'::public.user_role)
  ) WITH CHECK (true);
