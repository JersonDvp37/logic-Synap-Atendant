import { supabase } from "./supabase";
import { isDemoMode } from "./demoService";

const deleteKnowledgeDocumentWebhookUrl =
  import.meta.env.VITE_N8N_DELETE_KNOWLEDGE_DOCUMENT_WEBHOOK_URL ||
  "";

export async function deleteKnowledgeDocument({ documentId, companyId }) {
  if (!documentId) throw new Error("Documento não identificado.");
  if (!companyId) throw new Error("Empresa não identificada.");
  if (isDemoMode) {
    const result = await supabase.from('rag_empresarial').delete().eq('id', documentId).eq('company_id', companyId);
    if (result.error) throw result.error;
    return { success: true, demo: true };
  }
  if (!deleteKnowledgeDocumentWebhookUrl) {
    throw new Error("Webhook de exclusão de documentos não configurado.");
  }

  const { data: { session }, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) throw new Error("Não foi possível validar a sessão.");
  if (!session?.access_token) throw new Error("Sessão não autenticada.");

  const response = await fetch(deleteKnowledgeDocumentWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      document_id: documentId,
      company_id: companyId,
    }),
  });

  const rawText = await response.text();
  let data = null;
  try { data = rawText ? JSON.parse(rawText) : null; } catch { data = null; }

  if (!response.ok || data?.success !== true) {
    throw new Error("Não foi possível excluir o documento. Tente novamente.");
  }

  return data;
}
