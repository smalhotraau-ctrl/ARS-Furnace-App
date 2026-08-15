// Edge Function: create-furnace-user
//
// Called by Owner when approving a pending common.user_change_requests row with action='create'.
// Generates a random 6-digit PIN, creates the Supabase Auth user and the matching common.users
// row (identical UUID) in one step, marks the request approved, and returns the PIN once.
// The PIN is never written to any table — it exists only as the Auth password.
//
// Deploy via the Supabase dashboard (this project has no local CLI). See the report in the
// commit / the chat that added this file for the exact click-path.
//
// Env (injected automatically by Supabase, do not set manually):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ROLES = new Set(['supervisor', 'qa', 'plant_head', 'admin_owner'])

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function randomPin(): string {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  return String(bytes[0] % 1_000_000).padStart(6, '0')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: 'Function is missing Supabase env vars' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: callerData, error: callerError } = await callerClient.auth.getUser()
    if (callerError || !callerData.user) return json({ error: 'Not authenticated' }, 401)

    const { data: profile, error: profileError } = await adminClient
      .schema('common')
      .from('users')
      .select('id, role, active')
      .eq('id', callerData.user.id)
      .maybeSingle()
    if (profileError) return json({ error: profileError.message }, 500)
    if (!profile || !profile.active || profile.role !== 'admin_owner') {
      return json({ error: 'Only Owner can approve a new login' }, 403)
    }

    const body = (await req.json()) as { requestId?: string; decisionNote?: string | null }
    const requestId = body.requestId
    if (!requestId) return json({ error: 'requestId is required' }, 400)

    const { data: request, error: requestError } = await adminClient
      .schema('common')
      .from('user_change_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle()
    if (requestError) return json({ error: requestError.message }, 500)
    if (!request) return json({ error: 'Change request not found' }, 404)
    if (request.status !== 'pending') return json({ error: 'Change request is not pending' }, 409)
    if (request.action !== 'create') return json({ error: 'This function only handles create requests' }, 400)

    const payload = (request.payload ?? {}) as { username?: string; role?: string }
    const username = String(payload.username ?? '').trim().toLowerCase()
    const role = String(payload.role ?? '')
    if (!username || !ROLES.has(role)) return json({ error: 'Request payload is missing a valid username/role' }, 400)

    const email = `${username}@furnace.local`
    const pin = randomPin()

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: { username, role },
    })
    if (createError || !created.user) {
      return json({ error: createError?.message ?? 'Auth user creation failed' }, 400)
    }

    const { error: insertError } = await adminClient.schema('common').from('users').insert({
      id: created.user.id,
      username,
      role,
      active: true,
    })
    if (insertError) {
      await adminClient.auth.admin.deleteUser(created.user.id)
      return json({ error: insertError.message }, 400)
    }

    const { error: decideError } = await adminClient
      .schema('common')
      .from('user_change_requests')
      .update({
        status: 'approved',
        decided_by: callerData.user.id,
        decided_at: new Date().toISOString(),
        decision_note: body.decisionNote ?? null,
        target_id: created.user.id,
      })
      .eq('id', requestId)
      .eq('status', 'pending')
    if (decideError) {
      return json({
        error: `User was created but the request row could not be marked approved: ${decideError.message}`,
        pin,
        userId: created.user.id,
        username,
      }, 500)
    }

    return json({ pin, userId: created.user.id, username })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: message }, 500)
  }
})
