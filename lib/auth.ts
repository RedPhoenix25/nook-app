import { supabase } from "./supabase";
import type { Session, User } from "@supabase/supabase-js";

/**
 * Sends a magic link OTP to the given email address.
 * The user taps the link or enters the 6-digit code on the verify screen.
 */
export async function signInWithOtp(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });
  return { error: error?.message ?? null };
}

/**
 * Verifies the OTP token entered by the user on the verify screen.
 */
export async function verifyOtp(
  email: string,
  token: string
): Promise<{ session: Session | null; error: string | null }> {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  return { session: data.session, error: error?.message ?? null };
}

/**
 * Returns the currently authenticated user, or null if not logged in.
 */
export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Signs the current user out and clears the persisted session.
 */
export async function signOut(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signOut();
  return { error: error?.message ?? null };
}
