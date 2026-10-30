import {
  useCallback, useEffect, useRef, useState,
} from "react";
import {
  AlertCircle, Check, Clock3, ExternalLink, FileDown,
  FileText, LoaderCircle, RefreshCw, Trash2, UploadCloud,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";
import {
  CUSTOMER_SERVICE_FILE_MAX_SIZE,
  getCustomerReceivedFiles,
  getCustomerServiceKnowledgeFiles,
  openCustomerServiceFile,
  uploadCustomerServiceKnowledgeFile,
} from "../../services/customerServiceFilesService";
import { deleteReceivedFile, openReceivedFile } from "../../services/companyReceivedFilesService";
import { deleteKnowledgeDocument } from "../../services/knowledgeDocumentsService";
import styles from "./Arquivos.module.css";

const PROCESSING_STATUSES = [
  "pending", "uploading", "processing", "processando", "queued",
];

export default function Arquivos() {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const inputRef = useRef(null);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const [activeTab, setActiveTab] = useState("knowledge");
  const [knowledgeFiles, setKnowledgeFiles] = useState([]);
  const [receivedFiles, setReceivedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const deleteInFlightRef = useRef(null);
  const [postUploadPolls, setPostUploadPolls] = useState(0);
  const [message, setMessage] = useState(null);

  const loadFiles = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++requestRef.current;

    if (!companyId) {
      setKnowledgeFiles([]);
      setReceivedFiles([]);
      setLoading(false);
      return;
    }

    if (!silent) setRefreshing(true);

    try {
      const [knowledge, received] = await Promise.all([
        getCustomerServiceKnowledgeFiles(companyId),
        getCustomerReceivedFiles(companyId),
      ]);

      if (knowledge.error) throw knowledge.error;
      if (received.error) throw received.error;

      if (mountedRef.current && requestId === requestRef.current) {
        setKnowledgeFiles(knowledge.data ?? []);
        setReceivedFiles(received.data ?? []);
      }
    } catch (error) {
      console.error("Erro ao carregar arquivos do atendimento:", error);
      if (!silent && mountedRef.current) {
        setMessage({
          type: "error",
          text: error.message || "Não foi possível carregar os arquivos.",
        });
      }
    } finally {
      if (mountedRef.current && requestId === requestRef.current) {
        setLoading(false);
        if (!silent) setRefreshing(false);
      }
    }
  }, [companyId]);

  useEffect(() => {
    mountedRef.current = true;
    loadFiles();

    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, [loadFiles]);

  const hasProcessingFiles = knowledgeFiles.some((file) =>
    PROCESSING_STATUSES.includes(String(file.status || "").toLowerCase())
  );

  useEffect(() => {
    if (
      !companyId ||
      (!hasProcessingFiles && postUploadPolls <= 0)
    ) return undefined;

    let refreshInProgress = false;
    const intervalId = window.setInterval(async () => {
      if (refreshInProgress) return;
      refreshInProgress = true;

      try {
        await loadFiles({ silent: true });
        if (!hasProcessingFiles) {
          setPostUploadPolls((remaining) => Math.max(0, remaining - 1));
        }
      } finally {
        refreshInProgress = false;
      }
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [companyId, hasProcessingFiles, loadFiles, postUploadPolls]);

  async function handleFile(file) {
    if (uploading) return;

    try {
      setUploading(true);
      setMessage(null);
      await uploadCustomerServiceKnowledgeFile({ file, companyId, userId: user.id });
      setPostUploadPolls(5);
      setMessage({
        type: "success",
        text: "Arquivo enviado. O processamento foi iniciado.",
      });
      await loadFiles({ silent: true });
    } catch (error) {
      console.error("Erro no upload de conhecimento:", error);
      setMessage({
        type: "error",
        text: error.message || "Não foi possível enviar o arquivo.",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function openFile(file) {
    const isReceivedFile = file._file_table === "company_received_files";
    const target = isReceivedFile ? null : window.open("", "_blank");
    if (target) target.opener = null;

    try {
      setOpeningId(file.id);
      setMessage(null);
      if (isReceivedFile) {
        await openReceivedFile({ fileId: file.id, companyId });
      } else {
        const url = await openCustomerServiceFile(file, companyId);
        if (target) {
          target.location.replace(url);
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      }
    } catch (error) {
      if (target && !target.closed) target.close();
      setMessage({
        type: "error",
        text: error.message || "Não foi possível abrir o arquivo.",
      });
    } finally {
      setOpeningId(null);
    }
  }

  async function handleDeleteConfirmed() {
    if (!pendingDelete?.id || deleteInFlightRef.current) return;
    const fileId = pendingDelete.id;
    const isKnowledgeDocument = pendingDelete._deleteKind === "knowledge";
    deleteInFlightRef.current = fileId;
    try {
      setDeletingId(fileId);
      setMessage(null);
      if (isKnowledgeDocument) {
        await deleteKnowledgeDocument({ documentId: fileId, companyId });
        setKnowledgeFiles((files) => files.filter((file) => file.id !== fileId));
      } else {
        await deleteReceivedFile({ fileId, companyId });
        setReceivedFiles((files) => files.filter((file) => file.id !== fileId));
      }
      setPendingDelete(null);
      setMessage({
        type: "success",
        text: isKnowledgeDocument
          ? "Documento excluído com sucesso."
          : "Arquivo excluído com sucesso.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || (isKnowledgeDocument
          ? "Não foi possível excluir o documento. Tente novamente."
          : "Não foi possível excluir o arquivo. Tente novamente."),
      });
    } finally {
      deleteInFlightRef.current = null;
      setDeletingId(null);
    }
  }

  const currentFiles =
    activeTab === "knowledge" ? knowledgeFiles : receivedFiles;

  return (
    <div className={`${styles.root} page`}>
      <div className={styles.tabs} role="tablist" aria-label="Tipos de arquivo">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "knowledge"}
          className={activeTab === "knowledge" ? styles.activeTab : ""}
          onClick={() => setActiveTab("knowledge")}
        >
          Conhecimento do atendimento
          <span>{knowledgeFiles.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "received"}
          className={activeTab === "received" ? styles.activeTab : ""}
          onClick={() => setActiveTab("received")}
        >
          Recebidos dos clientes
          <span>{receivedFiles.length}</span>
        </button>
      </div>

      {message && (
        <div className={`${styles.message} ${styles[message.type]}`} role="status">
          {message.type === "success" ? <Check size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)}>Fechar</button>
        </div>
      )}

      <section className="panel">
        <header className={styles.sectionHeader}>
          <div>
            <h2>
              {activeTab === "knowledge"
                ? "Conhecimento do atendimento"
                : "Arquivos recebidos dos clientes"}
            </h2>
            <p>
              {activeTab === "knowledge"
                ? "Arquivos usados pelo assistente do WhatsApp para responder clientes."
                : "Arquivos enviados pelos clientes durante conversas no WhatsApp."}
            </p>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={refreshing}
              onClick={() => loadFiles()}
            >
              <RefreshCw size={16} className={refreshing ? styles.spinner : ""} />
              Atualizar
            </button>
            {activeTab === "knowledge" && (
              <>
                <input
                  ref={inputRef}
                  hidden
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={uploading}
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={uploading || !companyId}
                  onClick={() => inputRef.current?.click()}
                >
                  {uploading
                    ? <LoaderCircle size={17} className={styles.spinner} />
                    : <UploadCloud size={17} />}
                  {uploading ? "Enviando..." : "Enviar arquivo"}
                </button>
              </>
            )}
          </div>
        </header>

        {activeTab === "knowledge" && (
          <p className={styles.uploadHint}>
            PDF, até {CUSTOMER_SERVICE_FILE_MAX_SIZE / 1024 / 1024} MB.
          </p>
        )}

        {loading ? (
          <EmptyState icon={<LoaderCircle className={styles.spinner} size={23} />}>
            Carregando arquivos...
          </EmptyState>
        ) : currentFiles.length === 0 ? (
          <EmptyState icon={activeTab === "knowledge" ? <FileText size={23} /> : <FileDown size={23} />}>
            {activeTab === "knowledge"
              ? "Nenhum arquivo de conhecimento enviado."
              : "Nenhum arquivo recebido dos clientes."}
          </EmptyState>
        ) : (
          <div className={styles.fileList}>
            {currentFiles.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                received={activeTab === "received"}
                opening={openingId === file.id}
                onOpen={() => openFile(file)}
                deleting={deletingId === file.id}
                onDelete={() => setPendingDelete({ ...file, _deleteKind: activeTab })}
              />
            ))}
          </div>
        )}
      </section>
      {pendingDelete && (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.confirmDialog} role="dialog" aria-modal="true" aria-labelledby="delete-file-title">
            <div className={styles.dialogIcon}><Trash2 size={21} /></div>
            <h2 id="delete-file-title">{pendingDelete._deleteKind === "knowledge" ? "Excluir documento?" : "Excluir arquivo?"}</h2>
            <p>
              {pendingDelete._deleteKind === "knowledge"
                ? "Este documento e os dados de conhecimento associados serão removidos permanentemente."
                : "Este arquivo será removido permanentemente."}
            </p>
            <strong title={pendingDelete.nome_arquivo}>
              {pendingDelete.nome_arquivo || (pendingDelete._deleteKind === "knowledge" ? "Documento sem nome" : "Arquivo sem nome")}
            </strong>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.secondaryButton} disabled={Boolean(deletingId)} onClick={() => setPendingDelete(null)}>Cancelar</button>
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

function EmptyState({ icon, children }) {
  return <div className={styles.emptyState}>{icon}<span>{children}</span></div>;
}

function FileCard({ file, received, opening, deleting, onOpen, onDelete }) {
  const status = getStatus(file.status);
  const type = getFileType(file);

  return (
    <article className={styles.fileCard}>
      <div className={styles.fileIcon}>{received ? <FileDown size={20} /> : <FileText size={20} />}</div>
      <div className={styles.fileMain}>
        <strong title={file.nome_arquivo}>{file.nome_arquivo || "Arquivo sem nome"}</strong>
        <div className={styles.badges}>
          <span className={styles.scopeBadge}>
            {received ? "Recebido pelo WhatsApp" : "Conhecimento"}
          </span>
          {!received && (
            <span className={styles[status.className]}>
              {status.icon}{status.label}
            </span>
          )}
        </div>
      </div>
      <dl className={styles.metadata}>
        {received && (
          <div><dt>Cliente</dt><dd>{file.customer_phone || "—"}</dd></div>
        )}
        {received && (
          <div><dt>Conversa</dt><dd title={file.conversation_id}>{file.conversation_id || "—"}</dd></div>
        )}
        <div><dt>Tipo</dt><dd>{type}</dd></div>
        <div><dt>Tamanho</dt><dd>{formatFileSize(file.tamanho_bytes)}</dd></div>
        <div><dt>{received ? "Recebido" : "Enviado"}</dt><dd>{formatDate(file.data_upload)}</dd></div>
      </dl>
      <button
        type="button"
        className={styles.openButton}
        onClick={onOpen}
        disabled={opening || !file.id}
        aria-label={`Abrir ${file.nome_arquivo || "arquivo"}`}
      >
        {opening
          ? <LoaderCircle size={17} className={styles.spinner} />
          : <ExternalLink size={17} />}
        <span>Abrir</span>
      </button>
      <button
        type="button"
        className={styles.deleteButton}
        disabled={deleting}
        onClick={onDelete}
        aria-label={`Excluir ${file.nome_arquivo || "arquivo"}`}
        title={received ? "Excluir arquivo" : "Excluir documento"}
      >
        {deleting ? <LoaderCircle size={17} className={styles.spinner} /> : <Trash2 size={17} />}
      </button>
    </article>
  );
}

function getStatus(value) {
  const status = String(value || "processing").toLowerCase();
  if (["ready", "pronto", "completed"].includes(status)) {
    return { label: "Pronto", className: "ready", icon: <Check size={13} /> };
  }
  if (["error", "erro", "failed"].includes(status)) {
    return { label: "Erro", className: "failed", icon: <AlertCircle size={13} /> };
  }
  return { label: "Processando", className: "processing", icon: <Clock3 size={13} /> };
}

function getFileType(file) {
  if (file.mime_type) return file.mime_type.split("/").pop().toUpperCase();
  const extension = file.nome_arquivo?.split(".").pop();
  return extension ? extension.toUpperCase() : "—";
}

function formatFileSize(bytes) {
  const value = Number(bytes);
  if (!value) return "—";
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(date);
}
