'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import type { ReportFormData } from '@/lib/validators/report';

interface UseReportSubmitOptions {
  onSuccess?: (reportId: string) => void;
  onError?: (error: string) => void;
}

interface SubmitParams {
  data: ReportFormData;
  photos: File[];
}

export function useReportSubmit(options?: UseReportSubmitOptions) {
  const { user } = useAuth();
  const supabase = createClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async ({ data, photos }: SubmitParams) => {
    if (!user) {
      setError('Anda harus login untuk mengirim laporan');
      return null;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Insert report
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          location: `SRID=4326;POINT(${data.lng} ${data.lat})`,
          address: data.address || null,
          description: data.description || null,
          severity: data.severity,
          water_height_cm: data.water_height_cm || null,
          is_surge_receding: data.is_surge_receding,
        })
        .select('id')
        .single();

      if (reportError) throw reportError;

      // 2. Upload photos
      if (photos.length > 0 && report) {
        const uploadPromises = photos.map(async (photo, i) => {
          const fileExt = photo.name.split('.').pop() || 'jpg';
          const filePath = `${user.id}/${report.id}/${i}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('flood-photos')
            .upload(filePath, photo, { cacheControl: '3600', upsert: false });

          if (uploadError) {
            console.error(`Photo ${i} upload error:`, uploadError);
            return null;
          }

          // Insert photo record
          const { error: photoRecordError } = await supabase
            .from('report_photos')
            .insert({
              report_id: report.id,
              storage_path: filePath,
            });

          if (photoRecordError) {
            console.error(`Photo ${i} record error:`, photoRecordError);
          }

          return filePath;
        });

        await Promise.allSettled(uploadPromises);
      }

      setSuccess(true);
      options?.onSuccess?.(report.id);
      return report.id;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Gagal mengirim laporan';
      setError(errorMessage);
      options?.onError?.(errorMessage);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setError(null);
    setSuccess(false);
    setIsSubmitting(false);
  };

  return {
    submit,
    reset,
    isSubmitting,
    error,
    success,
  };
}
