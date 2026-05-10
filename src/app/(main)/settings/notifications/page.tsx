'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import WaveLoader from '@/components/ui/WaveLoader';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import {
  Bell, ChevronLeft, Loader2, MapPin, Plus,
  X, Crosshair, ChevronDown, ChevronUp,
} from 'lucide-react';

const LocationPickerMap = dynamic(() => import('@/components/map/LocationPickerMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
      <WaveLoader size={32} />
    </div>
  ),
});

const RADIUS_OPTIONS = [1, 3, 5];
const DEFAULT_LAT = -6.2088;
const DEFAULT_LNG = 106.8456;
const MAX_PREFS = 5;

interface LocationPref {
  id: string;
  label: string | null;
  lat: number;
  lng: number;
  radius_km: number;
}

export default function NotificationPrefsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [prefs, setPrefs] = useState<LocationPref[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [pickedLat, setPickedLat] = useState(DEFAULT_LAT);
  const [pickedLng, setPickedLng] = useState(DEFAULT_LNG);
  const [pickedLabel, setPickedLabel] = useState('');
  const [pickedRadius, setPickedRadius] = useState(5);

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
      .select('id, label, lat, lng, radius_km')
      .eq('user_id', user.id)
      .not('lat', 'is', null)
      .order('created_at', { ascending: true });

    if (data) {
      setPrefs(
        data
          .filter((d: any) => d.lat != null && d.lng != null)
          .map((d: any) => ({
            id: d.id as string,
            label: d.label as string | null,
            lat: d.lat as number,
            lng: d.lng as number,
            radius_km: (d.radius_km as number) || 5,
          }))
      );
    }

    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    if (user) fetchPrefs();
  }, [user, fetchPrefs]);

  const handleSave = async () => {
    if (!user || prefs.length >= MAX_PREFS) return;
    setSaving(true);
    setSaveError(null);

    const label = pickedLabel.trim() || `Titik ${prefs.length + 1}`;

    const { error } = await supabase.from('user_region_preferences').insert({
      user_id: user.id,
      lat: pickedLat,
      lng: pickedLng,
      radius_km: pickedRadius,
      label,
      region_id: null,
    });

    if (error) {
      setSaveError('Titik ini sudah ditambahkan sebelumnya. Pilih lokasi berbeda.');
      setSaving(false);
      return;
    }

    setShowForm(false);
    setPickedLabel('');
    setPickedRadius(5);
    setPickedLat(DEFAULT_LAT);
    setPickedLng(DEFAULT_LNG);
    await fetchPrefs();
    setSaving(false);
  };

  const handleRemove = async (id: string) => {
    setRemoving(id);
    await supabase.from('user_region_preferences').delete().eq('id', id);
    await fetchPrefs();
    setRemoving(null);
  };

  const openForm = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPickedLat(pos.coords.latitude);
          setPickedLng(pos.coords.longitude);
          setShowForm(true);
        },
        () => setShowForm(true),
        { timeout: 5000 }
      );
    } else {
      setShowForm(true);
    }
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
      {/* Header */}
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
              Tentukan titik pantauan untuk menerima notifikasi banjir
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
            {/* Add button */}
            {!showForm && prefs.length < MAX_PREFS && (
              <button
                onClick={openForm}
                className="btn btn-primary"
                style={{
                  width: '100%', padding: '0.75rem', marginBottom: '1rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  fontSize: '0.8125rem', fontWeight: 600,
                }}
              >
                <Plus size={16} />
                Tambah Titik Pantauan
              </button>
            )}

            {prefs.length >= MAX_PREFS && !showForm && (
              <div className="card" style={{ padding: '0.75rem', marginBottom: '1rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: '#f59e0b' }}>
                  Maksimal {MAX_PREFS} titik pantauan tercapai. Hapus salah satu untuk menambah yang baru.
                </p>
              </div>
            )}

            {/* Add form */}
            {showForm && (
              <div className="card animate-fade-in" style={{ padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Crosshair size={16} color="var(--primary-400)" />
                    Titik Pantauan Baru
                  </p>
                  <button
                    onClick={() => setShowForm(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
                  >
                    <X size={16} color="var(--text-muted)" />
                  </button>
                </div>

                <LocationPickerMap
                  lat={pickedLat}
                  lng={pickedLng}
                  onChange={(lat, lng) => { setPickedLat(lat); setPickedLng(lng); }}
                  radiusKm={pickedRadius}
                />

                <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
                  {pickedLat.toFixed(5)}, {pickedLng.toFixed(5)}
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <input
                    className="input"
                    type="text"
                    placeholder="Label (cth: Rumah, Kantor)"
                    value={pickedLabel}
                    onChange={(e) => setPickedLabel(e.target.value)}
                    maxLength={50}
                    style={{ flex: 1, fontSize: '0.8125rem' }}
                  />
                  <select
                    value={pickedRadius}
                    onChange={(e) => setPickedRadius(Number(e.target.value))}
                    style={{
                      width: '100px', padding: '8px',
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                    }}
                  >
                    {RADIUS_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r} km</option>
                    ))}
                  </select>
                </div>

                {saveError && (
                  <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem', textAlign: 'center' }}>
                    {saveError}
                  </p>
                )}

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn btn-primary"
                  style={{
                    width: '100%', padding: '0.75rem', marginTop: '0.75rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    fontSize: '0.8125rem', fontWeight: 600,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                  {saving ? 'Menyimpan...' : 'Simpan Titik'}
                </button>
              </div>
            )}

            {/* Saved preferences */}
            <div>
              <p style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Titik Pantauan ({prefs.length}/{MAX_PREFS})
              </p>
              {prefs.length === 0 ? (
                <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <MapPin size={32} strokeWidth={1} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Belum ada titik pantauan.
                  </p>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Tambahkan titik untuk menerima notifikasi banjir di sekitar lokasi tersebut.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {prefs.map((p) => {
                    const isExpanded = expandedId === p.id;
                    return (
                      <div key={p.id} className="card animate-fade-in" style={{
                        overflow: 'hidden',
                        opacity: removing === p.id ? 0.5 : 1,
                        transition: 'opacity 0.2s',
                      }}>
                        <div
                          onClick={() => setExpandedId(isExpanded ? null : p.id)}
                          style={{
                            padding: '0.75rem',
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: 'rgba(59,130,246,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <MapPin size={16} color="var(--primary-400)" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.label || 'Titik Pantauan'}
                            </p>
                            <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                              {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                            </p>
                          </div>
                          <span style={{
                            fontSize: '0.6875rem', fontWeight: 600,
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                            borderRadius: 'var(--radius-md)', padding: '2px 8px',
                            color: 'var(--primary-400)', whiteSpace: 'nowrap',
                          }}>
                            {p.radius_km} km
                          </span>
                          {isExpanded
                            ? <ChevronUp size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                            : <ChevronDown size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemove(p.id); }}
                            disabled={removing === p.id}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              padding: '4px', display: 'flex', flexShrink: 0,
                            }}
                          >
                            {removing === p.id
                              ? <Loader2 size={14} color="var(--text-muted)" className="animate-spin" />
                              : <X size={14} color="var(--text-muted)" />}
                          </button>
                        </div>
                        {isExpanded && (
                          <div style={{ padding: '0 0.75rem 0.75rem' }}>
                            <LocationPickerMap
                              lat={p.lat}
                              lng={p.lng}
                              radiusKm={p.radius_km}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
