import { supabase } from "./supabase";

const AUTH_REDIRECT_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "";

export async function signUp(email, password) {
  if (!supabase) throw new Error("Supabase nÃ£o configurado.");
  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${AUTH_REDIRECT_ORIGIN}/login`,
    },
  });
}

export async function signIn(email, password) {
  if (!supabase) throw new Error("Supabase nÃ£o configurado.");
  return supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function signOut() {
  if (!supabase) return { error: null };
  return supabase.auth.signOut();
}

export async function getUser() {
  if (!supabase) return { data: { user: null }, error: null };
  return supabase.auth.getUser();
}

export async function getSession() {
  if (!supabase) return { data: { session: null }, error: null };
  return supabase.auth.getSession();
}

export async function requestPasswordReset(email) {
  if (!supabase) throw new Error("Supabase nÃ£o configurado.");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${AUTH_REDIRECT_ORIGIN}/redefinir-password`,
  });
  if (error) throw error;
}

export async function resetPassword(newPassword) {
  if (!supabase) throw new Error("Supabase nÃ£o configurado.");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
