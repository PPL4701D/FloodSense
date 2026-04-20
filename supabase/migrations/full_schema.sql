--
-- PostgreSQL database dump
--

\restrict gDcqX2p3xVbODHG9QoyN2TlF4dStjZKCa0ltnYcLkcXhHO881KineYDkfNSj2IV

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: area_status_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.area_status_level AS ENUM (
    'normal',
    'waspada',
    'siaga',
    'banjir_aktif',
    'mereda'
);


--
-- Name: broadcast_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.broadcast_severity AS ENUM (
    'informasi',
    'waspada',
    'darurat'
);


--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_type AS ENUM (
    'status_change',
    'report_verified',
    'report_rejected',
    'broadcast',
    'area_status_update'
);


--
-- Name: region_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.region_level AS ENUM (
    'provinsi',
    'kabupaten',
    'kecamatan'
);


--
-- Name: report_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.report_status AS ENUM (
    'pending',
    'verified',
    'rejected',
    'flagged',
    'dalam_peninjauan',
    'moderated'
);


--
-- Name: severity_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.severity_level AS ENUM (
    'ringan',
    'sedang',
    'berat',
    'sangat_berat'
);


--
-- Name: trigger_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.trigger_type AS ENUM (
    'auto',
    'manual'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'warga',
    'staf',
    'tlm',
    'admin'
);


--
-- Name: verification_decision; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.verification_decision AS ENUM (
    'verified',
    'rejected',
    'scheduled_check'
);


--
-- Name: vote_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vote_type AS ENUM (
    'upvote',
    'downvote'
);


