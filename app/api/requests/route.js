import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(req) {
  const body = await req.json();
  const { data, error } = await supabaseAdmin.from('requests').insert(body).select().single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ data }), { status: 201, headers: { 'Content-Type': 'application/json' } });
}
