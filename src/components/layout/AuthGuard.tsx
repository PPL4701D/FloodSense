'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { UserRole } from '@/types/database';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  fallbackUrl?: string;
}

export default function AuthGuard({
  children,
  allowedRoles,
  fallbackUrl = '/login',
}: AuthGuardProps) {
  const { isAuthenticated, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.push(`${fallbackUrl}?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    if (allowedRoles && role && !allowedRoles.includes(role)) {
      router.push('/');
    }
  }, [loading, isAuthenticated, role, allowedRoles, router, fallbackUrl]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <Loader2 size={32} color="var(--primary-400)" className="animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (allowedRoles && role && !allowedRoles.includes(role)) return null;

  return <>{children}</>;
}
