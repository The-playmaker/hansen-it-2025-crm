'use client';
import { useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function LogoutPage() {
  useEffect(() => { supabase.auth.signOut().then(() => window.location.href = '/login'); }, []);
  return <section className="container-default py-20">Logger ut…</section>;
}
