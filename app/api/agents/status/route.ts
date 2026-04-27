import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AgentRun } from '@/types';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: manifestRow } = await supabase
      .from('manifests')
      .select('id')
      .eq('user_id', user.id)
      .single<{ id: string }>();

    if (!manifestRow) {
      return NextResponse.json({ success: true, data: { runs: [] } });
    }

    const manifestId: string = manifestRow.id;

    // Get latest runs
    const { data: runsData } = await supabase
      .from('agent_runs')
      .select('*')
      .eq('manifest_id', manifestId)
      .order('started_at', { ascending: false })
      .limit(10)
      .returns<AgentRun[]>();

    const runs: AgentRun[] = runsData ?? [];

    // Get latest run per agent type
    const latestRuns: Record<string, AgentRun> = {};
    for (const run of runs) {
      if (!latestRuns[run.agent]) {
        latestRuns[run.agent] = run;
      }
    }

    return NextResponse.json({ success: true, data: { runs: Object.values(latestRuns) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
