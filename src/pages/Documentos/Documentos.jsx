import {
  useCallback, useEffect, useRef, useState,
} from "react";

import {
  AlertCircle, Check, Clock3, ExternalLink, FileText, LoaderCircle,
  RefreshCw, Trash2, UploadCloud,
} from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";

import {
  getCompanyDocuments, getDocumentAccessUrl, uploadCompanyDocument,
} from "../../services/documentosService";
import { deleteKnowledgeDocument } from "../../services/knowledgeDocumentsService";

import styles from "./Documentos.module.css";

const PROCESSING_STATUSES = [
  "pending",
  "processing",
  "processando",
  "uploading",
  "queued",
];

export default function Documentos() {
  const input = useRef(null);
  const mountedRef = useRef(true);
  const refreshRequestRef = useRef(0);
  const deleteInFlightRef = useRef(null);

  const { user } = useAuth();
  const { companyId } = useCompany();

  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] =
    useState(true);

  const [uploading, setUploading] = useState(false);
  const [openingDocumentId, setOpeningDocumentId] =
    useState(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const [postUploadPolls, setPostUploadPolls] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const refreshDocuments = useCallback(async ({
    silent = false,
  } = {}) => {
    const requestId = ++refreshRequestRef.current;

    if (!companyId) {
      if (mountedRef.current) {
        setDocuments([]);
        setLoadingDocuments(false);
      }

      return [];
    }

    try {
      if (!silent && mountedRef.current) {
        setLoadingDocuments(true);
        setErrorMessage("");
      }

      const { data, error } =
        await getCompanyDocuments(companyId);

      if (error) {
        throw error;
      }

      const updatedDocuments = data ?? [];

      if (
        mountedRef.current &&
        requestId === refreshRequestRef.current
      ) {
        setDocuments(updatedDocuments);
      }

      return updatedDocuments;
    } catch (error) {
      console.error(
        silent
          ? "Erro ao atualizar documentos:"
          : "Erro ao carregar documentos:",
        error
      );

      if (!silent && mountedRef.current) {
        setErrorMessage(
          error.message ||
            "Não foi possível carregar os documentos."
        );
      }

      throw error;
    } finally {
      if (
        !silent &&
        mountedRef.current &&
        requestId === refreshRequestRef.current
      ) {
        setLoadingDocuments(false);
      }
    }
  }, [companyId]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      refreshRequestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    refreshDocuments().catch(() => {});

    return () => {
      refreshRequestRef.current += 1;
    };
  }, [refreshDocuments]);

  const hasProcessingDocuments = documents.some(
    (document) =>
      PROCESSING_STATUSES.includes(
        String(document.status || "").toLowerCase()
      )
  );

  useEffect(() => {
    if (
      !companyId ||
      (!hasProcessingDocuments && postUploadPolls <= 0)
    ) return;

    let cancelled = false;
    let refreshInProgress = false;

    const pollDocuments = async () => {
      if (cancelled || refreshInProgress) return;

      refreshInProgress = true;

      try {
        await refreshDocuments({ silent: true });
        if (!hasProcessingDocuments) {
          setPostUploadPolls((remaining) => Math.max(0, remaining - 1));
        }
      } catch {
        // O refresh registra o erro e preserva a lista atual.
      } finally {
        refreshInProgress = false;
      }
    };

    const intervalId = window.setInterval(
      pollDocuments,
      3000
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    companyId,
    hasProcessingDocuments,
    postUploadPolls,
    refreshDocuments,
  ]);

  async function addFiles(fileList) {
    const files = Array.from(fileList).filter(
      (file) =>
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
    );

    if (!files.length) {
      setErrorMessage(
        "Selecione pelo menos um arquivo PDF."
      );
      return;
    }

    try {
      setUploading(true);
      setErrorMessage("");
      setSuccessMessage("");

      let hasAcceptedUpload = false;

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];

        setUploadProgress(
          `Enviando ${index + 1} de ${files.length}: ${file.name}`
        );

        const data = await uploadCompanyDocument({
          file,
          companyId,
          userId: user.id,
        });

        if (data?.duplicate === true) {
          setSuccessMessage(
            data.message || "Já existe um documento com este nome."
          );
          return;
        } else if (data?.success === true) {
          hasAcceptedUpload = true;
          setSuccessMessage(
            data.message ||
              "Documento recebido e está sendo processado."
          );
        } else {
          throw new Error(
            data?.message || data?.error ||
              "Não foi possível enviar o documento. Tente novamente."
          );
        }
      }

      if (hasAcceptedUpload) {
        refreshDocuments({ silent: true }).catch(() => {});
      }
    } catch (error) {
      console.error("Erro no upload:", error);

      setErrorMessage(
        error.message ||
          "Não foi possível enviar o documento. Tente novamente."
      );
    } finally {
      setUploading(false);
      setUploadProgress("");

      if (input.current) {
        input.current.value = "";
      }
    }
  }

  async function openDocument(document) {
    const pdfWindow = window.open("", "_blank");

    if (pdfWindow) {
      pdfWindow.opener = null;
      pdfWindow.document.title = "Abrindo documento...";
    }

    try {
      setOpeningDocumentId(document.id);
      setErrorMessage("");

      const url = await getDocumentAccessUrl(
        document.id,
        companyId,
        document.storage_path,
        document.nome_arquivo
      );

      if (pdfWindow) {
        pdfWindow.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Erro ao abrir documento:", error);

      const message =
        error.message ||
        "Não foi possível abrir o documento.";

      setErrorMessage(message);

      if (pdfWindow && !pdfWindow.closed) {
        pdfWindow.document.body.textContent =
          `Não foi possível abrir o documento: ${message}`;
      }
    } finally {
      setOpeningDocumentId(null);
    }
  }

  async function handleDeleteConfirmed() {
    if (!pendingDelete?.id || deleteInFlightRef.current) return;

    const documentId = pendingDelete.id;
    deleteInFlightRef.current = documentId;

    try {
      setDeletingId(documentId);
      setErrorMessage("");
      setSuccessMessage("");
      await deleteKnowledgeDocument({ documentId, companyId });
      setDocuments((current) => current.filter((document) => document.id !== documentId));
      setPendingDelete(null);
      setSuccessMessage("Documento excluído com sucesso.");
    } catch (error) {
      setErrorMessage(error.message || "Não foi possível excluir o documento. Tente novamente.");
    } finally {
      deleteInFlightRef.current = null;
      setDeletingId(null);
    }
  }

  return (
    <div className={`${styles.root} page`}>
      <button
        type="button"
        className="dropzone"
        disabled={uploading}
        onClick={() => input.current?.click()}
        onDrop={(event) => {
          event.preventDefault();

          if (!uploading) {
            addFiles(event.dataTransfer.files);
          }
        }}
        onDragOver={(event) =>
          event.preventDefault()
        }
      >
        <input
          ref={input}
          hidden
          multiple
          type="file"
          accept="application/pdf,.pdf"
          disabled={uploading}
          onChange={(event) =>
            addFiles(event.target.files)
          }
        />

        {uploading ? (
          <LoaderCircle
            size={28}
            className={styles.spinner}
          />
        ) : (
          <UploadCloud size={28} />
        )}

        <strong>
          {uploading
            ? "Enviando documento..."
            : "Envie seus documentos"}
        </strong>

        <span>
          {uploading
            ? uploadProgress
            : "Arraste arquivos PDF ou selecione no computador"}
        </span>
      </button>

      <p className={styles.uploadNote}>
        Documentos digitalizados ou escaneados podem levar mais tempo para
        serem processados.
      </p>

      {errorMessage && (
        <div className={styles.errorMessage}>
          <AlertCircle size={18} />
          <span>{errorMessage}</span>

          <button
            type="button"
            onClick={() => setErrorMessage("")}
          >
            Fechar
          </button>
        </div>
      )}

      {successMessage && (
        <div className={styles.successMessage} role="status">
          <Check size={18} />
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage("")}>Fechar</button>
        </div>
      )}

      <section className="panel">
        <div className={styles.listHeader}>
          <div>
            <h2>Documentos internos</h2>
            <p>Arquivos usados pelo Chat Interno da empresa.</p>
          </div>
          <button
            type="button"
            className={styles.refreshButton}
            disabled={loadingDocuments}
            onClick={() => refreshDocuments().catch(() => {})}
          >
            <RefreshCw
              size={16}
              className={loadingDocuments ? styles.spinner : ""}
            />
            Atualizar
          </button>
        </div>

        {loadingDocuments && (
          <div className={styles.emptyState}>
            <LoaderCircle
              size={22}
              className={styles.spinner}
            />

            <span>Carregando documentos...</span>
          </div>
        )}

        {!loadingDocuments &&
          documents.length === 0 && (
            <div className={styles.emptyState}>
              <FileText size={22} />

              <span>
                Nenhum documento encontrado.
              </span>
            </div>
          )}

        {!loadingDocuments && documents.length > 0 && (
          <div className={styles.documentList}>
            {documents.map((document) => (
              <DocumentRow
                key={document.id}
                document={document}
                opening={
                  openingDocumentId === document.id
                }
                onOpen={() => openDocument(document)}
                deleting={deletingId === document.id}
                onDelete={() => setPendingDelete(document)}
              />
            ))}
          </div>
        )}
      </section>
      {pendingDelete && (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.confirmDialog} role="dialog" aria-modal="true" aria-labelledby="delete-document-title">
            <div className={styles.dialogIcon}><Trash2 size={21} /></div>
            <h2 id="delete-document-title">Excluir documento?</h2>
            <p>Este documento e os dados de conhecimento associados serão removidos permanentemente.</p>
            <strong title={pendingDelete.nome_arquivo}>{pendingDelete.nome_arquivo || "Documento sem nome"}</strong>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.cancelButton} disabled={Boolean(deletingId)} onClick={() => setPendingDelete(null)}>Cancelar</button>
              <button type="button" className={styles.dangerButton} disabled={Boolean(deletingId)} onClick={handleDeleteConfirmed}>
                {deletingId ? <LoaderCircle size={16} className={styles.spinner} /> : <Trash2 size={16} />}
                {deletingId ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}



function DocumentRow({ document, opening, deleting, onOpen, onDelete }) {
  const status = getDocumentStatus(document.status);

  return (
    <article className={styles.documentCard}>
      <div className={styles.fileIcon}>
        <FileText size={20} />
      </div>
      <div className={styles.documentMain}>
        <strong title={document.nome_arquivo}>
          {document.nome_arquivo || "Documento sem nome"}
        </strong>
        <div className={styles.badges}>
          <span className={styles.scopeBadge}>Documento interno</span>
          <span className={styles[status.className]}>
            {status.icon}
            {status.label}
          </span>
        </div>
      </div>
      <dl className={styles.metadata}>
        <div>
          <dt>Tipo</dt>
          <dd>{getFileType(document)}</dd>
        </div>
        <div>
          <dt>Tamanho</dt>
          <dd>{formatFileSize(document.tamanho_bytes)}</dd>
        </div>
        <div>
          <dt>Enviado</dt>
          <dd>{formatDate(document.data_upload)}</dd>
        </div>
      </dl>
      <button
        type="button"
        className={styles.openButton}
        onClick={onOpen}
        disabled={opening || !document.storage_path}
        title={
          document.storage_path
            ? `Abrir ${document.nome_arquivo}`
            : "Documento ainda indisponível"
        }
      >
        {opening ? (
          <LoaderCircle size={17} className={styles.spinner} />
        ) : (
          <ExternalLink size={17} />
        )}
        <span>Abrir</span>
      </button>
      <button
        type="button"
        className={styles.deleteButton}
        aria-label={`Excluir ${document.nome_arquivo}`}
        disabled={deleting}
        onClick={onDelete}
        title="Excluir documento"
      >
        {deleting ? <LoaderCircle size={17} className={styles.spinner} /> : <Trash2 size={17} />}
      </button>
    </article>
  );
}

function LegacyDocumentRow({ document, opening, onOpen }) {
  const status = getDocumentStatus(document.status);

  return (
    <div className="document-row">
      <FileText size={18} />

      <button
        type="button"
        className={styles.documentName}
        onClick={onOpen}
        disabled={opening || !document.storage_path}
        title={
          document.storage_path
            ? `Abrir ${document.nome_arquivo}`
            : "Documento ainda indisponível"
        }
      >
        {opening && (
          <LoaderCircle
            size={16}
            className={styles.spinner}
          />
        )}

        <strong>{document.nome_arquivo}</strong>
      </button>

      <span>
        {formatFileSize(document.tamanho_bytes)}
      </span>

      <span>
        {formatDate(document.data_upload)}
      </span>

      <span className={status.className}>
        {status.icon}
        {status.label}
      </span>

      <button
        type="button"
        aria-label={`Excluir ${document.nome_arquivo}`}
        disabled
        title="Exclusão será implementada posteriormente"
      >
        <Trash2 size={17} />
      </button>
    </div>
  );
}

function getDocumentStatus(status) {
  const normalized =
    status?.toLowerCase() || "processing";

  if (
    normalized === "ready" ||
    normalized === "pronto" ||
    normalized === "completed"
  ) {
    return {
      label: "Pronto",
      className: "ready",
      icon: <Check size={13} />,
    };
  }

  if (
    normalized === "error" ||
    normalized === "erro" ||
    normalized === "failed"
  ) {
    return {
      label: "Erro",
      className: "error",
      icon: <AlertCircle size={13} />,
    };
  }

  return {
    label: "Processando",
    className: "processing",
    icon: <Clock3 size={13} />,
  };
}

function formatFileSize(bytes) {
  const value = Number(bytes);

  if (!value) {
    return "—";
  }

  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(
    1,
    Math.round(value / 1024)
  )} KB`;
}

function getFileType(document) {
  if (document.mime_type) {
    return document.mime_type.split("/").pop().toUpperCase();
  }

  const extension = document.nome_arquivo?.split(".").pop();
  return extension ? extension.toUpperCase() : "—";
}

function formatDate(date) {
  if (!date) {
    return "—";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate);
}
