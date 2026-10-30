import { supabase } from "./supabase";
import { isDemoMode } from "./demoService";

export async function createCompany(companyName) {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase.rpc("create_company_account", {
    company_name: companyName,
  });
}

export async function getMyCompany() {
  if (!supabase) return { data: null, error: null };
  return supabase
    .from("company_members")
    .select(`
      company_id,
      role,
      status,
      companies (
        id,
        name,
        slug,
        country,
        areas,
        description,
        profile_completed,
        status
      )
    `)
    .eq("status", "active")
    .maybeSingle();
}

export async function updateCompanyDetails({
  companyId,
  name,
  slug,
  country,
  areas,
  description,
}) {
  if (!supabase) throw new Error("Supabase não configurado.");
  if (!companyId) throw new Error("Empresa não identificada.");

  const { data, error } = await supabase
    .from("companies")
    .update({ name, slug, country, areas, description, updated_at: new Date().toISOString() })
    .eq("id", companyId)
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCompanyAccount({ companyId, confirmation }) {
  if (!companyId) throw new Error("Empresa não identificada.");
  if (!confirmation) throw new Error("Confirmação inválida.");
  if (isDemoMode) { supabase.reset(); return { success: true, demo: true }; }

  const webhookUrl =
    import.meta.env.VITE_N8N_DELETE_ACCOUNT_WEBHOOK_URL ||
    "";
  if (webhookUrl.includes("/webhook-test/")) {
    throw new Error("O serviço de eliminação não está configurado para produção.");
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) throw new Error("Sessão não autenticada.");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ company_id: companyId, confirmation }),
  });

  const rawText = await response.text();
  let data = null;
  try { data = rawText ? JSON.parse(rawText) : null; } catch { data = null; }
  if (!response.ok || data?.success !== true) {
    throw new Error(data?.error || data?.message || "Não foi possível apagar a conta.");
  }
  return data;
}

export async function updateCompanyProfile({
  companyId,
  name,
  slug,
  country,
  areas,
  description,
}) {
  if (!supabase) throw new Error("Supabase não configurado.");
  if (!companyId) throw new Error("Empresa não identificada.");

  const { data, error } = await supabase
    .from("companies")
    .update({
      name,
      slug,
      country,
      areas,
      description,
      profile_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId)
    .select("id")
    .single();

  if (error) throw error;
  return data;
}
