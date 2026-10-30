import { createClient } from "@supabase/supabase-js";
import { demoClient, isDemoMode } from "./demoService";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!isDemoMode && (!supabaseUrl || !supabaseAnonKey)) {
  console.error(
    "Vari�veis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY n�o est�o definidas."
  );
}

export const supabase =
  isDemoMode ? demoClient : supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
