-- FR-058 (PBI-33) — Preferensi Notifikasi Lanjutan
-- Toggle per jenis notifikasi + jam tenang (quiet hours) per pengguna.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status_change boolean NOT NULL DEFAULT true,
  report_verified boolean NOT NULL DEFAULT true,
  report_rejected boolean NOT NULL DEFAULT true,
  broadcast boolean NOT NULL DEFAULT true,
  area_status_update boolean NOT NULL DEFAULT true,
  quiet_start smallint,           -- jam 0..23 (null = jam tenang nonaktif)
  quiet_end smallint,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_prefs_select_own ON public.notification_preferences;
CREATE POLICY notif_prefs_select_own ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notif_prefs_insert_own ON public.notification_preferences;
CREATE POLICY notif_prefs_insert_own ON public.notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS notif_prefs_update_own ON public.notification_preferences;
CREATE POLICY notif_prefs_update_own ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
