'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { reportSchema, type ReportFormInput } from '@/lib/validators/report';
import { useAuth } from '@/lib/hooks/useAuth';
import { useReportSubmit } from '@/lib/hooks/useReportSubmit';
import {
  SEVERITY_LABELS,
  WATER_HEIGHT_PRESETS,
  type SeverityLevel,
} from '@/types/database';
import {
  MapPin, Camera, Send, Loader2, AlertCircle, ChevronLeft,
  Droplets, X, CheckCircle2, Navigation, ArrowDown,
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import dynamic from 'next/dynamic';
import WaveLoader from '@/components/ui/WaveLoader';

const LocationPickerMap = dynamic(() => import('@/components/map/LocationPickerMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '240px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <WaveLoader size={48} />
    </div>
  )
});

import LocationSearch from '@/components/map/LocationSearch';

const SEVERITY_OPTIONS: { value: SeverityLevel; label: string; color: string; desc: string }[] = [
  { value: 'ringan', label: 'Ringan', color: '#22c55e', desc: 'Genangan < 15 cm' },
  { value: 'sedang', label: 'Sedang', color: '#eab308', desc: 'Genangan 15-50 cm' },
  { value: 'berat', label: 'Berat', color: '#f97316', desc: 'Genangan 50-150 cm' },
  { value: 'sangat_berat', label: 'Sangat Berat', color: '#ef4444', desc: 'Genangan > 150 cm' },
];

