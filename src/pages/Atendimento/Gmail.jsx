import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ExternalLink, FileText, Filter, Inbox, LoaderCircle, Mail, Paperclip, RefreshCw, Send, X } from "lucide-react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";
import { useChannelActions } from "../../contexts/ChannelActionsContext";
import { isDemoMode } from "../../services/demoService";
import {
  getAttachmentName,
  getGmailAttachments,
  getGmailMessages,
  getMessageBody,
  getMessageDate,
  getMessageId,
  getMessageSubject,
  markGmailMessageAsRead,
  openGmailAttachment,
  requestGmailInboxSync,
  sendGmailEmail,
} from "../../services/gmailService";
import styles from "./Gmail.module.css";

const GMAIL_POLL_INTERVAL_MS = 5 * 60 * 1000;
const GMAIL_SYNC_STORAGE_PREFIX = "logic-synap:gmail-sync:";

function canStartScheduledGmailSync(companyId, instanceId) {
  if (typeof window === "undefined") return true;

  try {
    const key = `${GMAIL_SYNC_STORAGE_PREFIX}${companyId}:${instanceId}`;
    const lastStartedAt = Number(window.localStorage.getItem(key) || 0);
    const now = Date.now();
    if (lastStartedAt && now - lastStartedAt < GMAIL_POLL_INTERVAL_MS) return false;
    window.localStorage.setItem(key, String(now));
    return true;
  } catch {
    return true;
  }
}

import {
  getActiveGmailInstanceId,
  getGmailInstanceEmail,
  getGmailInstances,
  setActiveGmailInstance,
} from '../../services/gmailService';

