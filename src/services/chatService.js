import { supabase } from "./supabase";
import { demoAssistantReply, isDemoMode } from "./demoService";

const INTERNAL_CHAT_WEBHOOK_URL =
  import.meta.env.VITE_N8N_INTERNAL_CHAT_WEBHOOK_URL ||
  "";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  return supabase;
}

export async function listConversations(companyId) {
  if (!companyId) {
    throw new Error("Empresa não identificada.");
  }

  const { data, error } = await requireSupabase()
    .from("chat_conversations")
    .select(`
      id,
      company_id,
      created_by,
      title,
      created_at,
      updated_at,
      last_message_at,
      archived_at
    `)
    .eq("company_id", companyId)
    .is("archived_at", null)
    .order("last_message_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function createConversation({
  companyId,
  userId,
  title = "Nova conversa",
}) {
  if (!companyId || !userId) {
    throw new Error("Empresa ou usuário não identificado.");
  }

  const { data, error } = await requireSupabase()
    .from("chat_conversations")
    .insert({
      company_id: companyId,
      created_by: userId,
      title,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getConversationMessages({
  conversationId,
  companyId,
}) {
  if (!conversationId || !companyId) return [];

  const { data, error } = await requireSupabase()
    .from("chat_messages")
    .select(`
      id,
      conversation_id,
      company_id,
      created_by,
      role,
      content,
      created_at
    `)
    .eq("conversation_id", conversationId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

export async function createUserMessage({
  conversationId,
  companyId,
  userId,
  content,
}) {
  const cleanContent = content?.trim();

  if (!conversationId || !companyId || !userId) {
    throw new Error("Conversa, empresa ou usuário não identificado.");
  }

  if (!cleanContent) {
    throw new Error("Digite uma mensagem.");
  }

  const { data, error } = await requireSupabase()
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      company_id: companyId,
      created_by: userId,
      role: "user",
      content: cleanContent,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function renameConversation({
  conversationId,
  companyId,
  title,
}) {
  const cleanTitle = title?.trim();

  if (!conversationId || !companyId || !cleanTitle) return null;

  const { data, error } = await requireSupabase()
    .from("chat_conversations")
    .update({
      title: cleanTitle,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("company_id", companyId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deleteConversation({
  conversationId,
  companyId,
}) {
  if (!conversationId || !companyId) {
    throw new Error("Conversa não identificada.");
  }

  const { error } = await requireSupabase()
    .from("chat_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("company_id", companyId);

  if (error) throw error;
}

export async function requestAssistantResponse({
  conversationId,
  companyId,
  companyContext,
  messageId,
  userId,
  message,
  signal,
}) {
  if (isDemoMode) return demoAssistantReply({ conversationId, companyId, signal });
  if (
    !conversationId ||
    !companyId ||
    !companyContext ||
    !messageId ||
    !message?.trim()
  ) {
    throw new Error(
      "Dados insuficientes para solicitar a resposta do assistente."
    );
  }

  const {
    data: { session },
  } = await requireSupabase().auth.getSession();

  const finalUserId = userId || session?.user?.id;
  if (!finalUserId) {
    throw new Error("Usuário não autenticado. Por favor, faça login novamente.");
  }

  const headers = {
    "Content-Type": "application/json",
  };

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(INTERNAL_CHAT_WEBHOOK_URL, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      conversation_id: conversationId,
      company_id: companyId,
      company_context: companyContext,
      message_id: messageId,
      user_id: finalUserId,
      message: message.trim(),
    }),
  });

  let result = null;

  try {
    result = await response.json();
  } catch {
    result = null;
  }

  const payload = Array.isArray(result) ? result[0] : result;

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        payload?.message ||
        "Não foi possível gerar a resposta do assistente."
    );
  }

  const assistantMessage =
    payload?.assistant_message || payload?.message;

  return assistantMessage?.id && assistantMessage?.content
    ? assistantMessage
    : null;
}

export async function uploadChatImage({
  conversationId,
  companyId,
  companyContext,
  userId,
  imageBase64,
  fileName,
  messageId,
  message = "uploaded image",
  dataUrl,
  signal,
}) {
  if (
    !conversationId ||
    !companyId ||
    !companyContext ||
    !userId ||
    !imageBase64 ||
    !fileName ||
    !messageId
  ) {
    throw new Error(
      "Dados insuficientes para fazer upload da imagem."
    );
  }

  // 1. Inserir a mensagem de imagem no banco de dados (backend) antes de chamar o webhook
  const imageUrl = dataUrl || `data:image/png;base64,${imageBase64}`;
  const markdownImage = `![${fileName}](${imageUrl})`;
  const finalContent = message && message !== "uploaded image"
    ? `${message}\n\n${markdownImage}`
    : markdownImage;

  const { error: dbError } = await requireSupabase()
    .from("chat_messages")
    .insert({
      id: messageId,
      conversation_id: conversationId,
      company_id: companyId,
      created_by: userId,
      role: "user",
      content: finalContent,
    });

  if (dbError) {
    console.error("Erro ao salvar mensagem de imagem no backend:", dbError);
    throw dbError;
  }

  if (isDemoMode) return demoAssistantReply({ conversationId, companyId, signal });

  const {
    data: { session },
  } = await requireSupabase().auth.getSession();

  const finalUserId = userId || session?.user?.id;
  if (!finalUserId) {
    throw new Error("Usuário não autenticado. Por favor, faça login novamente.");
  }

  // Define o tipo com base no conteúdo
  const isTextOnly = !message || message === "uploaded image";
  const type = isTextOnly ? "image" : "media";

  const formData = new FormData();
  formData.append("conversation_id", conversationId);
  formData.append("company_id", companyId);
  formData.append("company_context", JSON.stringify(companyContext));
  formData.append("created_by", userId);
  formData.append("message_id", messageId);
  formData.append("user_id", finalUserId);
  formData.append("message", message);
  formData.append("type", type);
  formData.append("is_image", "true");
  formData.append("image_name", fileName);
  
  // Converte base64 para Blob para enviar como arquivo no FormData
  const byteCharacters = atob(imageBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "image/jpeg" });
  formData.append("image", blob, fileName);

  const headers = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(INTERNAL_CHAT_WEBHOOK_URL, {
    method: "POST",
    headers,
    signal,
    body: formData,
  });

  let result = null;

  try {
    result = await response.json();
  } catch {
    result = null;
  }

  const payload = Array.isArray(result) ? result[0] : result;

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        payload?.message ||
        "Não foi possível fazer upload da imagem."
    );
  }

  return payload;
}