export default function ReportNewPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const {
    submit: submitReport,
    isSubmitting,
    error: submitError,
    success: submitSuccess,
  } = useReportSubmit({
    onSuccess: () => {
      setTimeout(() => router.push('/'), 2000);
    },
  });

  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReportFormInput>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      is_surge_receding: false,
      water_height_cm: null,
    },
  });

  const watchLat = watch('lat');
  const watchLng = watch('lng');
  const watchSeverity = watch('severity');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/report/new');
    }
  }, [authLoading, isAuthenticated, router]);

  // Reverse geocode: convert lat/lng → address via Nominatim
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=id`,
        { headers: { 'User-Agent': 'FloodSense-PWA/1.0' } }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data?.display_name) {
        // Build a concise address: road, village/suburb, city
        const a = data.address || {};
        const parts = [
          a.road,
          a.village || a.suburb || a.neighbourhood,
          a.city || a.town || a.county,
        ].filter(Boolean);
        const address = parts.length > 0 ? parts.join(', ') : data.display_name;
        setValue('address', address);
      }
    } catch {
      // Silently fail — address is optional
    }
  }, [setValue]);

  const getLocation = useCallback(() => {
    setIsLocating(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation tidak didukung browser Anda');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setValue('lat', lat);
        setValue('lng', lng);
        setIsLocating(false);
        reverseGeocode(lat, lng);
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Akses lokasi ditolak. Izinkan akses lokasi di pengaturan browser.');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Lokasi tidak tersedia. Pastikan GPS aktif.');
            break;
          case error.TIMEOUT:
            setLocationError('Waktu mendapatkan lokasi habis. Coba lagi.');
            break;
        }
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [setValue, reverseGeocode]);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  const handlePhotoAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (photos.length + files.length > 3) {
      alert('Maksimal 3 foto');
      return;
    }
    const compressedFiles: File[] = [];
    const urls: string[] = [];
    for (const file of files) {
      try {
        const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
        compressedFiles.push(compressed as File);
        urls.push(URL.createObjectURL(compressed));
      } catch {
        compressedFiles.push(file);
        urls.push(URL.createObjectURL(file));
      }
    }
    setPhotos((prev) => [...prev, ...compressedFiles]);
    setPhotoPreviewUrls((prev) => [...prev, ...urls]);
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviewUrls[index]);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: ReportFormInput) => {
    await submitReport({
      data: data as import('@/lib/validators/report').ReportFormData,
      photos,
    });
  };

  if (submitSuccess) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'var(--bg-primary)' }}>
        <div className="animate-fade-in" style={{ textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-full)', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <CheckCircle2 size={40} color="#22c55e" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Laporan Terkirim!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Terima kasih atas laporan Anda. Tim kami akan memverifikasi segera.</p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <WaveLoader size={48} />
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Fixed Header */}
      <div className="glass" style={{
        flexShrink: 0, position: 'relative', zIndex: 100,
        padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
        borderBottom: '1px solid rgba(51,65,85,0.5)',
      }}>
        <button onClick={() => step > 1 ? setStep(step - 1) : router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}>
          <ChevronLeft size={20} color="var(--text-primary)" />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1rem', fontWeight: 700 }}>Lapor Banjir</h1>
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Langkah {step} dari 4</p>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[1, 2, 3, 4].map((s) => (
            <div key={s} style={{
              width: s <= step ? '20px' : '8px', height: '4px',
              borderRadius: 'var(--radius-full)',
              background: s <= step ? 'var(--primary-500)' : 'var(--border-primary)',
              transition: 'all var(--transition-normal)',
            }} />
          ))}
        </div>
      </div>

      {submitError && (
        <div className="animate-slide-down" style={{
          flexShrink: 0, margin: '0.75rem 1rem 0',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          fontSize: '0.8125rem', color: '#ef4444',
        }}>
          <AlertCircle size={16} />
          {submitError}
        </div>
      )}

      {/* Scrollable form area */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ padding: '1rem 1rem 2rem', maxWidth: '480px', margin: '0 auto' }}>

            {/* STEP 1: Location */}
            {step === 1 && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-full)', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                    <MapPin size={24} color="var(--primary-400)" />
                  </div>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.375rem' }}>Lokasi Banjir</h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Kami akan menggunakan GPS Anda untuk menentukan lokasi</p>
                </div>

                {isLocating ? (
                  <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}><WaveLoader size={48} /></div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Mencari lokasi...</p>
                  </div>
                ) : locationError ? (
                  <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <AlertCircle size={24} color="#ef4444" style={{ margin: '0 auto 0.75rem' }} />
                    <p style={{ fontSize: '0.8125rem', color: '#ef4444', marginBottom: '1rem' }}>{locationError}</p>
                    <button type="button" onClick={getLocation} className="btn btn-primary" style={{ width: '100%' }}>
                      <Navigation size={16} /> Coba Lagi
                    </button>
                  </div>
                ) : watchLat && watchLng ? (
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'visible' }}>
                    <LocationSearch onSelect={(lat: number, lng: number) => { setValue('lat', lat); setValue('lng', lng); reverseGeocode(lat, lng); }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CheckCircle2 size={20} color="#22c55e" />
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>Lokasi Ditemukan</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{watchLat.toFixed(6)}, {watchLng.toFixed(6)}</p>
                      </div>
                    </div>
                    <LocationPickerMap lat={watchLat} lng={watchLng} onChange={(lat: number, lng: number) => { setValue('lat', lat); setValue('lng', lng); reverseGeocode(lat, lng); }} />
                    <div>
                      <label htmlFor="address" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>Alamat (opsional)</label>
                      <input id="address" type="text" className="input" placeholder="Jl. Contoh No. 123, Kelurahan..." {...register('address')} />
                    </div>
                  </div>
                ) : null}

                {watchLat && watchLng && (
                  <button type="button" onClick={() => setStep(2)} className="btn btn-primary" style={{ width: '100%' }}>
                    Lanjut <ArrowDown size={16} style={{ transform: 'rotate(-90deg)' }} />
                  </button>
                )}
              </div>
            )}

            {/* STEP 2: Severity & Description */}
            {step === 2 && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.375rem' }}>Tingkat Keparahan</h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Pilih yang paling mendekati kondisi banjir</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {SEVERITY_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setValue('severity', opt.value)} className="card"
                      style={{ padding: '1rem', cursor: 'pointer', textAlign: 'center', borderColor: watchSeverity === opt.value ? opt.color : 'var(--border-primary)', background: watchSeverity === opt.value ? `${opt.color}10` : 'var(--bg-card)', transition: 'all var(--transition-fast)' }}
                    >
                      <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-full)', background: `${opt.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem' }}>
                        <Droplets size={16} color={opt.color} />
                      </div>
                      <p style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '0.25rem' }}>{opt.label}</p>
                      <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
                {errors.severity && <p style={{ fontSize: '0.75rem', color: '#ef4444' }}>{errors.severity.message}</p>}

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Ketinggian Air (opsional)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {WATER_HEIGHT_PRESETS.map((preset) => (
                      <button key={preset.value} type="button" onClick={() => setValue('water_height_cm', preset.value)} className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.5rem 0.75rem', borderColor: watch('water_height_cm') === preset.value ? 'var(--primary-500)' : 'var(--border-primary)', background: watch('water_height_cm') === preset.value ? 'rgba(59,130,246,0.1)' : 'var(--bg-elevated)' }}
                      >
                        {preset.label} ({preset.range})
                      </button>
                    ))}
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" {...register('is_surge_receding')} style={{ width: '18px', height: '18px', accentColor: 'var(--primary-500)' }} />
                  <div>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Air sudah mulai surut</p>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Centang jika level air mulai menurun</p>
                  </div>
                </label>

                <div>
                  <label htmlFor="description" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>Deskripsi (opsional)</label>
                  <textarea id="description" className="input" rows={3} placeholder="Kondisi banjir, dampak, kerusakan..." style={{ resize: 'vertical', minHeight: '80px' }} {...register('description')} />
                </div>

                <button type="button" onClick={() => setStep(3)} className="btn btn-primary" style={{ width: '100%' }} disabled={!watchSeverity}>
                  Lanjut ke Foto
                </button>
              </div>
            )}

            {/* STEP 3: Photos */}
            {step === 3 && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-full)', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                    <Camera size={24} color="var(--primary-400)" />
                  </div>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.375rem' }}>Foto Banjir</h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Tambahkan hingga 3 foto (opsional, meningkatkan kredibilitas)</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  {photoPreviewUrls.map((url, i) => (
                    <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
                      <img src={url} alt={`Foto ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button" onClick={() => removePhoto(i)}
                        style={{ position: 'absolute', top: '4px', right: '4px', width: '24px', height: '24px', borderRadius: 'var(--radius-full)', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={12} color="white" />
                      </button>
                    </div>
                  ))}
                  {photos.length < 3 && (
                    <label style={{ aspectRatio: '1', borderRadius: 'var(--radius-md)', border: '2px dashed var(--border-primary)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                      <Camera size={20} color="var(--text-muted)" />
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Tambah</span>
                      <input type="file" accept="image/*" capture="environment" onChange={handlePhotoAdd} multiple style={{ display: 'none' }} />
                    </label>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" onClick={() => setStep(4)} className="btn btn-secondary" style={{ flex: 1 }}>Lewati</button>
                  <button type="button" onClick={() => setStep(4)} className="btn btn-primary" style={{ flex: 1 }} disabled={photos.length === 0}>Lanjut</button>
                </div>
              </div>
            )}

            {/* STEP 4: Review */}
            {step === 4 && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Tinjau Laporan</h2>

                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <MapPin size={16} color="var(--primary-400)" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lokasi</p>
                      <p style={{ fontSize: '0.8125rem' }}>{watchLat?.toFixed(6)}, {watchLng?.toFixed(6)}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <Droplets size={16} color={SEVERITY_OPTIONS.find(o => o.value === watchSeverity)?.color || 'var(--text-muted)'} style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tingkat Keparahan</p>
                      <span className={`badge badge-severity-${watchSeverity}`}>{watchSeverity ? SEVERITY_LABELS[watchSeverity] : '-'}</span>
                    </div>
                  </div>
                  {watch('water_height_cm') && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <ArrowDown size={16} color="var(--primary-400)" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ketinggian Air</p>
                        <p style={{ fontSize: '0.8125rem' }}>{watch('water_height_cm')} cm</p>
                      </div>
                    </div>
                  )}
                  {photos.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <Camera size={16} color="var(--primary-400)" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Foto</p>
                        <p style={{ fontSize: '0.8125rem' }}>{photos.length} foto terlampir</p>
                      </div>
                    </div>
                  )}
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Mengirim Laporan...</>
                  ) : (
                    <><Send size={16} /> Kirim Laporan</>
                  )}
                </button>
              </div>
            )}

          </div>
        </form>
      </div>
    </div>
  );
}
