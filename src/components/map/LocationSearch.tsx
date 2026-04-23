'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, MapPin } from 'lucide-react';

interface SearchResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
}

interface LocationSearchProps {
  onSelect: (lat: number, lng: number) => void;
}

export default function LocationSearch({ onSelect }: LocationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when picking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search logic for Nominatim (OpenStreetMap)
  useEffect(() => {
    // Requirements: Minimum 3 chars to start search
    if (!query || query.trim().length < 3) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        // countrycodes=id limits results to Indonesia
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=id&limit=5`);
        const data = await res.json();
        setResults(data);
        setIsOpen(true);
      } catch (err) {
        console.error('Failed to search location', err);
      } finally {
        setIsSearching(false);
      }
    }, 600); // 600ms debounce to prevent hitting rate limits

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', marginBottom: '1rem', zIndex: 1100 }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="input"
          placeholder="Cari nama jalan, daerah, tempat..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
             if (results.length > 0) setIsOpen(true);
          }}
          style={{ paddingLeft: '2.5rem' }}
        />
        <div style={{ 
          position: 'absolute', 
          left: '12px', 
          top: '50%', 
          transform: 'translateY(-50%)', 
          display: 'flex', 
          alignItems: 'center', 
          pointerEvents: 'none' 
        }}>
           {isSearching ? <Loader2 size={18} className="animate-spin text-primary-400" color="var(--primary-400)" /> : <Search size={18} color="var(--text-muted)" />}
        </div>
      </div>

      {isOpen && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1100,
          background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-md)', marginTop: '4px', overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)'
        }}>
          {results.map((item) => (
            <button
              key={item.place_id}
              type="button"
              onClick={() => {
                onSelect(parseFloat(item.lat), parseFloat(item.lon));
                setQuery(item.display_name);
                setIsOpen(false);
              }}
              style={{
                width: '100%', textAlign: 'left', padding: '0.75rem 1rem', border: 'none',
                background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'flex-start',
                gap: '0.75rem', borderBottom: '1px solid var(--border-primary)',
                transition: 'background var(--transition-fast)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <MapPin size={16} color="var(--primary-400)" style={{ marginTop: '2px', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {item.display_name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
