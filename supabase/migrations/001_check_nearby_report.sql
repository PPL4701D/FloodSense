-- FR-021: Spam/Duplicate Detection — PostGIS proximity check function
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION check_nearby_report(
  p_reporter_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_meters INTEGER DEFAULT 100,
  p_minutes_ago INTEGER DEFAULT 30
)
RETURNS TABLE(exists BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT COUNT(*) > 0 AS exists
  FROM reports
  WHERE reporter_id = p_reporter_id
    AND created_at >= NOW() - (p_minutes_ago || ' minutes')::INTERVAL
    AND status NOT IN ('rejected', 'moderated')
    AND ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY,
      p_radius_meters
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FR-020: Increment reporter reputation helper
CREATE OR REPLACE FUNCTION increment_reputation(
  user_id UUID,
  delta INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET reputation_score = COALESCE(reputation_score, 0) + delta
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FR-021a: Report clusters view for map display
CREATE OR REPLACE VIEW v_report_clusters AS
SELECT
  r.id,
  r.reporter_id,
  r.location,
  r.address,
  r.region_id,
  r.description,
  r.severity,
  r.water_height_cm,
  r.status,
  r.credibility_score,
  r.created_at,
  ST_ClusterDBSCAN(r.location, eps := 0.001, minpoints := 1) OVER () AS cluster_id,
  ST_X(r.location::GEOMETRY) AS lng,
  ST_Y(r.location::GEOMETRY) AS lat
FROM reports r
WHERE r.status IN ('pending', 'verified', 'dalam_peninjauan')
  AND r.created_at >= NOW() - INTERVAL '7 days';