--
-- Name: auto_assign_region(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_assign_region() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  matched_region_id UUID;
BEGIN
  -- Find the most specific region (kabupaten level) that contains this point
  SELECT id INTO matched_region_id
  FROM public.regions
  WHERE ST_Intersects(boundary, NEW.location)
    AND level = 'kabupaten'
  LIMIT 1;

  IF matched_region_id IS NOT NULL THEN
    NEW.region_id = matched_region_id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: calculate_credibility_score(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_credibility_score(p_report_id uuid) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_upvotes INTEGER;
  v_downvotes INTEGER;
  v_status report_status;
  v_verification_bonus NUMERIC;
  v_completeness NUMERIC;
  v_reporter_rep INTEGER;
  v_has_photo BOOLEAN;
  v_has_desc BOOLEAN;
  v_has_height BOOLEAN;
  v_score NUMERIC(5,2);
BEGIN
  -- Get vote counts
  SELECT
    COUNT(*) FILTER (WHERE vote_type = 'upvote'),
    COUNT(*) FILTER (WHERE vote_type = 'downvote')
  INTO v_upvotes, v_downvotes
  FROM public.votes WHERE report_id = p_report_id;

  -- Get report status + completeness
  SELECT r.status,
         EXISTS(SELECT 1 FROM public.report_photos WHERE report_id = p_report_id),
         (r.description IS NOT NULL AND r.description != ''),
         (r.water_height_cm IS NOT NULL),
         COALESCE(p.reputation_score, 0)
  INTO v_status, v_has_photo, v_has_desc, v_has_height, v_reporter_rep
  FROM public.reports r
  JOIN public.profiles p ON p.id = r.reporter_id
  WHERE r.id = p_report_id;

  -- Verification bonus
  v_verification_bonus := CASE v_status
    WHEN 'verified' THEN 50
    WHEN 'rejected' THEN -50
    ELSE 0
  END;

  -- Completeness score (0-100)
  v_completeness := 0;
  IF v_has_photo THEN v_completeness := v_completeness + 30; END IF;
  IF v_has_desc THEN v_completeness := v_completeness + 20; END IF;
  IF v_has_height THEN v_completeness := v_completeness + 20; END IF;
  v_completeness := v_completeness + 30; -- severity is always present

  -- Final formula
  v_score := (v_upvotes - v_downvotes) * 0.3
           + v_verification_bonus * 0.5
           + v_completeness * 0.1
           + LEAST(v_reporter_rep, 100) * 0.1;

  -- Clamp to range
  v_score := GREATEST(-99.99, LEAST(999.99, v_score));

  -- Update the report
  UPDATE public.reports SET credibility_score = v_score WHERE id = p_report_id;

  RETURN v_score;
END;
$$;


--
-- Name: get_map_reports(timestamp with time zone, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_map_reports(p_since timestamp with time zone, p_severity text DEFAULT NULL::text, p_status text DEFAULT NULL::text) RETURNS TABLE(id uuid, lat double precision, lng double precision, severity text, status text, water_height_cm integer, created_at timestamp with time zone, description text, photo_url text, region_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    RETURN QUERY
    SELECT
      r.id,
      ST_Y(r.location::GEOMETRY)   AS lat,
      ST_X(r.location::GEOMETRY)   AS lng,
      r.severity::TEXT,
      r.status::TEXT,
      r.water_height_cm,
      r.created_at,
      r.description,
      (SELECT rp.storage_path FROM report_photos rp WHERE rp.report_id = r.id LIMIT 1) AS photo_url,
      r.region_id
    FROM reports r
    WHERE r.created_at >= p_since
      AND (p_severity IS NULL OR r.severity::TEXT = p_severity)
      AND (
        CASE
          WHEN p_status IS NOT NULL THEN r.status::TEXT = p_status
          ELSE r.status IN ('pending', 'verified', 'dalam_peninjauan')
        END
      )
    ORDER BY r.created_at DESC
    LIMIT 500;
  END;
  $$;


--
-- Name: get_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role() RETURNS public.user_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    'warga'
  );
  RETURN NEW;
END;
$$;


--
-- Name: on_vote_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_vote_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.calculate_credibility_score(OLD.report_id);
  ELSE
    PERFORM public.calculate_credibility_score(NEW.report_id);
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: area_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.area_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    region_id uuid NOT NULL,
    status public.area_status_level NOT NULL,
    trigger_type public.trigger_type NOT NULL,
    requires_confirmation boolean DEFAULT false NOT NULL,
    confirmed_by uuid,
    note text,
    valid_from timestamp with time zone DEFAULT now() NOT NULL,
    valid_until timestamp with time zone
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid NOT NULL,
    action_type text NOT NULL,
    target_type text,
    target_id uuid,
    delta jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: broadcast_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.broadcast_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    target_regions uuid[] NOT NULL,
    message text NOT NULL,
    severity_level public.broadcast_severity NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT broadcast_messages_message_check CHECK ((char_length(message) <= 500))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type public.notification_type NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    related_report_id uuid,
    related_region_id uuid,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text DEFAULT ''::text NOT NULL,
    avatar_url text,
    role public.user_role DEFAULT 'warga'::public.user_role NOT NULL,
    assigned_region_id uuid,
    reputation_score integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    level public.region_level NOT NULL,
    parent_id uuid,
    boundary public.geography(MultiPolygon,4326),
    code text
);


--
-- Name: report_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    storage_path text NOT NULL,
    thumbnail_path text,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    location public.geography(Point,4326) NOT NULL,
    address text,
    region_id uuid,
    description text,
    severity public.severity_level NOT NULL,
    water_height_cm integer,
    status public.report_status DEFAULT 'pending'::public.report_status NOT NULL,
    credibility_score numeric(5,2) DEFAULT 0 NOT NULL,
    is_surge_receding boolean DEFAULT false NOT NULL,
    area_status_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT reports_water_height_cm_check CHECK (((water_height_cm >= 0) AND (water_height_cm <= 500)))
);


--
-- Name: user_region_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_region_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    region_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: v_current_area_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_current_area_status AS
 SELECT a.id,
    a.region_id,
    reg.name AS region_name,
    reg.level AS region_level,
    a.status,
    a.trigger_type,
    a.requires_confirmation,
    a.confirmed_by,
    p.full_name AS confirmed_by_name,
    a.note,
    a.valid_from
   FROM ((public.area_status a
     LEFT JOIN public.regions reg ON ((reg.id = a.region_id)))
     LEFT JOIN public.profiles p ON ((p.id = a.confirmed_by)))
  WHERE (a.valid_until IS NULL);


--
-- Name: VIEW v_current_area_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_current_area_status IS 'Current (active) area status per region. Each region appears at most once.';


--
-- Name: v_report_clusters; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_report_clusters AS
 SELECT r.region_id,
    reg.name AS region_name,
    reg.level AS region_level,
    r.severity,
    r.status,
    count(*) AS report_count,
    avg(r.credibility_score) AS avg_credibility,
    public.st_x(public.st_centroid(public.st_collect((r.location)::public.geometry))) AS center_lng,
    public.st_y(public.st_centroid(public.st_collect((r.location)::public.geometry))) AS center_lat,
    max(r.created_at) AS latest_report_at,
    date_trunc('hour'::text, r.created_at) AS time_bucket
   FROM (public.reports r
     LEFT JOIN public.regions reg ON ((reg.id = r.region_id)))
  WHERE ((r.created_at >= (now() - '7 days'::interval)) AND (r.status = ANY (ARRAY['pending'::public.report_status, 'verified'::public.report_status, 'flagged'::public.report_status])))
  GROUP BY r.region_id, reg.name, reg.level, r.severity, r.status, (date_trunc('hour'::text, r.created_at));


--
-- Name: VIEW v_report_clusters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_report_clusters IS 'Aggregated report clusters by region, severity, status for map visualization. Filtered to last 7 days.';


--
-- Name: verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    decision public.verification_decision NOT NULL,
    notes text NOT NULL,
    scheduled_check_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT verifications_notes_check CHECK ((char_length(notes) >= 10))
);


