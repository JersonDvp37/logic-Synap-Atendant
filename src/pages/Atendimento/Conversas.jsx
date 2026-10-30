import {
  Fragment, useCallback, useEffect, useRef, useState,
} from "react";
import {
  AlertCircle, ArrowLeft, ExternalLink, FileText, LoaderCircle,
  MessageCircle, PanelLeftClose, PanelLeftOpen, RefreshCw, Send,
} from "lucide-react";
import { useCompany } from "../../contexts/CompanyContext";
import { useWhatsAppChannel } from "../../contexts/WhatsAppChannelContext";
import { supabase } from "../../services/supabase";
import { openReceivedFile } from "../../services/companyReceivedFilesService";
import {
  getConversationReceivedFiles,
  getWhatsAppConversations,
  getWhatsAppMessages,
  sendManualWhatsAppMessage,
} from "../../services/whatsappConversationsService";
import { getUnreadConversationIds, markConversationAsRead } from "../../services/notificationService";
import MarkdownMessage from "../../components/Markdown/MarkdownMessage";
import styles from "./Conversas.module.css";

const POLLING_INTERVAL = 300000;

export default function Conversas() {
  const { companyId } = useCompany();
  const { isActive } = useWhatsAppChannel();
  const messagesEndRef = useRef(null);
  const messagesRef = useRef(null);
  const selectedIdRef = useRef(null);
  const sendInFlightRef = useRef(false);
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [draft, setDraft] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [openingFileId, setOpeningFileId] = useState(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [unreadConversationIds, setUnreadConversationIds] = useState(() => new Set());

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedId
  ) ?? null;

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    const receivedAt = selectedConversation?.last_inbound_message?.created_at;
    if (!companyId || !selectedConversation?.id || !receivedAt) return;

    markConversationAsRead({
      companyId,
      conversationId: selectedConversation.id,
      readAt: receivedAt,
    });
    setUnreadConversationIds((current) => {
      if (!current.has(selectedConversation.id)) return current;
      const updated = new Set(current);
      updated.delete(selectedConversation.id);
      return updated;
    });
  }, [companyId, selectedConversation?.id, selectedConversation?.last_inbound_message?.created_at]);

  const loadConversations = useCallback(async ({ silent = false } = {}) => {
    if (!companyId) return;
    if (!silent) setRefreshing(true);

    try {
      const data = await getWhatsAppConversations(companyId);
      setConversations(data);
      setUnreadConversationIds(getUnreadConversationIds({ companyId, conversations: data }));
      setSelectedId((current) => {
        if (current && data.some((item) => item.id === current)) return current;
        return data[0]?.id ?? null;
      });
      if (!silent) setError("");
    } catch (loadError) {
      console.error("Erro ao carregar conversas:", loadError);
      if (!silent) {
        setError(loadError.message || "Não foi possível carregar as conversas.");
      }
    } finally {
      setLoadingConversations(false);
      if (!silent) setRefreshing(false);
    }
  }, [companyId]);

  const loadThread = useCallback(async (conversationId, { silent = false } = {}) => {
    if (!companyId || !conversationId) {
      setMessages([]);
      setFiles([]);
      return;
    }
    if (!silent) setLoadingThread(true);

    try {
      const [messageData, fileData] = await Promise.all([
        getWhatsAppMessages({ companyId, conversationId }),
        getConversationReceivedFiles({ companyId, conversationId }),
      ]);
      if (selectedIdRef.current === conversationId) {
        setMessages(messageData);
        setFiles(fileData);
      }
      if (!silent) setError("");
    } catch (loadError) {
      console.error("Erro ao carregar histórico:", loadError);
      if (!silent) {
        setError(loadError.message || "Não foi possível carregar o histórico.");
      }
    } finally {
      if (!silent) setLoadingThread(false);
    }
  }, [companyId]);

  useEffect(() => {
    setLoadingConversations(true);
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    loadThread(selectedId);
  }, [selectedId, loadThread]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "auto" });
  }, [messages, files]);

  useEffect(() => {
    if (!companyId || !supabase) return undefined;

    const channel = supabase
      .channel(`whatsapp-conversations-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations", filter: `company_id=eq.${companyId}` },
        () => loadConversations({ silent: true })
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `company_id=eq.${companyId}` },
        (payload) => {
          loadConversations({ silent: true });
          if (payload.new?.conversation_id === selectedIdRef.current) {
            loadThread(selectedIdRef.current, { silent: true });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "company_received_files", filter: `company_id=eq.${companyId}` },
        (payload) => {
          if (payload.new?.conversation_id === selectedIdRef.current) {
            loadThread(selectedIdRef.current, { silent: true });
          }
        }
      )
      .subscribe();

    return () => {
      setRealtimeConnected(false);
      supabase.removeChannel(channel);
    };
  }, [companyId, loadConversations, loadThread]);

  useEffect(() => {
    if (!companyId) return undefined;

    const intervalId = window.setInterval(() => {
      loadConversations({ silent: true });
      if (selectedIdRef.current) {
        loadThread(selectedIdRef.current, { silent: true });
      }
    }, POLLING_INTERVAL);

    return () => window.clearInterval(intervalId);
  }, [companyId, loadConversations, loadThread]);

  async function handleSend(event) {
    event.preventDefault();
    if (sendInFlightRef.current) return;
    if (!isActive) { setError("Canal WhatsApp indisponível. Teste a conexão na página Canal."); return; }

    try {
      sendInFlightRef.current = true;
      setSending(true);
      setError("");

      if (!companyId) throw new Error("Empresa não identificada.");
      if (!selectedConversation?.id) throw new Error("Conversa não selecionada.");
      if (!selectedConversation?.phone) {
        throw new Error("Telefone da conversa não encontrado.");
      }

      const message = draft.trim();
      if (!message) throw new Error("Digite uma mensagem.");

      await sendManualWhatsAppMessage({
        companyId,
        conversationId: selectedConversation.id,
        phone: selectedConversation.phone,
        message,
      });

      setDraft("");

      await Promise.all([
        loadThread(selectedConversation.id, { silent: true }),
        loadConversations({ silent: true }),
      ]);
    } catch (sendError) {
      console.error("Erro ao enviar mensagem manual:", sendError);
      setError(sendError.message || "Não foi possível enviar a mensagem.");
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  }

  async function handleOpenFile(file) {
    if (openingFileId) return;
    try {
      setOpeningFileId(file.id);
      setError("");
      await openReceivedFile({ fileId: file.id, companyId });
    } catch (openError) {
      setError(openError.message || "Não foi possível abrir o arquivo.");
    } finally {
      setOpeningFileId(null);
    }
  }

  return (
    <div className={`${styles.root} page ${selectedId ? styles.hasSelection : ""} ${sidebarOpen ? "" : styles.sidebarCollapsed}`}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div><h2>Conversas</h2><span>{conversations.length}</span></div>
          <div className={styles.sidebarActions}>
            <button type="button" onClick={() => loadConversations()} disabled={refreshing} title="Atualizar conversas" aria-label="Atualizar conversas">
              <RefreshCw size={17} className={refreshing ? styles.spinner : ""} />
            </button>
            <button type="button" className={styles.collapseButton} onClick={() => setSidebarOpen(false)} disabled={!selectedConversation} title="Recolher lista de conversas" aria-label="Recolher lista de conversas">
              <PanelLeftClose size={17} />
            </button>
          </div>
        </div>
        <div className={styles.conversationList}>
          {loadingConversations ? (
            <Empty icon={<LoaderCircle size={22} className={styles.spinner} />}>Carregando conversas...</Empty>
          ) : conversations.length === 0 ? (
            <Empty icon={<MessageCircle size={24} />}>Nenhuma conversa encontrada.</Empty>
          ) : conversations.map((conversation) => (
            <button
              type="button"
              key={conversation.id}
              className={`${styles.contact} ${selectedId === conversation.id ? styles.selected : ""} ${unreadConversationIds.has(conversation.id) ? styles.unread : ""}`}
              onClick={() => setSelectedId(conversation.id)}
            >
              <div><strong>{conversation.customer_name || conversation.phone}</strong>{unreadConversationIds.has(conversation.id) && <span className={styles.unreadBadge}>Nova</span>}<time>{formatActivity(conversation.last_message?.created_at || conversation.updated_at || conversation.created_at)}</time></div>
              <span>{conversation.phone}</span>
              <p>{conversation.last_message?.content || formatMessageType(conversation.last_message?.message_type) || "Sem mensagens"}</p>
              <small className={styles.status}>{conversation.status || "—"}</small>
            </button>
          ))}
        </div>
      </aside>

      <section className={styles.conversationPanel}>
        {!selectedConversation ? (
          <Empty icon={<MessageCircle size={30} />}>Selecione uma conversa.</Empty>
        ) : (
          <>
            <header className={styles.conversationHeader}>
              <button type="button" className={styles.backButton} onClick={() => setSelectedId(null)} aria-label="Voltar às conversas"><ArrowLeft size={19} /></button>
              <button type="button" className={styles.sidebarToggle} onClick={() => setSidebarOpen((current) => !current)} title={sidebarOpen ? "Recolher lista de conversas" : "Abrir lista de conversas"} aria-label={sidebarOpen ? "Recolher lista de conversas" : "Abrir lista de conversas"}>{sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}</button>
              <div><strong>{selectedConversation.customer_name || selectedConversation.phone}</strong><span>{selectedConversation.phone} · {selectedConversation.status || "sem estado"}</span></div>
              <button type="button" onClick={() => loadThread(selectedConversation.id)} disabled={loadingThread} title="Atualizar histórico"><RefreshCw size={17} className={loadingThread ? styles.spinner : ""} /></button>
            </header>

            {error && <div className={styles.error}><AlertCircle size={17} /><span>{error}</span><button type="button" onClick={() => setError("")}>Fechar</button></div>}

            <div className={styles.messages} ref={messagesRef}>
              {loadingThread ? (
                <Empty icon={<LoaderCircle size={22} className={styles.spinner} />}>Carregando histórico...</Empty>
              ) : messages.length === 0 && files.length === 0 ? (
                <Empty icon={<MessageCircle size={24} />}>Ainda não existem mensagens.</Empty>
              ) : (
                <Timeline messages={messages} files={files} openingFileId={openingFileId} onOpenFile={handleOpenFile} />
              )}
              <div ref={messagesEndRef} />
            </div>

            {!isActive && <div className={styles.channelWarning}><AlertCircle size={15} />Canal WhatsApp indisponível. Teste a conexão na página Canal.</div>}
            <form className={styles.composer} onSubmit={handleSend}>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Digite uma mensagem..." disabled={sending || !isActive} />
              <button type="submit" disabled={sending || !draft.trim() || !isActive}>
                {sending ? <LoaderCircle size={16} className={styles.spinner} /> : <Send size={16} />}
                {sending ? "Enviando..." : "Enviar"}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function Timeline({ messages, files, openingFileId, onOpenFile }) {
  const items = [
    ...messages.map((message) => ({ ...message, itemType: "message" })),
    ...files.map((file) => ({ ...file, itemType: "file" })),
  ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  let previousDayKey = null;
  return items.map((item) => {
    const dayKey = getDayKey(item.created_at);
    const showDayDivider = dayKey !== previousDayKey;
    previousDayKey = dayKey;

    return (
      <Fragment key={`${item.itemType}-${item.id}`}>
        {showDayDivider && <div className={styles.dayDivider}><span>{formatDayLabel(item.created_at)}</span></div>}
        {item.itemType === "file" ? (
          <article className={styles.fileMessage}>
            <FileText size={20} />
            <div><strong>{item.filename || "Arquivo"}</strong><span>{getFileType(item.mime_type)} · {formatFileSize(item.file_size)} · {formatDateTime(item.created_at)}</span></div>
            <button type="button" disabled={openingFileId === item.id} onClick={() => onOpenFile(item)}>
              {openingFileId === item.id ? <LoaderCircle size={16} className={styles.spinner} /> : <ExternalLink size={16} />} Abrir
            </button>
          </article>
        ) : <MessageBubble message={item} />}
      </Fragment>
    );
  });
}

function MessageBubble({ message }) {
  const [expanded, setExpanded] = useState(false);
  const content = message.content || formatMessageType(message.message_type);
  const isInbound = message.role !== "assistant";
  const isLong = isInbound && content.length > 320;
  const visibleContent = isLong && !expanded
    ? `${content.slice(0, 320).trimEnd()}…`
    : content;

  return (
    <article className={`${styles.bubble} ${isInbound ? styles.inbound : styles.outbound}`}>
      {isLong && !expanded
        ? <p>{visibleContent}</p>
        : <MarkdownMessage content={visibleContent} whatsapp />}
      {isLong && (
        <button
          type="button"
          className={styles.readMore}
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? "Ler menos" : "Ler mais"}
        </button>
      )}
      <span>{formatMessageType(message.message_type)} · {formatTime(message.created_at)}</span>
    </article>
  );
}

function getDayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return [date.getFullYear(), date.getMonth(), date.getDate()].join("-");
}

function formatDayLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (getDayKey(date) === getDayKey(today)) return "Hoje";
  if (getDayKey(date) === getDayKey(yesterday)) return "Ontem";
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}
function Empty({ icon, children }) {
  return <div className={styles.empty}>{icon}<span>{children}</span></div>;
}

function formatMessageType(type) {
  if (!type || type === "text") return "";
  return String(type).replaceAll("_", " ");
}

function getFileType(mimeType) {
  return mimeType?.split("/").pop()?.toUpperCase() || "Arquivo";
}

function formatFileSize(bytes) {
  const value = Number(bytes);
  if (!value) return "—";
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function formatActivity(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const today = new Date();
  return date.toDateString() === today.toDateString() ? formatTime(value) : new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit" }).format(date);
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
