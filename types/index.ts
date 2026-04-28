// ─────────────────────────────────────────────
// Supabase Database Row Types
// ─────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  created_at: string;
}

export interface TechEntry {
  name: string;
  version?: string;
}

export interface AIModel {
  provider: string;
  model: string;
  version?: string;
}

export interface ParsedManifest {
  languages: string[];
  frameworks: TechEntry[];
  ai_models: AIModel[];
  databases: string[];
  infrastructure: string[];
  key_dependencies: TechEntry[];
}

export interface Manifest {
  id: string;
  user_id: string;
  repo_url: string;
  repo_name: string;
  raw_files: Record<string, string>;
  parsed_manifest: ParsedManifest | null;
  created_at: string;
  updated_at: string;
}

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AgentType = 'fuzzer' | 'scraper';
export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AlertSolution {
  recommendation?: string;
  fix_url?: string;
  proof_url?: string;
  alternatives?: Array<{ name: string; url: string }>;
}

export interface Alert {
  id: string;
  manifest_id: string;
  user_id: string;
  agent: AgentType;
  severity: AlertSeverity;
  title: string;
  description: string;
  source_url?: string;
  affected_package?: string;
  is_read: boolean;
  solution?: AlertSolution | null;
  created_at: string;
}

export interface PricingItem {
  name: string;
  type: string;
  is_paid: boolean;
  current_cost: number;
  alternative_name?: string;
  alternative_cost?: number;
  alternative_url?: string;
  billing_cycle?: string;
}

export interface PricingAnalysis {
  id: string;
  manifest_id: string;
  user_id: string;
  items: PricingItem[];
  total_current: number;
  total_recommended: number;
  created_at: string;
}

export interface AgentRun {
  id: string;
  manifest_id: string;
  agent: AgentType;
  status: AgentStatus;
  started_at: string;
  completed_at?: string;
  error?: string;
}

// ─────────────────────────────────────────────
// API Response Types
// ─────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ScanRepoRequest {
  repoUrl: string;
  githubToken: string;
}

export interface ScanRepoResponse {
  manifest: Manifest;
}

export interface RunAgentResponse {
  agentRun: AgentRun;
  alertsCreated: number;
}

// ─────────────────────────────────────────────
// Supabase Database Type Map
// ─────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
        Relationships: any[];
      };
      manifests: {
        Row: Manifest;
        Insert: Partial<Manifest>;
        Update: Partial<Manifest>;
        Relationships: any[];
      };
      alerts: {
        Row: Alert;
        Insert: Partial<Alert>;
        Update: Partial<Alert>;
        Relationships: any[];
      };
      agent_runs: {
        Row: AgentRun;
        Insert: Partial<AgentRun>;
        Update: Partial<AgentRun>;
        Relationships: any[];
      };
    };
  };
}
