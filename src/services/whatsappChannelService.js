import { supabase } from "./supabase";
import { isDemoMode } from "./demoService";

function requireCompany(companyId) {
  if (!companyId) throw new Error("Empresa não identificada.");
  if (!supabase) throw new Error("A ligação ao Supabase não está configurada.");
}

async function getAuthorizationHeader() {
  if (!supabase) throw new Error("A ligação ao Supabase não está configurada.");

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  if (!session?.access_token) throw new Error("Sessão não autenticada.");

  return `Bearer ${session.access_token}`;
}

export async function getWhatsAppChannel(companyId) {
  requireCompany(companyId);
  const { data, error, count } = await supabase
    .from("whatsapp_instances")
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (import.meta.env.DEV && count > 1) {
    console.warn("[WhatsAppChannel] Mais de uma instancia encontrada para a empresa atual.");
  }
  return data ?? null;
}

export async function configureWhatsAppChannel({ companyId, phoneNumberId, businessAccountId, accessToken }) {
  if (!companyId) throw new Error("Empresa não identificada.");
  if (isDemoMode) {
    const result = await supabase.from('whatsapp_instances').upsert({
      id: 'demo-whatsapp', company_id: companyId, phone_number_id: phoneNumberId || 'demo-phone',
      business_account_id: businessAccountId || 'demo-business', display_phone_number: '+000 000 000 000',
      verified_name: 'Canal de demonstração', status: 'active', webhook_status: 'demo', last_check_at: new Date().toISOString(),
    });
    if (result.error) throw result.error;
    return { success: true, demo: true };
  }
  const webhookUrl =
    import.meta.env.VITE_N8N_CONFIGURE_WHATSAPP_CHANNEL_WEBHOOK_URL ||
    "";
  if (webhookUrl.includes("/webhook-test/")) throw new Error("Configure a URL de produção do webhook n8n.");
  const authorization = await getAuthorizationHeader();
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify({ company_id: companyId, phone_number_id: phoneNumberId, business_account_id: businessAccountId, access_token: accessToken }),
  });
  let result;
  try { result = await response.json(); } catch { throw new Error("O webhook devolveu uma resposta inválida."); }
  if (!response.ok || result?.success !== true) throw new Error(result?.message || result?.error || "Não foi possível configurar o canal.");
  return result;
}
export async function disconnectWhatsAppChannel(companyId) {
  requireCompany(companyId);
  if (isDemoMode) {
    const result = await supabase.from('whatsapp_instances').update({ status: 'disconnected', webhook_status: 'disconnected' }).eq('company_id', companyId);
    if (result.error) throw result.error;
    return { success: true, demo: true };
  }
  const webhookUrl =
    import.meta.env.VITE_N8N_DISCONNECT_WHATSAPP_CHANNEL_WEBHOOK_URL ||
    "";
  if (webhookUrl.includes("/webhook-test/")) throw new Error("Configure a URL de produção do webhook de desconexão.");

  const authorization = await getAuthorizationHeader();
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify({ company_id: companyId }),
  });

  const rawText = await response.text();
  let data = null;
  try { data = rawText ? JSON.parse(rawText) : null; } catch { data = null; }

  if (!response.ok || data?.success !== true) {
    throw new Error(data?.error || data?.message || "Não foi possível desconectar o canal.");
  }

  return data;
}

export async function testWhatsAppConnection(companyId) {
  if (isDemoMode) return { success: true, connected: true, demo: true };
  if (!companyId) throw new Error("Empresa não identificada.");
  const webhookUrl =
    import.meta.env.VITE_N8N_TEST_WHATSAPP_CONNECTION_WEBHOOK_URL ||
    "";
  if (webhookUrl.includes("/webhook-test/")) throw new Error("Configure a URL de produção do webhook de teste.");
  const authorization = await getAuthorizationHeader();
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify({ company_id: companyId }),
  });
  const rawText = await response.text();
  let data = null;
  try { data = rawText ? JSON.parse(rawText) : null; } catch { data = null; }
  if (!response.ok) {
    const safeRawText = rawText && rawText.length < 240 ? rawText : "";
    throw new Error(data?.details || data?.error || safeRawText || "Não foi possível testar a conexão.");
  }
  if (!data?.success || data?.connected !== true) {
    throw new Error(data?.details || data?.error || "A conexão com o WhatsApp não pôde ser confirmada.");
  }
  return data;
}
