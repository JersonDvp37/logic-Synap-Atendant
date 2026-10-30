import { supabase } from "./supabase";
import { isDemoMode } from "./demoService";

const manualMessageWebhookUrl =
  import.meta.env.VITE_N8N_MANUAL_WHATSAPP_MESSAGE_WEBHOOK_URL ||
  "";

function requireCompany(companyId) {
  if (!companyId) throw new Error("Empresa não identificada.");
  if (!supabase) throw new Error("A ligação ao Supabase não está configurada.");
}

export async function getWhatsAppConversations(companyId) {
  requireCompany(companyId);

  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const conversations = data ?? [];
  if (!conversations.length) return [];

  const { data: recentMessages, error: messagesError } = await supabase
    .from("whatsapp_messages")
    .select("id, conversation_id, role, content, message_type, created_at")
    .eq("company_id", companyId)
    .in("conversation_id", conversations.map((item) => item.id))
    .order("created_at", { ascending: false });

  if (messagesError) {
    console.warn("Não foi possível carregar as últimas mensagens:", messagesError);
    return conversations;
  }

  const lastMessageByConversation = new Map();
  const lastInboundMessageByConversation = new Map();
  for (const message of recentMessages ?? []) {
    if (!lastMessageByConversation.has(message.conversation_id)) {
      lastMessageByConversation.set(message.conversation_id, message);
    }
    if (
      message.role !== "assistant" &&
      !lastInboundMessageByConversation.has(message.conversation_id)
    ) {
      lastInboundMessageByConversation.set(message.conversation_id, message);
    }
  }

  return conversations
    .map((conversation) => ({
      ...conversation,
      last_message: lastMessageByConversation.get(conversation.id) ?? null,
      last_inbound_message: lastInboundMessageByConversation.get(conversation.id) ?? null,
    }))
    .sort((a, b) => {
      const aDate = a.last_message?.created_at || a.updated_at || a.created_at;
      const bDate = b.last_message?.created_at || b.updated_at || b.created_at;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
}

export async function getWhatsAppMessages({ companyId, conversationId }) {
  requireCompany(companyId);
  if (!conversationId) throw new Error("Conversa não identificada.");

  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("*")
    .eq("company_id", companyId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getConversationReceivedFiles({
  companyId,
  conversationId,
}) {
  requireCompany(companyId);
  if (!conversationId) throw new Error("Conversa não identificada.");

  const { data, error } = await supabase
    .from("company_received_files")
    .select(`
      id,
      company_id,
      conversation_id,
      telefone,
      filename,
      mime_type,
      file_size,
      storage_path,
      created_at
    `)
    .eq("company_id", companyId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function sendManualWhatsAppMessage({
  companyId,
  conversationId,
  phone,
  message,
}) {
  if (!companyId) throw new Error("Empresa não identificada.");
  if (!conversationId) throw new Error("Conversa não selecionada.");
  if (!phone) throw new Error("Telefone da conversa não encontrado.");

  const cleanMessage = String(message || "").trim();
  const normalizedPhone = String(phone).replace(/\D/g, "");

  if (!cleanMessage) throw new Error("Digite uma mensagem.");
  if (!normalizedPhone) throw new Error("Telefone da conversa não encontrado.");
  if (isDemoMode) {
    const result = await supabase.from('whatsapp_messages').insert({ company_id: companyId, conversation_id: conversationId,
      role: 'assistant', content: cleanMessage, message_type: 'text', status: 'demo' }).select().single();
    if (result.error) throw result.error;
    return { success: true, message: result.data, demo: true };
  }
  if (!manualMessageWebhookUrl) {
    throw new Error("Webhook de envio manual do WhatsApp não configurado.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const payload = {
    company_id: companyId,
    conversation_id: conversationId,
    phone: normalizedPhone,
    message: cleanMessage,
  };

  const response = await fetch(manualMessageWebhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();

  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.error || data?.message || rawText || "Não foi possível enviar a mensagem."
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.error || data?.message || "O webhook não confirmou o envio."
    );
  }

  return data;
}
