'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import type { ReportFormData } from '@/lib/validators/report';

interface UseReportEditOptions {
  onSuccess?: (reportId: string) => void;
  onError?: (error: string) => void;
}

interface EditParams {
  reportId: string;
  data: ReportFormData;
  photos: File[]; // New photos to append (for simplicity)
}

export function useReportEdit(options?: UseReportEditOptions) {
  const { user } = useAuth();
  const supabase = createClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const edit = async ({ reportId, data, photos }: EditParams) => {
    if (!user) {
      setError('Anda harus login untuk mengedit laporan');
      return null;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Update report
      const { error: reportError } = await supabase
        .from('reports')
        .update({
          location: `SRID=4326;POINT(${data.lng} ${data.lat})`,
          address: data.address || null,
          description: data.description || null,
          severity: data.severity,
          water_height_cm: data.water_height_cm || null,
          is_surge_receding: data.is_surge_receding,
        })
        .eq('id', reportId)
        .eq('reporter_id', user.id);

      if (reportError) throw reportError;

      // 2. Upload new photos (if any)
      if (photos.length > 0) {
        const uploadPromises = photos.map(async (photo, i) => {
          const fileExt = photo.name.split('.').pop() || 'jpg';
          const filePath = `${user.id}/${reportId}/new_${Date.now()}_${i}.${fileExt}`;

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
        err instanceof Error ? err.message : 'Gagal mengedit laporan';
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
    edit,
    reset,
    isSubmitting,
    error,
    success,
  };
}
