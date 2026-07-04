import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../lib/supabase/admin';

/**
 * User directory, backed by Supabase Auth. This is the single place new users are
 * created: POST calls the Auth Admin API, and the on_auth_user_created trigger
 * mirrors the CRM claims into public.profiles.
 *
 * The service_role key lives only here (server-side) — see lib/supabase/admin.ts.
 */

export const dynamic = 'force-dynamic';

// GET /api/users?role=branch-manager&branch=Quezon City Branch
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role');
  const branch = searchParams.get('branch');

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  let query = supabaseAdmin
    .from('profiles')
    .select('id, email, username, display_name, role, branches, phone, status, created_at')
    .order('created_at', { ascending: true });

  if (role) query = query.eq('role', role);
  if (branch) query = query.contains('branches', [branch]);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ users: data });
}

// POST /api/users  — create a user in Supabase Auth
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    email,
    password,
    name,
    phone,
    username,
    role = 'branch-manager',
    branches = [],
    status = 'Active',
  } = body as {
    email?: string;
    password?: string;
    name?: string;
    phone?: string;
    username?: string;
    role?: string;
    branches?: string[];
    status?: string;
  };

  if (!email || !password) {
    return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      display_name: name,
      role,
      branches,
      phone,
      status,
    },
  });

  if (error) {
    // Surface duplicate-email and validation errors to the UI.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: data.user?.id }, { status: 201 });
}
