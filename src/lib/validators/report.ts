import { z } from 'zod';

const severityValues = ['ringan', 'sedang', 'berat', 'sangat_berat'] as const;

export const reportSchema = z.object({
  description: z
    .string()
    .max(500, 'Deskripsi maksimal 500 karakter')
    .optional(),
  severity: z.enum(severityValues),
  water_height_cm: z
    .number()
    .min(0, 'Ketinggian tidak boleh negatif')
    .max(500, 'Ketinggian maksimal 500 cm')
    .optional()
    .nullable(),
  is_surge_receding: z.boolean().default(false),
  lat: z.number().min(-11).max(6),
  lng: z.number().min(95).max(141),
  address: z.string().optional().nullable(),
});

// Input type (for useForm - before defaults applied)
export type ReportFormInput = z.input<typeof reportSchema>;
// Output type (for onSubmit - after defaults applied)
export type ReportFormData = z.infer<typeof reportSchema>;