--
-- Name: votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.votes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    user_id uuid NOT NULL,
    vote_type public.vote_type NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: area_status area_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.area_status
    ADD CONSTRAINT area_status_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: broadcast_messages broadcast_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broadcast_messages
    ADD CONSTRAINT broadcast_messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: regions regions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_code_key UNIQUE (code);


--
-- Name: regions regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_pkey PRIMARY KEY (id);


--
-- Name: report_photos report_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_photos
    ADD CONSTRAINT report_photos_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: user_region_preferences user_region_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_region_preferences
    ADD CONSTRAINT user_region_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_region_preferences user_region_preferences_user_id_region_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_region_preferences
    ADD CONSTRAINT user_region_preferences_user_id_region_id_key UNIQUE (user_id, region_id);


--
-- Name: verifications verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_pkey PRIMARY KEY (id);


--
-- Name: votes votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_pkey PRIMARY KEY (id);


--
-- Name: votes votes_report_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_report_id_user_id_key UNIQUE (report_id, user_id);


--
-- Name: idx_area_status_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_area_status_current ON public.area_status USING btree (region_id) WHERE (valid_until IS NULL);


--
-- Name: idx_area_status_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_area_status_region ON public.area_status USING btree (region_id);


--
-- Name: idx_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_action ON public.audit_logs USING btree (action_type);


--
-- Name: idx_audit_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_actor ON public.audit_logs USING btree (actor_id);


--
-- Name: idx_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_created ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_broadcast_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_broadcast_active ON public.broadcast_messages USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id) WHERE (is_read = false);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- Name: idx_photos_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_photos_report ON public.report_photos USING btree (report_id);


--
-- Name: idx_profiles_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_region ON public.profiles USING btree (assigned_region_id);


--
-- Name: idx_profiles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);


--
-- Name: idx_push_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_user ON public.push_subscriptions USING btree (user_id);


--
-- Name: idx_regions_boundary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regions_boundary ON public.regions USING gist (boundary);


--
-- Name: idx_regions_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regions_level ON public.regions USING btree (level);


--
-- Name: idx_regions_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regions_parent ON public.regions USING btree (parent_id);


--
-- Name: idx_reports_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_created ON public.reports USING btree (created_at DESC);


--
-- Name: idx_reports_credibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_credibility ON public.reports USING btree (credibility_score DESC);


--
-- Name: idx_reports_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_location ON public.reports USING gist (location);


--
-- Name: idx_reports_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_region ON public.reports USING btree (region_id);


