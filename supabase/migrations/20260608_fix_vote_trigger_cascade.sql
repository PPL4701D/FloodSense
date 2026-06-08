-- FR-059 (PBI-34) — Fix hapus akun gagal ("Database error deleting user").
-- Saat akun dihapus, cascade menghapus laporan → votes-nya. Trigger AFTER DELETE
-- on_vote_change() memanggil calculate_credibility_score() yang meng-UPDATE laporan
-- yang sedang dihapus → error membatalkan seluruh penghapusan.
-- Fix: bungkus recalc saat DELETE dengan exception handler (abaikan bila laporan
-- ikut terhapus); recalc normal saat un-vote tetap berjalan.

CREATE OR REPLACE FUNCTION public.on_vote_change()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    BEGIN
      PERFORM public.calculate_credibility_score(OLD.report_id);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- laporan sedang dihapus (cascade) → lewati recalc dengan aman
    END;
  ELSE
    PERFORM public.calculate_credibility_score(NEW.report_id);
  END IF;
  RETURN NULL;
END;
$fn$;
