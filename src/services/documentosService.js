import { supabase } from "./supabase";
import { demoFileUrl, isDemoMode, uploadDemoDocument } from "./demoService";

const uploadWebhookUrl =
  import.meta.env.VITE_N8N_DOCUMENT_UPLOAD_WEBHOOK_URL ||
  "";

export async function getCompanyDocuments(companyId) {
  if (!companyId) {
    throw new Error("Empresa não identificada.");
  }

  return supabase
    .from("rag_empresarial")
    .select(`
      id,
      company_id,
      nome_arquivo,
      gcs_url,
      gemini_file_uri,
      data_upload,
      status,
      mime_type,
      tamanho_bytes,
      storage_path,
      erro_processamento,
      created_by
    `)
    .eq("company_id", companyId)
    .eq("document_scope", "internal_chat")
    .order("data_upload", {
      ascending: false,
    });
}

export async function openCompanyFile({
  fileId,
  companyId,
  storagePath,
  fileName,
  fileTable = "rag_empresarial",
}) {
  if (isDemoMode) return demoFileUrl(fileId);
  if (!fileId) {
    throw new Error("Documento não identificado.");
  }

  if (!companyId) {
    throw new Error("Empresa não identificada.");
  }

  if (!storagePath) {
    throw new Error("O arquivo ainda não está disponível para abertura.");
  }

  const { data, error } = await supabase.functions.invoke(
    "document-acess",
    {
      body: {
        document_id: fileId,
        company_id: companyId,
        storage_path: storagePath,
        file_name: fileName,
        file_table: fileTable,
      },
    }
  );

  if (error) {
    console.error(
      "Erro ao chamar document-access:",
      error
    );

    let message = error.message;

    if (error.context instanceof Response) {
      const responseData = await error.context
        .clone()
        .json()
        .catch(() => null);

      message = responseData?.error || message;
    }

    throw new Error(
      message ||
        "Não foi possível acessar o documento."
    );
  }

  if (!data?.url) {
    throw new Error(
      data?.error ||
        "A função não retornou a URL do documento."
    );
  }

  return data.url;
}

export function getDocumentAccessUrl(documentId, companyId, storagePath, fileName) {
  return openCompanyFile({
    fileId: documentId,
    companyId,
    storagePath,
    fileName,
  });
}

export async function uploadCompanyDocument({
  file,
  companyId,
  userId,
}) {
  if (isDemoMode) return uploadDemoDocument({ file, companyId, userId });
  if (!uploadWebhookUrl) {
    throw new Error(
      "A variável VITE_N8N_DOCUMENT_UPLOAD_WEBHOOK_URL não foi configurada."
    );
  }

  if (!file) {
    throw new Error("Nenhum arquivo foi selecionado.");
  }

  if (!companyId) {
    throw new Error("Empresa não identificada.");
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token) {
    throw new Error("Sessão não encontrada. Faça login novamente.");
  }

  const formData = new FormData();

  formData.append("file", file);
  formData.append("company_id", companyId);
  formData.append("user_id", userId);
  formData.append("nome_arquivo", file.name);
  formData.append("mime_type", file.type || "application/pdf");
  formData.append("tamanho_bytes", String(file.size));
  formData.append("document_scope", "internal_chat");
  formData.append("source_type", "manual_upload");

  const response = await fetch(uploadWebhookUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  const responseText = await response.text();

  let responseData = null;

  if (responseText) {
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = null;
    }
  }

  if (responseData?.duplicate === true) {
    return responseData;
  }

  if (!response.ok) {
    throw new Error(
      responseData?.message ||
        responseData?.error ||
        "Não foi possível enviar o documento. Tente novamente."
    );
  }

  if (!responseData || typeof responseData !== "object") {
    throw new Error(
      "Não foi possível enviar o documento. Tente novamente."
    );
  }

  return responseData;
}