--
-- Name: idx_reports_reporter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_reporter ON public.reports USING btree (reporter_id);


--
-- Name: idx_reports_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_severity ON public.reports USING btree (severity);


--
-- Name: idx_reports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_status ON public.reports USING btree (status);


--
-- Name: idx_urp_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_urp_user ON public.user_region_preferences USING btree (user_id);


--
-- Name: idx_verifications_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verifications_report ON public.verifications USING btree (report_id);


--
-- Name: idx_verifications_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verifications_staff ON public.verifications USING btree (staff_id);


--
-- Name: idx_votes_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_votes_report ON public.votes USING btree (report_id);


--
-- Name: idx_votes_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_votes_user ON public.votes USING btree (user_id);


--
-- Name: reports reports_auto_region; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reports_auto_region BEFORE INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION public.auto_assign_region();


--
-- Name: reports reports_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: votes votes_credibility_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER votes_credibility_update AFTER INSERT OR DELETE OR UPDATE ON public.votes FOR EACH ROW EXECUTE FUNCTION public.on_vote_change();


--
-- Name: area_status area_status_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.area_status
    ADD CONSTRAINT area_status_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: area_status area_status_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.area_status
    ADD CONSTRAINT area_status_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: broadcast_messages broadcast_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broadcast_messages
    ADD CONSTRAINT broadcast_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: reports fk_reports_area_status; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT fk_reports_area_status FOREIGN KEY (area_status_id) REFERENCES public.area_status(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_related_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_related_region_id_fkey FOREIGN KEY (related_region_id) REFERENCES public.regions(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_related_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_related_report_id_fkey FOREIGN KEY (related_report_id) REFERENCES public.reports(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_assigned_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_assigned_region_id_fkey FOREIGN KEY (assigned_region_id) REFERENCES public.regions(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: regions regions_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.regions(id) ON DELETE SET NULL;


--
-- Name: report_photos report_photos_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_photos
    ADD CONSTRAINT report_photos_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;


--
-- Name: reports reports_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE SET NULL;


--
-- Name: reports reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_region_preferences user_region_preferences_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_region_preferences
    ADD CONSTRAINT user_region_preferences_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE CASCADE;


--
-- Name: user_region_preferences user_region_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_region_preferences
    ADD CONSTRAINT user_region_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: verifications verifications_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;


--
-- Name: verifications verifications_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: votes votes_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;


--
-- Name: votes votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: area_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.area_status ENABLE ROW LEVEL SECURITY;

--
-- Name: area_status area_status_insert_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY area_status_insert_staff ON public.area_status FOR INSERT WITH CHECK ((public.get_user_role() = ANY (ARRAY['staf'::public.user_role, 'admin'::public.user_role])));


--
-- Name: area_status area_status_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY area_status_select_all ON public.area_status FOR SELECT USING (true);


--
-- Name: area_status area_status_update_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY area_status_update_staff ON public.area_status FOR UPDATE USING ((public.get_user_role() = ANY (ARRAY['staf'::public.user_role, 'admin'::public.user_role])));


--
-- Name: audit_logs audit_insert_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_insert_auth ON public.audit_logs FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_select_admin ON public.audit_logs FOR SELECT USING ((public.get_user_role() = 'admin'::public.user_role));


--
-- Name: broadcast_messages broadcast_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY broadcast_admin_all ON public.broadcast_messages USING ((public.get_user_role() = 'admin'::public.user_role));


--
-- Name: broadcast_messages broadcast_insert_tlm; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY broadcast_insert_tlm ON public.broadcast_messages FOR INSERT WITH CHECK ((public.get_user_role() = ANY (ARRAY['tlm'::public.user_role, 'admin'::public.user_role])));


--
-- Name: broadcast_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.broadcast_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: broadcast_messages broadcast_select_active; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY broadcast_select_active ON public.broadcast_messages FOR SELECT USING ((is_active = true));


--
-- Name: broadcast_messages broadcast_update_tlm; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY broadcast_update_tlm ON public.broadcast_messages FOR UPDATE USING ((public.get_user_role() = ANY (ARRAY['tlm'::public.user_role, 'admin'::public.user_role])));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_insert_system; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_insert_system ON public.notifications FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: notifications notifications_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_select_own ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notifications notifications_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: report_photos photos_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photos_admin_all ON public.report_photos USING ((public.get_user_role() = 'admin'::public.user_role));


--
-- Name: report_photos photos_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photos_delete_own ON public.report_photos FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_photos.report_id) AND (reports.reporter_id = auth.uid()) AND (reports.status = 'pending'::public.report_status)))));


