import { supabase } from "./supabase";
import { demoFileUrl, isDemoMode } from "./demoService";

const openReceivedFileWebhookUrl =
  import.meta.env.VITE_N8N_OPEN_RECEIVED_FILE_WEBHOOK_URL ||
  "";
const deleteReceivedFileWebhookUrl =
  import.meta.env.VITE_N8N_DELETE_RECEIVED_FILE_WEBHOOK_URL ||
  "";

function requireCompany(companyId) {
  if (!companyId) {
    throw new Error("Empresa não identificada.");
  }

  if (!supabase) {
    throw new Error("A ligação ao Supabase não está configurada.");
  }
}

export async function getReceivedFiles(companyId) {
  requireCompany(companyId);

  const result = await supabase
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
    .order("created_at", { ascending: false });

  if (result.error) return result;

  return {
    ...result,
    data: (result.data ?? []).map((file) => ({
      ...file,
      company_id: file.company_id,
      conversation_id: file.conversation_id,
      nome_arquivo: file.filename,
      mime_type: file.mime_type,
      tamanho_bytes: file.file_size,
      storage_path: file.storage_path,
      customer_phone: file.customer_phone ?? file.telefone,
      data_upload: file.created_at,
      _file_table: "company_received_files",
    })),
  };
}

export async function openReceivedFile({ fileId, companyId }) {
  if (isDemoMode) { window.open(demoFileUrl(fileId), '_blank', 'noopener,noreferrer'); return; }
  if (!fileId) {
    throw new Error("Arquivo inválido.");
  }

  requireCompany(companyId);

  if (!openReceivedFileWebhookUrl) {
    throw new Error("Webhook de abertura de arquivos não configurado.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = {
    "Content-Type": "application/json",
  };

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(openReceivedFileWebhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      file_id: fileId,
      company_id: companyId,
    }),
  });

  if (!response.ok) {
    throw new Error("Não foi possível abrir o arquivo.");
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.json();

    if (!data.signed_url) {
      throw new Error("URL do arquivo não retornada.");
    }

    window.open(data.signed_url, "_blank", "noopener,noreferrer");
    return;
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  window.open(objectUrl, "_blank", "noopener,noreferrer");

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 60000);
}
export async function deleteReceivedFile({ fileId, companyId }) {
  if (isDemoMode) {
    const result = await supabase.from('company_received_files').delete().eq('id', fileId).eq('company_id', companyId);
    if (result.error) throw result.error;
    return { success: true, demo: true };
  }
  if (!fileId) throw new Error("Arquivo inválido.");
  requireCompany(companyId);

  if (!deleteReceivedFileWebhookUrl) {
    throw new Error("Webhook de exclusão de arquivos não configurado.");
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error("Não foi possível validar a sessão.");
  if (!session?.access_token) throw new Error("Sessão não autenticada.");

  const response = await fetch(deleteReceivedFileWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ file_id: fileId, company_id: companyId }),
  });

  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok || data?.success !== true) {
    throw new Error("Não foi possível excluir o arquivo. Tente novamente.");
  }
  return data;
}
