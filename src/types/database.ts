// ============================================================
// FloodSense Indonesia — Database TypeScript Types
// Mirrors all 13 PostgreSQL tables + ENUMs
// ============================================================

// ---- ENUMS ----

export type UserRole = 'warga' | 'staf' | 'tlm' | 'admin';

export type SeverityLevel = 'ringan' | 'sedang' | 'berat' | 'sangat_berat';

export type ReportStatus =
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'flagged'
  | 'dalam_peninjauan'
  | 'moderated';

export type AreaStatusLevel =
  | 'normal'
  | 'waspada'
  | 'siaga'
  | 'banjir_aktif'
  | 'mereda';

export type TriggerType = 'auto' | 'manual';

export type VoteType = 'upvote' | 'downvote';

export type NotificationType =
  | 'status_change'
  | 'report_verified'
  | 'report_rejected'
  | 'broadcast'
  | 'area_status_update';

export type RegionLevel = 'provinsi' | 'kabupaten' | 'kecamatan';

export type VerificationDecision = 'verified' | 'rejected' | 'scheduled_check';

export type BroadcastSeverity = 'informasi' | 'waspada' | 'darurat';

// ---- CONSTANTS ----

export const SEVERITY_WEIGHTS: Record<SeverityLevel, number> = {
  ringan: 0.25,
  sedang: 0.5,
  berat: 0.75,
  sangat_berat: 1.0,
};

export const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  ringan: 'Ringan',
  sedang: 'Sedang',
  berat: 'Berat',
  sangat_berat: 'Sangat Berat',
};

export const AREA_STATUS_COLORS: Record<AreaStatusLevel, string> = {
  normal: '#16A34A',
  waspada: '#D97706',
  siaga: '#EA580C',
  banjir_aktif: '#DC2626',
  mereda: '#0891B2',
};

export const AREA_STATUS_LABELS: Record<AreaStatusLevel, string> = {
  normal: 'Normal',
  waspada: 'Waspada',
  siaga: 'Siaga',
  banjir_aktif: 'Banjir Aktif',
  mereda: 'Mereda',
};

export const WATER_HEIGHT_PRESETS = [
  { label: 'Mata Kaki', range: '< 15 cm', value: 10 },
  { label: 'Lutut', range: '15 - 50 cm', value: 30 },
  { label: 'Pinggang', range: '50 - 100 cm', value: 75 },
  { label: 'Dada', range: '100 - 150 cm', value: 125 },
  { label: 'Di atas kepala', range: '> 150 cm', value: 175 },
] as const;

// ---- TABLE TYPES ----

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  assigned_region_id: string | null;
  reputation_score: number;
  is_active: boolean;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  location: PostGISPoint;
  address: string | null;
  region_id: string | null;
  description: string | null;
  severity: SeverityLevel;
  water_height_cm: number | null;
  status: ReportStatus;
  credibility_score: number;
  is_surge_receding: boolean;
  area_status_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ReportPhoto {
  id: string;
  report_id: string;
  storage_path: string;
  thumbnail_path: string | null;
  uploaded_at: string;
}

export interface Vote {
  id: string;
  report_id: string;
  user_id: string;
  vote_type: VoteType;
  created_at: string;
}

export interface Verification {
  id: string;
  report_id: string;
  staff_id: string;
  decision: VerificationDecision;
  notes: string;
  scheduled_check_at: string | null;
  created_at: string;
}

export interface Region {
  id: string;
  name: string;
  level: RegionLevel;
  parent_id: string | null;
  boundary: PostGISMultiPolygon | null;
  code: string | null;
}

export interface AreaStatus {
  id: string;
  region_id: string;
  status: AreaStatusLevel;
  trigger_type: TriggerType;
  requires_confirmation: boolean;
  confirmed_by: string | null;
  note: string | null;
  valid_from: string;
  valid_until: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  related_report_id: string | null;
  related_region_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  delta: Record<string, unknown> | null;
  created_at: string;
}

export interface UserRegionPreference {
  id: string;
  user_id: string;
  region_id: string;
  created_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
}

export interface BroadcastMessage {
  id: string;
  sender_id: string;
  target_regions: string[];
  message: string;
  severity_level: BroadcastSeverity;
  is_active: boolean;
  expires_at: string;
  created_at: string;
}

// ---- PostGIS Types ----

export interface PostGISPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface PostGISMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

// ---- Extended / Joined Types ----

export interface ReportWithDetails extends Report {
  reporter: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'reputation_score'>;
  photos: ReportPhoto[];
  region: Pick<Region, 'id' | 'name' | 'level'> | null;
  vote_count: { upvotes: number; downvotes: number };
  user_vote: VoteType | null;
  area_status: Pick<AreaStatus, 'status' | 'valid_from'> | null;
}

export interface RegionWithParent extends Region {
  parent: Pick<Region, 'id' | 'name' | 'level'> | null;
}

export interface VerificationWithStaff extends Verification {
  staff: Pick<Profile, 'id' | 'full_name'>;
}

// ---- Map Types ----

export interface MapReport {
  id: string;
  lat: number;
  lng: number;
  severity: SeverityLevel;
  status: ReportStatus;
  water_height_cm: number | null;
  created_at: string;
  description: string | null;
  photo_url: string | null;
  region_id: string | null;
}

export type HeatmapPoint = [number, number, number]; // [lat, lng, intensity]
