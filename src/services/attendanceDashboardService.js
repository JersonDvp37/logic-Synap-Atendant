import { supabase } from "./supabase";

function requireCompany(companyId) {
  if (!companyId) throw new Error("Empresa não identificada.");
  if (!supabase) throw new Error("A ligação ao Supabase não está configurada.");
}

function unwrap(result) {
  if (result.error) throw result.error;
  return result;
}

export async function getAttendanceDashboardData(companyId) {
  requireCompany(companyId);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.toISOString();

  const results = await Promise.all([
    supabase.from("whatsapp_conversations").select("*", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("company_received_files").select("*", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("whatsapp_conversations").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "active"),
    supabase.from("whatsapp_messages").select("*", { count: "exact", head: true }).eq("company_id", companyId).gte("created_at", today),
    supabase.from("company_received_files").select("*", { count: "exact", head: true }).eq("company_id", companyId).gte("created_at", today),
    supabase.from("whatsapp_conversations").select("id, customer_name, phone, status, updated_at").eq("company_id", companyId).order("updated_at", { ascending: false }).limit(5),
    supabase.from("whatsapp_messages").select("id, conversation_id, role, content, message_type, created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(5),
    supabase.from("company_received_files").select("id, conversation_id, telefone, filename, mime_type, created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(5),
  ]);

  const [conversationCount, fileCount, activeCount, messageTodayCount, fileTodayCount, conversations, messages, files] = results.map(unwrap);
  const conversationMap = new Map((conversations.data ?? []).map((item) => [item.id, item]));
  const missingIds = [...new Set((messages.data ?? []).map((item) => item.conversation_id).filter((id) => id && !conversationMap.has(id)))];

  if (missingIds.length) {
    const { data, error } = await supabase.from("whatsapp_conversations").select("id, customer_name, phone").eq("company_id", companyId).in("id", missingIds);
    if (error) throw error;
    for (const conversation of data ?? []) conversationMap.set(conversation.id, conversation);
  }

  return {
    conversationsCount: conversationCount.count ?? 0,
    filesCount: fileCount.count ?? 0,
    activeConversations: activeCount.count ?? 0,
    messagesToday: messageTodayCount.count ?? 0,
    filesToday: fileTodayCount.count ?? 0,
    recentConversations: conversations.data ?? [],
    recentMessages: (messages.data ?? []).map((item) => ({ ...item, conversation: conversationMap.get(item.conversation_id) ?? null })),
    recentFiles: files.data ?? [],
  };
}