export function GmailInbox() {
  const { companyId } = useCompany();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get("message");
  const [messages, setMessages] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(requestedId);
  const [isModalOpen, setIsModalOpen] = useState(Boolean(requestedId));
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [subjectFilterOpen, setSubjectFilterOpen] = useState(false);
  const [openingAttachmentId, setOpeningAttachmentId] = useState(null);
  const readRequestIds = useRef(new Set());
  const syncInFlightRef = useRef(false);
  const selectedAccountId = searchParams.get('account') || accounts[0]?.id || '';
  const selectedAccount = accounts.find((account) => String(account.id) === String(selectedAccountId)) || null;

  const loadAccounts = useCallback(async () => {
    try {
      const result = await getGmailInstances(companyId);
      const activeInstanceId = await getActiveGmailInstanceId(companyId, currentUser?.id);
      const requestedAccountId = searchParams.get('account');
      const storedAccountIsAvailable = activeInstanceId
        && result.data.some((account) => String(account.id) === String(activeInstanceId));
      const defaultAccountId = requestedAccountId
        || (storedAccountIsAvailable ? activeInstanceId : result.data[0]?.id || '');

      setAccounts(result.data);
      setAccountsLoaded(true);
      if (!requestedAccountId && defaultAccountId) {
        setSearchParams((current) => {
          current.set('account', String(defaultAccountId));
          return current;
        }, { replace: true });
      }
      if (
        !requestedAccountId
        && defaultAccountId
        && currentUser?.id
        && String(defaultAccountId) !== String(activeInstanceId || '')
      ) {
        await setActiveGmailInstance({
          companyId,
          userId: currentUser.id,
          instanceId: defaultAccountId,
        });
      }
    } catch (loadError) {
      setError(loadError.message || 'Could not load Gmail accounts.');
      setAccountsLoaded(true);
    }
  }, [companyId, currentUser?.id, searchParams, setSearchParams]);

  const loadMessages = useCallback(async ({ clearError = true, initial = false } = {}) => {
    if (initial) setLoading(true);
    try {
      const loadedMessages = await getGmailMessages(companyId, selectedAccount);
      setMessages(loadedMessages.map((message) => ({
        ...message,
        is_read: normalizeReadValue(message.is_read),
      })));
      if (clearError) setError("");
    } catch (loadError) {
      setError(loadError.message || "Não foi possível carregar a caixa de entrada.");
    } finally {
      if (initial) setLoading(false);
    }
  }, [companyId, selectedAccount]);

  const syncInbox = useCallback(async () => {
    if (!companyId || !selectedAccount || syncInFlightRef.current) return;
    if (!canStartScheduledGmailSync(companyId, selectedAccount.id)) return;

    syncInFlightRef.current = true;
    setSyncing(true);
    try {
      await requestGmailInboxSync({ companyId, instance: selectedAccount });
      await loadMessages({ clearError: true });
    } catch (syncError) {
      setError(syncError.message || "Não foi possível sincronizar a caixa de entrada.");
    } finally {
      syncInFlightRef.current = false;
      setSyncing(false);
    }
  }, [companyId, loadMessages, selectedAccount]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (accountsLoaded) loadMessages({ initial: true });
  }, [accountsLoaded, loadMessages]);

  useEffect(() => {
    if (!accountsLoaded || !companyId || !selectedAccountId) return undefined;

    const pollingId = window.setInterval(syncInbox, GMAIL_POLL_INTERVAL_MS);

    return () => window.clearInterval(pollingId);
  }, [accountsLoaded, companyId, selectedAccountId, syncInbox]);

  useEffect(() => {
    if (!requestedId) {
      setSelectedId(null);
      setIsModalOpen(false);
      return;
    }

    const messageExists = messages.some((message) => String(getMessageId(message)) === String(requestedId));
    setSelectedId(requestedId);
    setIsModalOpen(messageExists);
  }, [messages, requestedId]);

  useEffect(() => {
    if (!isModalOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  const selectedMessage = messages.find((message) => String(getMessageId(message)) === String(selectedId));

  useEffect(() => {
    if (!isModalOpen || !selectedMessage || isMessageRead(selectedMessage) || !selectedMessage.id) return;
    if (readRequestIds.current.has(selectedMessage.id)) return;

    const messageId = selectedMessage.id;
    readRequestIds.current.add(messageId);
    setMessages((current) => current.map((item) => (
      item.id === messageId ? { ...item, is_read: "true" } : item
    )));

    markGmailMessageAsRead(messageId).catch((readError) => {
      setError(readError.message || "Não foi possível marcar a mensagem como lida.");
      console.error("Não foi possível marcar a mensagem Gmail como lida:", readError);
    }).finally(() => readRequestIds.current.delete(messageId));
  }, [isModalOpen, selectedMessage]);

  async function selectAccount(event) {
    const accountId = event.target.value;
    try {
      await setActiveGmailInstance({
        companyId,
        userId: currentUser?.id,
        instanceId: accountId,
      });
    } catch (selectionError) {
      setError(selectionError.message || "Não foi possível atualizar a conta Gmail ativa.");
      return;
    }
    setSearchParams((current) => {
      current.set('account', accountId);
      current.delete('message');
      return current;
    });
    setSelectedId(null);
    setIsModalOpen(false);
    setAccountPickerOpen(false);
  }

  function selectMessage(message) {
    const id = getMessageId(message);
    if (!id) return;

    setSelectedId(id);
    setIsModalOpen(true);
    setSearchParams((current) => {
      current.set('message', String(id));
      if (selectedAccountId) current.set('account', String(selectedAccountId));
      return current;
    });

  }

  function closeModal() {
    setIsModalOpen(false);
    setSelectedId(null);
    setSearchParams({});
  }

  async function openAttachment(attachment) {
    const id = attachment?.id || attachment?.attachment_id;
    if (!id) return;

    setOpeningAttachmentId(id);
    try {
      await openGmailAttachment({ attachmentId: id, companyId });
    } catch (openError) {
      setError(openError.message || "Não foi possível abrir o anexo.");
    } finally {
      setOpeningAttachmentId(null);
    }
  }

  function replyToMessage() {
    if (!selectedMessage) return;
    navigate("/atendimento/gmail/compor", {
      state: {
        to: selectedMessage.sender_email || "",
        subject: `Re: ${getMessageSubject(selectedMessage)}`,
      },
    });
  }

  const filteredMessages = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const normalizedSubjectFilter = subjectFilter.trim().toLowerCase();

    return messages.filter((message) => {
      const matchesGeneral = !normalizedSearchTerm || [
        message.subject,
        message.body_plain,
        message.sender_email,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedSearchTerm));

      const matchesSubject = !normalizedSubjectFilter
        || String(message.subject || "").toLowerCase().includes(normalizedSubjectFilter);

      return matchesGeneral && matchesSubject;
    });
  }, [messages, searchTerm, subjectFilter]);

  return (
    <GmailPage title="Caixa de Entrada">
      {error && <ErrorMessage text={error} />}
      {loading ? (
        <Empty icon={<LoaderCircle className={styles.spinner} size={24} />}>Carregando mensagens...</Empty>
      ) : messages.length === 0 ? (
        <Empty icon={<Inbox size={25} />}><strong>Caixa de entrada vazia</strong><span>As mensagens recebidas pelas contas conectadas aparecerão aqui.</span></Empty>
      ) : (
        <div className={styles.emailListContainer}>
          <div className={`${styles.inboxToolbar} ${subjectFilterOpen ? styles.filterMode : ""}`} role="search" aria-label="Buscar mensagens">
            {accounts.length > 0 && (
              <div className={styles.accountPicker}>
                <button type='button' className={styles.accountPickerButton} onClick={() => setAccountPickerOpen((current) => !current)} aria-label='Alternar conta Gmail' aria-expanded={accountPickerOpen} title='Alternar conta Gmail'>
                  <Mail size={16} />
                </button>
                {accountPickerOpen && (
                  <div className={styles.accountPopover}>
                    <label htmlFor='gmail-account-select'>Conta Gmail</label>
                    <select id='gmail-account-select' className={styles.accountSelect} value={selectedAccountId} onChange={selectAccount}>
                      {accounts.map((account) => <option key={account.id} value={account.id}>{getGmailInstanceEmail(account)}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
            <input
              className={styles.searchInput}
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Pesquisar por assunto, corpo ou remetente..."
              aria-label="Pesquisa geral"
            />
            {subjectFilterOpen && <input
              className={styles.subjectInput}
              type="search"
              value={subjectFilter}
              onChange={(event) => setSubjectFilter(event.target.value)}
              placeholder="Filtrar por assunto..."
              aria-label="Filtrar por assunto"
            />}
            <button
              type="button"
              className={`${styles.btnFilterIcon} ${subjectFilter ? styles.filterActive : ""}`}
              onClick={() => setSubjectFilterOpen((current) => !current)}
              aria-label={subjectFilterOpen ? "Ocultar filtro por assunto" : "Mostrar filtro por assunto"}
              aria-expanded={subjectFilterOpen}
              title="Filtrar por assunto"
            >
              <Filter size={16} />
            </button>
            <button
              type="button"
              className={styles.btnRefreshIcon}
              onClick={() => loadMessages()}
              disabled={loading || syncing}
              aria-label="Atualizar mensagens"
              title="Atualizar mensagens"
            >
              <RefreshCw size={16} className={loading || syncing ? styles.spinner : ""} />
            </button>
          </div>
          {filteredMessages.length === 0 ? (
            <Empty icon={<Inbox size={25} />}><strong>Nenhuma mensagem encontrada</strong><span>Ajuste os termos de pesquisa e tente novamente.</span></Empty>
          ) : filteredMessages.map((message) => {
            const messageId = getMessageId(message);
            const senderName = getSenderName(message);
            const senderEmail = message.sender_email || "E-mail não informado";
            return (
              <button type="button" key={message.id || messageId} className={`${styles.messageCard} ${isMessageRead(message) ? styles.messageRead : styles.messageUnread}`} onClick={() => selectMessage(message)}>
                <div className={styles.messageCardHeader}>
                  <div className={styles.senderBlock}>
                    <span className={styles.senderAvatar} aria-hidden="true">{getInitials(senderName)}</span>
                    <strong>{senderName}</strong>
                    <span>{senderEmail}</span>
                  </div>
                  <div className={styles.messageMeta}>
                    <time>{formatDate(getMessageDate(message))}</time>
                  </div>
                </div>
                <strong className={styles.messageSubject}>{getMessageSubject(message)}</strong>
                <span className={styles.messageSnippet}>{getMessageSnippet(message)}</span>
              </button>
            );
          })}
        </div>
      )}
      {isModalOpen && selectedMessage && (
        <EmailModal
          message={selectedMessage}
          openingAttachmentId={openingAttachmentId}
          onClose={closeModal}
          onOpenAttachment={openAttachment}
          onReply={replyToMessage}
        />
      )}
    </GmailPage>
  );
}

export function GmailCompose() {
  const { companyId } = useCompany();
  const location = useLocation();
  const replyState = location.state;
  const [form, setForm] = useState(() => ({
    to: replyState?.to || "",
    subject: replyState?.subject || "",
    body: "",
  }));
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.to.trim() || !form.subject.trim() || !form.body.trim()) {
      setMessage({ type: "error", text: "Preencha destinatário, assunto e mensagem." });
      return;
    }

    setSending(true);
    setMessage(null);
    try {
      await sendGmailEmail({ companyId, to: form.to.trim(), subject: form.subject.trim(), body: form.body.trim() });
      setForm({ to: "", subject: "", body: "" });
      setMessage({ type: "success", text: isDemoMode ? "Envio simulado. Nenhum e-mail foi enviado para fora da demonstração." : "E-mail enviado com sucesso." });
    } catch (sendError) {
      setMessage({ type: "error", text: sendError.message || "Não foi possível enviar o e-mail." });
    } finally {
      setSending(false);
    }
  }

  return (
    <GmailPage title="Compor Email" subtitle="Envie uma mensagem através de uma conta Gmail conectada.">
      <form className={styles.compose} onSubmit={handleSubmit}>
        <label>Para<input name="to" type="email" value={form.to} onChange={update} placeholder="nome@example.com" disabled={sending} /></label>
        <label>Assunto<input name="subject" value={form.subject} onChange={update} placeholder="Assunto do e-mail" disabled={sending} /></label>
        <label>Mensagem<textarea name="body" value={form.body} onChange={update} placeholder="Escreva sua mensagem..." rows="10" disabled={sending} /></label>
        <div className={styles.composeFooter}>
          <button type="submit" className={styles.primaryButton} disabled={sending}><Send size={16} /> {sending ? "Enviando..." : "Enviar Email"}</button>
          {message && <span className={message.type === "success" ? styles.success : styles.error}><AlertCircle size={15} />{message.text}</span>}
        </div>
      </form>
    </GmailPage>
  );
}

export function GmailAttachments() {
  const { companyId } = useCompany();
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState(null);
  const [error, setError] = useState("");

  const loadAttachments = useCallback(async () => {
    setLoading(true);
    try {
      setAttachments(await getGmailAttachments(companyId));
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Não foi possível carregar os anexos recebidos.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  async function openAttachment(attachment) {
    const id = attachment.id || attachment.attachment_id;
    setOpeningId(id);
    try {
      await openGmailAttachment({ attachmentId: id, companyId });
    } catch (openError) {
      setError(openError.message || "Não foi possível abrir o anexo.");
    } finally {
      setOpeningId(null);
    }
  }

  const refreshAction = useMemo(() => <button type="button" className={styles.btnRefresh} onClick={loadAttachments} disabled={loading}><RefreshCw size={15} className={loading ? styles.spinner : ""} /> Atualizar</button>, [loadAttachments, loading]);

  return (
    <GmailPage title="Anexos Recebidos" subtitle="Arquivos baixados a partir das mensagens do Gmail." action={refreshAction}>
      {error && <ErrorMessage text={error} />}
      {loading ? <Empty icon={<LoaderCircle className={styles.spinner} size={24} />}>Carregando anexos...</Empty> : attachments.length === 0 ? <Empty icon={<FileText size={25} />}><strong>Nenhum anexo recebido</strong><span>Arquivos encontrados nas mensagens do Gmail aparecerão nesta tabela.</span></Empty> : <div className={styles.tableWrap}><table><thead><tr><th>Arquivo</th><th>Mensagem</th><th>Recebido em</th><th aria-label="Ações" /></tr></thead><tbody>{attachments.map((attachment, index) => { const id = attachment.id || attachment.attachment_id; const messageId = attachment.message_id || attachment.gmail_message_id || attachment.email_id || attachment.id; return <tr key={`${id}-${index}`}><td><div className={styles.fileName}><FileText size={17} /><strong>{getAttachmentName(attachment)}</strong></div></td><td>{messageId ? <Link to={`/atendimento/gmail?message=${encodeURIComponent(messageId)}`}>Ver Mensagem</Link> : <span className={styles.muted}>Mensagem não identificada</span>}</td><td>{formatDate(attachment.received_at || attachment.created_at)}</td><td><button type="button" className={styles.openButton} onClick={() => openAttachment(attachment)} disabled={openingId === id || !id}>{openingId === id ? <LoaderCircle size={15} className={styles.spinner} /> : <ExternalLink size={15} />} Abrir</button></td></tr>; })}</tbody></table></div>}
    </GmailPage>
  );
}

function EmailModal({ message, openingAttachmentId, onClose, onOpenAttachment, onReply }) {
  const attachments = normalizeAttachments(message.attachments);
  const bodyHtml = message.body_html;
  const bodyPlain = message.body_plain || getMessageBody(message);
  const senderName = getSenderName(message);

  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="gmail-message-title">
        <header className={styles.modalHeader}>
          <div className={styles.modalSender}>
            <div className={styles.avatar}>{senderName.charAt(0).toUpperCase()}</div>
            <div>
              <strong>{senderName}</strong>
              <span>{message.sender_email || "E-mail não informado"}</span>
            </div>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Fechar mensagem"><X size={18} /></button>
        </header>
        <div className={styles.modalSubjectRow}>
          <h3 id="gmail-message-title">{getMessageSubject(message)}</h3>
          <time>{formatDate(getMessageDate(message))}</time>
        </div>
        <div className={styles.modalBody}>
          {bodyHtml ? <div className={styles.richMessageBody} dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(bodyHtml) }} /> : <div className={styles.plainMessageBody}>{bodyPlain}</div>}
        </div>
        {message.has_attachments === true && (
          <section className={styles.attachmentsSection}>
            <h4><Paperclip size={15} /> Anexos</h4>
            {attachments.length > 0 ? <div className={styles.attachmentList}>{attachments.map((attachment, index) => {
              const attachmentId = attachment.id || attachment.attachment_id;
              return <div className={styles.attachmentItem} key={attachmentId || index}><FileText size={16} /><span>{getAttachmentName(attachment)}</span><button type="button" className={styles.openButton} onClick={() => onOpenAttachment(attachment)} disabled={!attachmentId || openingAttachmentId === attachmentId}>{openingAttachmentId === attachmentId ? <LoaderCircle size={14} className={styles.spinner} /> : <ExternalLink size={14} />} Abrir Anexo</button></div>;
            })}</div> : <span className={styles.muted}>Nenhum arquivo disponível.</span>}
          </section>
        )}
        <footer className={styles.modalFooter}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>Fechar</button>
          <button type="button" className={styles.primaryButton} onClick={onReply}><Mail size={15} /> Responder</button>
        </footer>
      </section>
    </div>
  );
}

function sanitizeEmailHtml(html) {
  if (typeof DOMParser === "undefined") return "";
  const documentFragment = new DOMParser().parseFromString(String(html), "text/html");
  documentFragment.querySelectorAll("script, iframe, object, embed, form, base, meta, link, style").forEach((element) => element.remove());
  documentFragment.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith("on") || name === "style" || ((name === "href" || name === "src" || name === "xlink:href") && /^(javascript|vbscript|data):/.test(value))) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  return documentFragment.body.innerHTML;
}

function getSenderName(message) {
  return message?.sender_name || message?.sender_email || "Remetente não identificado";
}

function getInitials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 2).map((word) => word.charAt(0)).join("").toUpperCase();
}

