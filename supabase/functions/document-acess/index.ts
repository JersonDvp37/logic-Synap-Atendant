import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

function getCorsHeaders(req: Request) {
  const customOrigins =
    Deno.env
      .get("ALLOWED_ORIGINS")
      ?.split(",")
      .map((o) => o.trim())
      .filter(Boolean) || [];

  const allowedOrigins = customOrigins.length ? customOrigins : DEFAULT_ALLOWED_ORIGINS;
  const origin = req.headers.get("Origin") || "";
  const allowOrigin = allowedOrigins.includes(origin) ? origin : null;

  return {
    ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin } : {}),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  const jsonResponse = (body: Record<string, unknown>, status = 200) => {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Método não permitido." }, 405);
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization) {
      return jsonResponse({ error: "Usuário não autenticado." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const gcsBucket = Deno.env.get("GCS_BUCKET");
    const gcpClientEmail = Deno.env.get("GCP_CLIENT_EMAIL");
    const gcpPrivateKey = Deno.env
      .get("GCP_PRIVATE_KEY")
      ?.replace(/\\n/g, "\n");

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Configuração do Supabase não encontrada.");
    }

    if (!gcsBucket || !gcpClientEmail || !gcpPrivateKey) {
      throw new Error("Credenciais do Google Cloud não configuradas.");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authorization },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Sessão inválida ou expirada." }, 401);
    }

    const body = await req.json().catch(() => null);
    const documentId = body?.document_id;
    const companyId = body?.company_id;
    const requestedStoragePath = body?.storage_path;
    const fileTable =
      body?.file_table === "company_received_files"
        ? "company_received_files"
        : "rag_empresarial";

    if (typeof documentId !== "string" || !documentId.trim()) {
      return jsonResponse({ error: "document_id é obrigatório." }, 400);
    }

    if (typeof companyId !== "string" || !companyId.trim()) {
      return jsonResponse({ error: "company_id é obrigatório." }, 400);
    }

    if (
      typeof requestedStoragePath !== "string" ||
      !requestedStoragePath.trim()
    ) {
      return jsonResponse({ error: "storage_path é obrigatório." }, 400);
    }

    // Este cliente usa o JWT recebido, portanto a consulta respeita a RLS.
    const { data: rawDocument, error: documentError } = await supabase
      .from(fileTable)
      .select("*")
      .eq("id", documentId)
      .eq("company_id", companyId)
      .maybeSingle();
    const document = rawDocument
      ? {
          ...rawDocument,
          nome_arquivo:
            rawDocument.nome_arquivo ??
            rawDocument.file_name ??
            rawDocument.filename ??
            rawDocument.name,
          storage_path:
            rawDocument.storage_path ??
            rawDocument.object_path ??
            rawDocument.file_path ??
            rawDocument.path,
          mime_type: rawDocument.mime_type ?? rawDocument.content_type,
        }
      : null;

    if (documentError || !document) {
      console.error("Documento não encontrado:", documentError);
      return jsonResponse(
        { error: "Documento não encontrado ou acesso não autorizado." },
        404,
      );
    }

    if (!document.storage_path) {
      return jsonResponse(
        { error: "O documento não possui storage_path." },
        422,
      );
    }

    if (document.storage_path !== requestedStoragePath) {
      return jsonResponse(
        { error: "O identificador do arquivo não corresponde ao registro solicitado." },
        409,
      );
    }

    const expiresInSeconds = 15 * 60;
    const signedUrl = await createGcsV4SignedUrl({
      bucket: gcsBucket,
      objectPath: document.storage_path,
      clientEmail: gcpClientEmail,
      privateKey: gcpPrivateKey,
      expiresInSeconds,
    });

    return jsonResponse({
      success: true,
      url: signedUrl,
      expires_in: expiresInSeconds,
      document: {
        id: document.id,
        nome_arquivo: document.nome_arquivo,
        mime_type: document.mime_type,
      },
    });
  } catch (error) {
    console.error("Erro em document-access:", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao abrir o documento.",
      },
      500,
    );
  }
});

async function createGcsV4SignedUrl({
  bucket,
  objectPath,
  clientEmail,
  privateKey,
  expiresInSeconds,
}: {
  bucket: string;
  objectPath: string;
  clientEmail: string;
  privateKey: string;
  expiresInSeconds: number;
}) {
  const now = new Date();
  const dateStamp = formatDate(now);
  const timestamp = formatTimestamp(now);
  const credentialScope = `${dateStamp}/auto/storage/goog4_request`;
  const canonicalUri = `/${encodePath(bucket)}/${encodePath(objectPath)}`;
  const queryParams = new URLSearchParams({
    "X-Goog-Algorithm": "GOOG4-RSA-SHA256",
    "X-Goog-Credential": `${clientEmail}/${credentialScope}`,
    "X-Goog-Date": timestamp,
    "X-Goog-Expires": String(expiresInSeconds),
    "X-Goog-SignedHeaders": "host",
  });
  const canonicalQueryString = createCanonicalQueryString(queryParams);
  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQueryString,
    "host:storage.googleapis.com\n",
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = [
    "GOOG4-RSA-SHA256",
    timestamp,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");
  const cryptoKey = await importPrivateKey(privateKey);
  const signatureBuffer = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    cryptoKey,
    new TextEncoder().encode(stringToSign),
  );

  return (
    `https://storage.googleapis.com${canonicalUri}` +
    `?${canonicalQueryString}` +
    `&X-Goog-Signature=${bufferToHex(signatureBuffer)}`
  );
}

function createCanonicalQueryString(params: URLSearchParams) {
  return Array.from(params.entries())
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
}

function encodePath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function formatTimestamp(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

async function sha256Hex(value: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return bufferToHex(hash);
}

function bufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function importPrivateKey(privateKeyPem: string) {
  const normalizedKey = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(
    atob(normalizedKey),
    (character) => character.charCodeAt(0),
  );

  return crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
}
