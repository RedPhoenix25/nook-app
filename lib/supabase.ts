import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const supabaseUrl = "https://lruzbkylaxgzyhrgotzt.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxydXpia3lsYXhnenlocmdvdHp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNDY1NDEsImV4cCI6MjEwMTkyMjU0MX0.Ku4WpqstkdVa6aKGSadTk-fO5yyXYUMfj8WXbTTrHJk";

/**
 * SecureStore adapter for Supabase auth token persistence.
 * Stores auth tokens encrypted on the device keychain.
 */
const ExpoSecureStoreAdapter = {
  getItem: (key: string): Promise<string | null> => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string): Promise<void> => {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string): Promise<void> => {
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
