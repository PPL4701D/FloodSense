'use client';

import { useEffect, useState, useCallback } from 'react';
import WaveLoader from '@/components/ui/WaveLoader';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import {
  Bell, ChevronLeft, Loader2, MapPin, Plus,
  X, CheckCircle2, Settings,
} from 'lucide-react';

interface RegionPref {
  id: string;
  region_id: string;
  region_name: string;
}

export default function NotificationPrefsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [prefs, setPrefs] = useState<RegionPref[]>([]);
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchPrefs = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from('user_region_preferences')
      .select('id, region_id, regions!user_region_preferences_region_id_fkey(name)')
      .eq('user_id', user.id);

    if (data) {
      setPrefs(data.map((d: Record<string, unknown>) => ({
        id: d.id as string,
        region_id: d.region_id as string,
        region_name: (d.regions as Record<string, unknown>)?.name as string || 'Unknown',
      })));
    }

    // Fetch available regions
    const { data: allRegions } = await supabase
      .from('regions')
      .select('id, name')
      .in('level', ['province', 'city'])
      .order('name')
      .limit(200);
    setRegions(allRegions || []);

    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    if (user) fetchPrefs();
  }, [user, fetchPrefs]);

  const handleAdd = async () => {
    if (!selectedRegion || !user) return;
    setAdding(true);

    await supabase.from('user_region_preferences').insert({
      user_id: user.id,
      region_id: selectedRegion,
    });

    setSelectedRegion('');
    setAdding(false);
    fetchPrefs();
  };

  const handleRemove = async (id: string) => {
    await supabase.from('user_region_preferences').delete().eq('id', id);
    fetchPrefs();
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <WaveLoader size={48} />
      </div>
    );
  }

  return (
    <div className="page-scroll" style={{ paddingBottom: '100px' }}>
      <div style={{
        padding: '1rem', background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-primary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}>
            <ChevronLeft size={20} color="var(--text-primary)" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={20} color="var(--primary-400)" />
              Preferensi Notifikasi
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Pilih wilayah untuk menerima notifikasi banjir
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <WaveLoader size={48} />
          </div>
        ) : (
          <>
            {/* Add Region */}
            <div className="card" style={{ padding: '0.75rem', marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Tambah Wilayah
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  style={{
                    flex: 1, padding: '8px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                    fontSize: '0.75rem',
                  }}
                >
                  <option value="">Pilih wilayah...</option>
                  {regions
                    .filter((r) => !prefs.some((p) => p.region_id === r.id))
                    .map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                </select>
                <button
                  onClick={handleAdd}
                  disabled={!selectedRegion || adding}
                  className="btn btn-primary"
                  style={{
                    padding: '8px 16px',
                    opacity: !selectedRegion || adding ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>
              {regions.length === 0 && (
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Data wilayah belum tersedia. Hubungi admin.
                </p>
              )}
            </div>

            {/* Current Preferences */}
            <div>
              <p style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Wilayah Pilihan ({prefs.length})
              </p>
              {prefs.length === 0 ? (
                <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <MapPin size={32} strokeWidth={1} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Belum ada wilayah yang dipilih.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {prefs.map((p) => (
                    <div key={p.id} className="card" style={{
                      padding: '0.75rem',
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                    }}>
                      <MapPin size={14} color="var(--primary-400)" />
                      <span style={{ flex: 1, fontSize: '0.8125rem' }}>{p.region_name}</span>
                      <button
                        onClick={() => handleRemove(p.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '4px', display: 'flex',
                        }}
                      >
                        <X size={14} color="var(--text-muted)" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
