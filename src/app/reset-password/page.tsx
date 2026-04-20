'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validators/auth';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Mail, Droplets, AlertCircle, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ResetPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const supabase = createClient();

  const onSubmit = async (data: ResetPasswordFormData) => {
    setServerError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/callback?redirect=/update-password`,
    });

    if (error) {
      setServerError(error.message);
      return;
    }
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="gradient-hero" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div className="animate-fade-in card" style={{ maxWidth: '420px', width: '100%', padding: '2rem', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '64px', height: '64px', borderRadius: 'var(--radius-full)',
            background: 'rgba(34,197,94,0.15)', marginBottom: '1rem'
          }}>
            <CheckCircle2 size={32} color="#22c55e" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Cek Email Anda</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Kami telah mengirimkan link reset password ke email Anda. Link berlaku selama 1 jam.
          </p>
          <Link href="/login" className="btn btn-primary" style={{ width: '100%' }}>
            Kembali ke Halaman Masuk
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-hero" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '64px', height: '64px', borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, var(--primary-600), #0891b2)',
            marginBottom: '1rem', boxShadow: '0 0 30px rgba(59,130,246,0.3)'
          }}>
            <Droplets size={32} color="white" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Reset Password</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Masukkan email untuk menerima link reset password
          </p>
        </div>

        <div className="card" style={{ padding: '1.75rem' }}>
          {serverError && (
            <div className="animate-slide-down" style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              marginBottom: '1.25rem', fontSize: '0.8125rem', color: '#ef4444'
            }}>
              <AlertCircle size={16} />
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="email" type="email" className={`input ${errors.email ? 'input-error' : ''}`}
                  style={{ paddingLeft: '2.5rem' }} placeholder="nama@email.com"
                  autoComplete="email" {...register('email')} />
              </div>
              {errors.email && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>{errors.email.message}</p>}
            </div>

            <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ width: '100%' }}>
              {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Mengirim...</> : 'Kirim Link Reset'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>
            <ArrowLeft size={14} /> Kembali ke Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
