-- ============================================================
-- StackShadow — Migration: Pricing Intelligence + Alert Solutions
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add solution JSONB column to alerts table
ALTER TABLE public.alerts
ADD COLUMN IF NOT EXISTS solution jsonb DEFAULT NULL;

-- 2. Create pricing_analysis table
CREATE TABLE IF NOT EXISTS public.pricing_analysis (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  manifest_id uuid NOT NULL REFERENCES public.manifests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_current numeric NOT NULL DEFAULT 0,
  total_recommended numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS pricing_analysis_manifest_id_idx ON public.pricing_analysis(manifest_id);
CREATE INDEX IF NOT EXISTS pricing_analysis_user_id_idx ON public.pricing_analysis(user_id);

ALTER TABLE public.pricing_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own pricing analysis"
  ON public.pricing_analysis FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can write
CREATE POLICY "Service role can insert pricing analysis"
  ON public.pricing_analysis FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update pricing analysis"
  ON public.pricing_analysis FOR UPDATE
  USING (true);
