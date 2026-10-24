import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { Friend } from './friends';
import type { Remote } from './sync';
import type { State } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null when Supabase isn't configured: progress then stays on each device. */
export const remote: Remote | null = url && anonKey
  ? supabaseRemote(createClient(url, anonKey, { auth: { persistSession: false } }))
  : null;

// Other devices are told about saves on a channel named after the key, without giving the key away.
async function topicFor(key: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('charlie:' + key));
  return 'charlie-' + Array.from(new Uint8Array(buf).slice(0, 16), b => b.toString(16).padStart(2, '0')).join('');
}

function supabaseRemote(sb: SupabaseClient): Remote {
  const channels = new Map<string, RealtimeChannel>();
  return {
    async create(data) {
      const { data: key, error } = await sb.rpc('charlie_new', { p_data: data });
      if (error) throw error;
      return key as string;
    },
    async load(key) {
      const { data, error } = await sb.rpc('charlie_load', { p_key: key });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ? { data: row.data as State, version: row.version as number } : 'invalid';
    },
    async save(key, data, expected) {
      const { data: v, error } = await sb.rpc('charlie_save', { p_key: key, p_data: data, p_expected: expected });
      if (error) throw error;
      return typeof v === 'number' ? v : null;
    },
    listen(key, onSaved) {
      let stopped = false;
      topicFor(key).then(topic => {
        if (stopped) return;
        channels.set(key, sb.channel(topic).on('broadcast', { event: 'saved' }, () => onSaved()).subscribe());
      });
      return () => {
        stopped = true;
        const ch = channels.get(key);
        if (ch) { sb.removeChannel(ch); channels.delete(key); }
      };
    },
    announce(key) {
      channels.get(key)?.send({ type: 'broadcast', event: 'saved', payload: {} });
    },
    async stats(password) {
      const { data, error } = await sb.rpc('charlie_stats', { p_password: password });
      if (error) throw error;
      return Array.isArray(data) ? data : null;
    },
    async claim(name) {
      const { data, error } = await sb.rpc('charlie_claim', { p_name: name });
      if (error) throw error;
      return typeof data === 'string' ? data : null;
    },
    async friends(key, since) {
      const { data, error } = await sb.rpc('charlie_friends', { p_key: key, p_since: since });
      if (error) throw error;
      return (data ?? []) as Friend[];
    },
  };
}
