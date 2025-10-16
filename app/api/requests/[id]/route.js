import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function PATCH(req, { params }) {
  const id = params.id;
  const body = await req.json();
  const patch = {};
  if ('status' in body) patch.status = body.status;
  if ('assigned_to' in body) patch.assigned_to = body.assigned_to;
  if ('internal_notes' in body) patch.internal_notes = body.internal_notes;

  const { data, error } = await supabaseAdmin
    .from('requests')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