--
-- Name: report_photos photos_insert_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photos_insert_auth ON public.report_photos FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: report_photos photos_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY photos_select_all ON public.report_photos FOR SELECT USING (true);


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_admin_all ON public.profiles USING ((public.get_user_role() = 'admin'::public.user_role));


--
-- Name: profiles profiles_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_public ON public.profiles FOR SELECT USING (true);


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: push_subscriptions push_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_delete_own ON public.push_subscriptions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: push_subscriptions push_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_insert_own ON public.push_subscriptions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: push_subscriptions push_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_select_own ON public.push_subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: regions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

--
-- Name: regions regions_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY regions_admin_all ON public.regions USING ((public.get_user_role() = 'admin'::public.user_role));


--
-- Name: regions regions_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY regions_select_all ON public.regions FOR SELECT USING (true);


--
-- Name: report_photos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_photos ENABLE ROW LEVEL SECURITY;

--
-- Name: reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

--
-- Name: reports reports_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reports_admin_all ON public.reports USING ((public.get_user_role() = 'admin'::public.user_role));


--
-- Name: reports reports_delete_own_pending; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reports_delete_own_pending ON public.reports FOR DELETE USING (((auth.uid() = reporter_id) AND (status = 'pending'::public.report_status)));


--
-- Name: reports reports_insert_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reports_insert_auth ON public.reports FOR INSERT WITH CHECK ((auth.uid() = reporter_id));


--
-- Name: reports reports_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reports_select_all ON public.reports FOR SELECT USING (true);


--
-- Name: reports reports_staff_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reports_staff_update ON public.reports FOR UPDATE USING ((public.get_user_role() = ANY (ARRAY['staf'::public.user_role, 'admin'::public.user_role])));


--
-- Name: reports reports_update_own_pending; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reports_update_own_pending ON public.reports FOR UPDATE USING (((auth.uid() = reporter_id) AND (status = 'pending'::public.report_status))) WITH CHECK ((auth.uid() = reporter_id));


--
-- Name: user_region_preferences urp_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY urp_admin_select ON public.user_region_preferences FOR SELECT USING ((public.get_user_role() = 'admin'::public.user_role));


--
-- Name: user_region_preferences urp_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY urp_delete_own ON public.user_region_preferences FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_region_preferences urp_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY urp_insert_own ON public.user_region_preferences FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_region_preferences urp_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY urp_select_own ON public.user_region_preferences FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_region_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_region_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: verifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

--
-- Name: verifications verifications_insert_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY verifications_insert_staff ON public.verifications FOR INSERT WITH CHECK (((public.get_user_role() = ANY (ARRAY['staf'::public.user_role, 'admin'::public.user_role])) AND (auth.uid() = staff_id)));


--
-- Name: verifications verifications_select_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY verifications_select_staff ON public.verifications FOR SELECT USING ((public.get_user_role() = ANY (ARRAY['staf'::public.user_role, 'tlm'::public.user_role, 'admin'::public.user_role])));


--
-- Name: votes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

--
-- Name: votes votes_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY votes_delete_own ON public.votes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: votes votes_insert_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY votes_insert_auth ON public.votes FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = votes.report_id) AND (reports.reporter_id = auth.uid())))))));


--
-- Name: votes votes_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY votes_select_all ON public.votes FOR SELECT USING (true);


--
-- Name: votes votes_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY votes_update_own ON public.votes FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- PostgreSQL database dump complete
--

\unrestrict gDcqX2p3xVbODHG9QoyN2TlF4dStjZKCa0ltnYcLkcXhHO881KineYDkfNSj2IV