function getMessageSnippet(message) {
  const source = message?.body_plain || message?.body_html || "";
  const snippet = String(source).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return snippet ? `${snippet.slice(0, 180)}${snippet.length > 180 ? "…" : ""}` : "Sem prévia disponível.";
}

function normalizeReadValue(value) {
  return String(value ?? "false").trim().toLowerCase() === "true" ? "true" : "false";
}

function isMessageRead(message) {
  return normalizeReadValue(message?.is_read) === "true";
}

function normalizeAttachments(attachments) {
  if (Array.isArray(attachments)) return attachments;
  if (typeof attachments === "string") {
    try {
      const parsed = JSON.parse(attachments);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

const gmailNavigation = [
  { to: "/atendimento/gmail", label: "Caixa de Entrada", Icon: Inbox, end: true },
  { to: "/atendimento/gmail/compor", label: "Compor Email", Icon: Mail, end: false },
  { to: "/atendimento/gmail/anexos", label: "Anexos Received", Icon: Paperclip, end: false },
];

function GmailPage({ action, children }) {
  const { setHeaderAction } = useChannelActions();

  useEffect(() => {
    setHeaderAction(action || null);
    return () => setHeaderAction(null);
  }, [action, setHeaderAction]);

  return (
    <section className={styles.root}>
      <div className={styles.gmailLayout}>
        <aside className={styles.tabSidebar}>
          <nav className={styles.tabNavSidebar} aria-label="Navegação do Gmail">
            {gmailNavigation.map(({ to, label, Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? styles.tabActive : styles.tabItem}><Icon size={15} /><span>{label}</span></NavLink>)}
          </nav>
        </aside>
        <div className={styles.gmailContent}>
          <div className={styles.panel}>{children}</div>
        </div>
      </div>
    </section>
  );
}

function Empty({ icon, children }) {
  return <div className={styles.empty}>{icon}{children}</div>;
}

function ErrorMessage({ text }) {
  return <div className={styles.errorBanner} role="alert"><AlertCircle size={17} />{text}</div>;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
