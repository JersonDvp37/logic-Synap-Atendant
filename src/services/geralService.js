import { supabase } from "./supabase";

const READY_STATUSES = new Set(["ready", "pronto", "completed"]);

function requireCompany(companyId) {
  if (!companyId) throw new Error("Empresa não identificada.");
  if (!supabase) throw new Error("A ligação aos dados não está configurada.");
}

function startOfSevenDayWindow() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - 6);
  return date;
}

function dayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildActivitySeries(conversations, messages, startDate) {
  const formatter = new Intl.DateTimeFormat("pt-PT", { weekday: "short" });
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return { key: dayKey(date), label: formatter.format(date).replace(".", ""), conversations: 0, messages: 0 };
  });
  const byDay = new Map(days.map((day) => [day.key, day]));
  for (const item of conversations) {
    const day = byDay.get(dayKey(item.created_at));
    if (day) day.conversations += 1;
  }
  for (const item of messages) {
    const day = byDay.get(dayKey(item.created_at));
    if (day) day.messages += 1;
  }
  return days;
}

function valueOrNull(result, selector = (value) => value) {
  if (result.status === "rejected" || result.value.error) return null;
  return selector(result.value);
}

function hasError(result) {
  return result.status === "rejected" || Boolean(result.value.error);
}

export async function getGeralData(companyId) {
  requireCompany(companyId);
  const startDate = startOfSevenDayWindow();
  const since = startDate.toISOString();
  const results = await Promise.allSettled([
    supabase.from("whatsapp_conversations").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("rag_empresarial").select("id, nome_arquivo, status, document_scope, data_upload").eq("company_id", companyId).in("document_scope", ["internal_chat", "customer_service"]),
    supabase.from("whatsapp_conversations").select("id, created_at").eq("company_id", companyId).gte("created_at", since),
    supabase.from("whatsapp_messages").select("id, created_at").eq("company_id", companyId).gte("created_at", since),
    supabase.from("whatsapp_conversations").select("id, customer_name, phone, created_at, updated_at").eq("company_id", companyId).order("updated_at", { ascending: false }).limit(5),
    supabase.from("company_received_files").select("id, filename, telefone, created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(5),
  ]);
  const [conversationCount, messageCount, documentsResult, chartConversations, chartMessages, recentConversations, recentFiles] = results;
  const documents = valueOrNull(documentsResult, ({ data }) => data ?? []);
  const internalDocuments = documents?.filter((item) => item.document_scope === "internal_chat") ?? null;
  const serviceDocuments = documents?.filter((item) => item.document_scope === "customer_service") ?? null;
  const conversations = valueOrNull(chartConversations, ({ data }) => data ?? []);
  const messages = valueOrNull(chartMessages, ({ data }) => data ?? []);
  const recentDocumentEvents = (documents ?? []).map((item) => ({ id: `document-${item.id}`, type: READY_STATUSES.has(String(item.status || "").toLowerCase()) ? "Documento processado" : "Documento adicionado", title: item.nome_arquivo || "Documento sem nome", date: item.data_upload }));
  const recentConversationEvents = (valueOrNull(recentConversations, ({ data }) => data ?? []) ?? []).map((item) => ({ id: `conversation-${item.id}`, type: "Nova conversa", title: item.customer_name || item.phone || "Contacto não identificado", date: item.created_at || item.updated_at }));
  const recentFileEvents = (valueOrNull(recentFiles, ({ data }) => data ?? []) ?? []).map((item) => ({ id: `file-${item.id}`, type: "Arquivo recebido", title: item.filename || "Arquivo sem nome", date: item.created_at }));
  return {
    metrics: { conversations: valueOrNull(conversationCount, ({ count }) => count ?? 0), messages: valueOrNull(messageCount, ({ count }) => count ?? 0), internalDocuments: internalDocuments?.length ?? null, serviceDocuments: serviceDocuments?.length ?? null },
    readyDocuments: { internal: internalDocuments?.filter((item) => READY_STATUSES.has(String(item.status || "").toLowerCase())).length ?? null, service: serviceDocuments?.filter((item) => READY_STATUSES.has(String(item.status || "").toLowerCase())).length ?? null },
    chart: conversations && messages ? buildActivitySeries(conversations, messages, startDate) : null,
    recent: [...recentDocumentEvents, ...recentConversationEvents, ...recentFileEvents].filter((item) => item.date && !Number.isNaN(new Date(item.date).getTime())).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6),
    errors: { conversations: hasError(conversationCount), messages: hasError(messageCount), documents: hasError(documentsResult), chart: hasError(chartConversations) || hasError(chartMessages), recent: hasError(recentConversations) || hasError(recentFiles) || hasError(documentsResult) },
  };
}
