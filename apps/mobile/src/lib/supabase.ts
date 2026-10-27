import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { config } from './config';
import type { Database } from './database.types';

export type Db = SupabaseClient<Database>;

let client: Db | null = null;

export function getSupabase(): Db {
  if (!client) {
    if (!config.supabaseConfigured) {
      throw new Error('Supabase is not configured');
    }
    client = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  }
  return client;
}

export const supabase: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getSupabase() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});
