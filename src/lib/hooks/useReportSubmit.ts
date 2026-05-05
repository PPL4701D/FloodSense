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
      // 1. Submit report via API route (handles spam detection + proximity notifications)
      const response = await fetch('/api/reports/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: data.lat,
          lng: data.lng,
          severity: data.severity,
          description: data.description || null,
          water_height_cm: data.water_height_cm || null,
          address: data.address || null,
          is_surge_receding: data.is_surge_receding,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal mengirim laporan');
      }

      const reportId = result.report_id;

      // 2. Upload photos
      if (photos.length > 0 && reportId) {
        const uploadPromises = photos.map(async (photo, i) => {
          const fileExt = photo.name.split('.').pop() || 'jpg';
          const filePath = `${user.id}/${reportId}/${i}.${fileExt}`;

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
              report_id: reportId,
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
      options?.onSuccess?.(reportId);
      return reportId;
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
