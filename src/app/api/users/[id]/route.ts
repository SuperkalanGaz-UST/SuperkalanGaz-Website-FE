import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase/admin';

/** Update / delete a single user. All identity changes go through the Auth Admin API. */

export const dynamic = 'force-dynamic';

// PATCH /api/users/:id
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const { email, password, name, phone, username, role, branches, status } = body as {
    email?: string;
    password?: string;
    name?: string;
    phone?: string;
    username?: string;
    role?: string;
    branches?: string[];
    status?: string;
  };

  // Update auth-owned fields (email/password) if provided.
  const authAttrs: Record<string, unknown> = {};
  if (email) authAttrs.email = email;
  if (password) authAttrs.password = password;
  if (Object.keys(authAttrs).length > 0) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, authAttrs);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Update the CRM profile fields.
  const profilePatch: Record<string, unknown> = {};
  if (email !== undefined) profilePatch.email = email;
  if (name !== undefined) profilePatch.display_name = name;
  if (phone !== undefined) profilePatch.phone = phone;
  if (username !== undefined) profilePatch.username = username;
  if (role !== undefined) profilePatch.role = role;
  if (branches !== undefined) profilePatch.branches = branches;
  if (status !== undefined) profilePatch.status = status;

  if (Object.keys(profilePatch).length > 0) {
    const { error } = await supabaseAdmin.from('profiles').update(profilePatch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/users/:id
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
