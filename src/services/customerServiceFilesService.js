import { supabase } from "./supabase";
import { openCompanyFile } from "./documentosService";
import { isDemoMode, uploadDemoDocument } from "./demoService";
import { getReceivedFiles } from "./companyReceivedFilesService";

const uploadWebhookUrl =
  import.meta.env.VITE_N8N_CUSTOMER_SERVICE_UPLOAD_WEBHOOK_URL ||
  "";

export const CUSTOMER_SERVICE_FILE_MAX_SIZE = 20 * 1024 * 1024;

const FILE_FIELDS = `
  id, company_id, nome_arquivo, gcs_url, data_upload, status,
  mime_type, tamanho_bytes, storage_path, erro_processamento,
  document_scope, source_type, conversation_id, customer_phone,
  original_message_id
`;

function requireCompany(companyId) {
  if (!companyId) {
    throw new Error("Empresa não identificada.");
  }

  if (!supabase) {
    throw new Error("A ligação ao Supabase não está configurada.");
  }
}

export function getCustomerServiceKnowledgeFiles(companyId) {
  requireCompany(companyId);

  return supabase
    .from("rag_empresarial")
    .select(FILE_FIELDS)
    .eq("company_id", companyId)
    .eq("document_scope", "customer_service")
    .eq("source_type", "manual_upload")
    .order("data_upload", { ascending: false })
    .order("id", { ascending: false });
}

export async function getCustomerReceivedFiles(companyId) {
  return getReceivedFiles(companyId);
}

export async function refreshCustomerServiceFiles(companyId) {
  const [knowledgeResult, receivedResult] = await Promise.all([
    getCustomerServiceKnowledgeFiles(companyId),
    getCustomerReceivedFiles(companyId),
  ]);

  if (knowledgeResult.error) throw knowledgeResult.error;
  if (receivedResult.error) throw receivedResult.error;

  return {
    knowledge: knowledgeResult.data ?? [],
    received: receivedResult.data ?? [],
  };
}

export async function getCustomerServiceFilesCount(companyId) {
  requireCompany(companyId);

  const { count, error } = await supabase
    .from("rag_empresarial")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .in("document_scope", ["customer_service", "customer_received"]);

  if (error) throw error;
  return count ?? 0;
}

export async function uploadCustomerServiceKnowledgeFile({
  file,
  companyId,
  userId,
}) {
  if (isDemoMode) return uploadDemoDocument({ file, companyId, userId, scope: 'customer_service' });
  requireCompany(companyId);

  if (!uploadWebhookUrl) {
    throw new Error(
      "A variável VITE_N8N_CUSTOMER_SERVICE_UPLOAD_WEBHOOK_URL não foi configurada."
    );
  }

  if (!file) {
    throw new Error("Selecione um arquivo PDF.");
  }

  const isPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    throw new Error("Apenas arquivos PDF são aceites.");
  }

  if (file.size > CUSTOMER_SERVICE_FILE_MAX_SIZE) {
    throw new Error("O arquivo excede o limite de 20 MB.");
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error("Sessão não autenticada. Entre novamente na sua conta.");
  }

  const formData = new FormData();
  formData.append("company_id", companyId);
  formData.append("user_id", userId);
  formData.append("file", file);
  formData.append("file_name", file.name);
  formData.append("nome_arquivo", file.name);
  formData.append("mime_type", file.type || "application/pdf");
  formData.append("file_size", String(file.size));
  formData.append("tamanho_bytes", String(file.size));
  formData.append("document_scope", "customer_service");
  formData.append("source_type", "manual_upload");

  const response = await fetch(uploadWebhookUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }

  if (!response.ok) {
    throw new Error(
      body?.message ||
        body?.error ||
        `Erro no upload: HTTP ${response.status}`
    );
  }

  return body;
}

export async function openCustomerServiceFile(fileRecord, companyId) {
  if (!fileRecord?.id) {
    throw new Error("Arquivo não identificado.");
  }

  if (!companyId) {
    throw new Error("Empresa não identificada.");
  }

  if (fileRecord.company_id !== companyId) {
    throw new Error("Este arquivo não pertence à empresa atual.");
  }

  return openCompanyFile({
    fileId: fileRecord.id,
    companyId,
    storagePath: fileRecord.storage_path,
    fileName: fileRecord.nome_arquivo,
    fileTable: fileRecord._file_table || "rag_empresarial",
  });
}
