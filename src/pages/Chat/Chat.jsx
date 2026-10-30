import {
  useCallback, useEffect, useRef, useState,
} from "react";
import {
  AlertCircle, Bold, Bot, Check, Copy, ImagePlus, List, LoaderCircle,
  MessageSquare, Plus, Send, Square, Trash2, Type, UserRound, X,
} from "lucide-react";

import {
  createConversation, createUserMessage, deleteConversation,
  getConversationMessages, listConversations,
  renameConversation, requestAssistantResponse, uploadChatImage,
} from "../../services/chatService";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";
import { buildCompanyContext } from "../../services/companyContextService";
import MarkdownMessage from "../../components/Markdown/MarkdownMessage";

import styles from "./Chat.module.css";

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function Chat() {
  const { user } = useAuth();
  const { company, companyId } = useCompany();
  const companyContext = buildCompanyContext(company);

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] =
    useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingConversations, setLoadingConversations] =
    useState(true);
  const [loadingMessages, setLoadingMessages] =
    useState(false);
  const [deletingConversationId, setDeletingConversationId] =
    useState(null);
  const [error, setError] = useState("");
  const [failedAssistantRequest, setFailedAssistantRequest] =
    useState(null);
  const [historyCollapsed, setHistoryCollapsed] =
    useState(true);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [imagePreviews, setImagePreviews] = useState([]);
  const [pendingImageMessageId, setPendingImageMessageId] = useState(null);

  const messagesEndRef = useRef(null);
  const historyMenuRef = useRef(null);
  const composerInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const mountedRef = useRef(true);
  const messagesRequestRef = useRef(0);
  const assistantAbortRef = useRef(null);
  const imageTimerRef = useRef(null);

  const activeConversation = conversations.find(
    (conversation) =>
      conversation.id === activeConversationId
  );

  const appendMessageIfMissing = useCallback((message) => {
    if (!message?.id) return;

    setMessages((current) => {
      const exists = current.some(
        (item) => item.id === message.id
      );

      return exists ? current : [...current, message];
    });
  }, []);

  const refreshMessages = useCallback(async ({
    conversationId,
    showLoading = false,
  }) => {
    const requestId = ++messagesRequestRef.current;

    if (showLoading && mountedRef.current) {
      setLoadingMessages(true);
    }

    try {
      const items = await getConversationMessages({
        conversationId,
        companyId,
      });

      if (
        mountedRef.current &&
        requestId === messagesRequestRef.current
      ) {
        setMessages(items);
      }

      return items;
    } finally {
      if (
        showLoading &&
        mountedRef.current &&
        requestId === messagesRequestRef.current
      ) {
        setLoadingMessages(false);
      }
    }
  }, [companyId]);

  const waitForAssistantMessage = useCallback(async ({
    conversationId,
    knownMessageIds,
    attempts = 12,
    signal,
  }) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (!mountedRef.current) return null;

      const refreshedMessages = await refreshMessages({
        conversationId,
      });
      const newAssistantMessage = refreshedMessages.find(
        (item) =>
          item.role === "assistant" &&
          !knownMessageIds.has(item.id)
      );

      if (newAssistantMessage) {
        return newAssistantMessage;
      }

      if (attempt < attempts - 1) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 1000);
        });
      }
    }

    return null;
  }, [refreshMessages]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      messagesRequestRef.current += 1;
      assistantAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      let initialMessagesRequestId = null;

      if (!companyId) {
        setConversations([]);
        setActiveConversationId(null);
        setMessages([]);
        setLoadingConversations(false);
        return;
      }

      try {
        setLoadingConversations(true);
        setError("");

        const items = await listConversations(companyId);

        if (cancelled || !mountedRef.current) return;

        setConversations(items);

        if (!items.length) {
          setActiveConversationId(null);
          setMessages([]);
          return;
        }

        const firstConversation = items[0];
        setActiveConversationId(firstConversation.id);
        setLoadingMessages(true);
        initialMessagesRequestId =
          ++messagesRequestRef.current;

        const loadedMessages =
          await getConversationMessages({
            conversationId: firstConversation.id,
            companyId,
          });

        if (
          !cancelled &&
          mountedRef.current &&
          initialMessagesRequestId ===
            messagesRequestRef.current
        ) {
          setMessages(loadedMessages);
        }
      } catch (loadError) {
        if (!cancelled && mountedRef.current) {
          setError(
            loadError.message ||
              "Não foi possível carregar as conversas."
          );
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoadingConversations(false);

          if (
            initialMessagesRequestId === null ||
            initialMessagesRequestId ===
              messagesRequestRef.current
          ) {
            setLoadingMessages(false);
          }
        }
      }
    }

    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, sending]);

  useEffect(() => {
    if (historyCollapsed) return;

    function closeHistoryMenu(event) {
      if (
        !historyMenuRef.current?.contains(event.target)
      ) {
        setHistoryCollapsed(true);
      }
    }

    function closeHistoryMenuWithKeyboard(event) {
      if (event.key === "Escape") {
        setHistoryCollapsed(true);
      }
    }

    document.addEventListener("mousedown", closeHistoryMenu);
    document.addEventListener(
      "keydown",
      closeHistoryMenuWithKeyboard
    );
    return () => {
      document.removeEventListener(
        "mousedown",
        closeHistoryMenu
      );
      document.removeEventListener(
        "keydown",
        closeHistoryMenuWithKeyboard
      );
    };
  }, [historyCollapsed]);

  useEffect(() => {
    return () => {
      if (imageTimerRef.current) {
        clearTimeout(imageTimerRef.current);
      }
    };
  }, []);

  async function handleNewConversation() {
    if (!companyId || !user?.id) {
      setError("Empresa ou usuário não identificado.");
      return;
    }

    try {
      setSending(true);
      setError("");

      const conversation = await createConversation({
        companyId,
        userId: user.id,
      });

      if (!mountedRef.current) return;

      setConversations((items) => [
        conversation,
        ...items,
      ]);
      setActiveConversationId(conversation.id);
      setMessages([]);
      setInput("");
      setHistoryCollapsed(true);
    } catch (createError) {
      if (mountedRef.current) {
        setError(
          createError.message ||
            "Não foi possível criar a conversa."
        );
      }
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }

  async function handleSelectConversation(conversationId) {
    try {
      setError("");
      setFailedAssistantRequest(null);
      setActiveConversationId(conversationId);
      setInput("");
      setMessages([]);

      await refreshMessages({
        conversationId,
        showLoading: true,
      });

      if (mountedRef.current) {
        setHistoryCollapsed(true);
      }
    } catch (selectError) {
      if (!mountedRef.current) return;

      setMessages([]);
      setError(
        selectError.message ||
          "Não foi possível abrir a conversa."
      );
    }
  }

  async function handleDeleteConversation(
    event,
    conversationId
  ) {
    event.stopPropagation();

    if (
      !window.confirm(
        "Deseja realmente excluir esta conversa?"
      )
    ) return;

    try {
      setDeletingConversationId(conversationId);
      setError("");
      await deleteConversation({
        conversationId,
        companyId,
      });

      if (!mountedRef.current) return;

      const deletedIndex = conversations.findIndex(
        (item) => item.id === conversationId
      );
      const remaining = conversations.filter(
        (item) => item.id !== conversationId
      );

      setConversations(remaining);

      if (activeConversationId === conversationId) {
        const next =
          remaining[deletedIndex] ??
          remaining[deletedIndex - 1] ??
          null;

        if (next) {
          await handleSelectConversation(next.id);
        } else if (mountedRef.current) {
          setActiveConversationId(null);
          setMessages([]);
          setInput("");
          setHistoryCollapsed(false);
        }
      }
    } catch (deleteError) {
      if (mountedRef.current) {
        setError(
          deleteError.message ||
            "Não foi possível excluir a conversa."
        );
      }
    } finally {
      if (mountedRef.current) {
        setDeletingConversationId(null);
      }
    }
  }

  function handleCancelProcessing() {
    assistantAbortRef.current?.abort();
    assistantAbortRef.current = null;
    setSending(false);
  }

  async function handleSendMessage(event) {
    event?.preventDefault();

    const text = input.trim();
    const hasImages = imagePreviews.length > 0;

    // Se não tem texto nem imagem, não faz nada
    if (!text && !hasImages) {
      return;
    }

    // Se tem imagem(ns), envia as imagens (com ou sem texto associado)
    if (hasImages) {
      setSending(true);
      setError("");
      await sendImages({ text });
      return;
    }

    if (sending || !companyId || !user?.id) {
      return;
    }

    let savedUserMessage = null;
    let requestConversationId = activeConversationId;
    const knownMessageIds = new Set(
      messages.map((message) => message.id)
    );

    try {
      setSending(true);
      setError("");
      setFailedAssistantRequest(null);
      let conversationId = activeConversationId;
      let conversation = activeConversation;

      if (!conversationId) {
        conversation = await createConversation({
          companyId,
          userId: user.id,
        });
        conversationId = conversation.id;
        requestConversationId = conversationId;

        if (!mountedRef.current) return;

        setConversations((items) => [
          conversation,
          ...items,
        ]);
        setActiveConversationId(conversationId);
        setMessages([]);
      }

      savedUserMessage = await createUserMessage({
        conversationId,
        companyId,
        userId: user.id,
        content: text,
      });

      if (!mountedRef.current) return;

      appendMessageIfMissing(savedUserMessage);
      setInput("");
      setFormatMenuOpen(false);

      if (
        conversation?.title === "Nova conversa"
      ) {
        const title =
          text.length > 50
            ? `${text.slice(0, 50)}…`
            : text;

        await renameConversation({
          conversationId,
          companyId,
          title,
        });

        if (!mountedRef.current) return;

        setConversations((items) =>
          items.map((item) =>
            item.id === conversationId
              ? { ...item, title }
              : item
          )
        );
      }

      const assistantMessage = await requestAssistantResponse({
        conversationId,
        companyId,
        companyContext,
        messageId: savedUserMessage.id,
        userId: user?.id,
        message: text,
      });

      if (!mountedRef.current) return;

      if (assistantMessage?.content) {
        appendMessageIfMissing(assistantMessage);
      }

      const persistedAssistantMessage =
        await waitForAssistantMessage({
          conversationId,
          knownMessageIds,
        });

      if (
        !assistantMessage?.content &&
        !persistedAssistantMessage
      ) {
        throw new Error(
          "A resposta foi processada, mas ainda não apareceu no histórico."
        );
      }

      if (
        assistantMessage?.content &&
        !persistedAssistantMessage
      ) {
        appendMessageIfMissing(assistantMessage);
      }
    } catch (sendError) {
      if (sendError.name === "AbortError") return;
      if (mountedRef.current) {
        if (savedUserMessage?.id) {
          setFailedAssistantRequest({
            conversationId: requestConversationId,
            messageId: savedUserMessage.id,
            message: text,
          });
        }

        setError(
          sendError.message ||
            "Não foi possível obter a resposta do assistente."
        );
      }
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }

  async function handleRetryAssistant() {
    if (!failedAssistantRequest || sending) return;

    try {
      setSending(true);
      setError("");

      const assistantMessage = await requestAssistantResponse({
        ...failedAssistantRequest,
        companyId,
        companyContext,
      });

      if (!mountedRef.current) return;

      if (assistantMessage?.content) {
        appendMessageIfMissing(assistantMessage);
      }

      const knownMessageIds = new Set(
        messages.map((message) => message.id)
      );
      const persistedAssistantMessage =
        await waitForAssistantMessage({
          conversationId:
            failedAssistantRequest.conversationId,
          knownMessageIds,
        });

      if (
        !assistantMessage?.content &&
        !persistedAssistantMessage
      ) {
        throw new Error(
          "A resposta foi processada, mas ainda não apareceu no histórico."  
        );
      }

      if (
        assistantMessage?.content &&
        !persistedAssistantMessage
      ) {
        appendMessageIfMissing(assistantMessage);
      }

      if (mountedRef.current) {
        setFailedAssistantRequest(null);
      }
    } catch (retryError) {
      if (mountedRef.current) {
        setError(
          retryError.message ||
            "Não foi possível obter a resposta do assistente."
        );
      }
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }

  function handleKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      handleSendMessage();
    }
  }

  function handleImageClick() {
    imageInputRef.current?.click();
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageError("");

    // Validar tipo de arquivo
    if (!file.type.startsWith("image/")) {
      setImageError("Por favor, selecione uma imagem válida.");
      return;
    }

    // Validar tamanho (10 MB)
    const maxSizeInBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      setImageError("A imagem deve ter no máximo 10 MB.");
      return;
    }

    try {
      // Converter imagem para data URL para preview
      const reader = new FileReader();
      const imageDataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(new Error("Erro ao processar imagem."));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      if (mountedRef.current) {
        // Adicionar imagem ao array de previews
        const newImage = {
          id: generateUUID(),
          dataUrl: imageDataUrl,
          name: file.name,
        };
        setImagePreviews((prev) => [...prev, newImage]);
      }
    } catch (error) {
      if (mountedRef.current) {
        setImageError("Erro ao processar a imagem.");
      }
    } finally {
      // Limpar o input de arquivo
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  }

  function handleRemoveImagePreview(imageId) {
    setImagePreviews((prev) =>
      imageId ? prev.filter((img) => img.id !== imageId) : []
    );
    setImageError("");
  }


  async function sendImages({ text = "" } = {}) {
    if (!imagePreviews.length || !companyId || !user?.id) {
      return;
    }

    let conversationId = activeConversationId;
    let conversation = activeConversation;

    try {
      setUploadingImage(true);
      setError("");

      // Se não houver uma conversa ativa, cria uma primeiro
      if (!conversationId) {
        conversation = await createConversation({
          companyId,
          userId: user.id,
        });
        conversationId = conversation.id;

        if (!mountedRef.current) return;

        setConversations((items) => [
          conversation,
          ...items,
        ]);
        setActiveConversationId(conversationId);
        setMessages([]);
      }

      // Enviar cada imagem
      for (let i = 0; i < imagePreviews.length; i++) {
        const imagePreview = imagePreviews[i];
        const imageMessageId = generateUUID();
        const imageBase64 = imagePreview.dataUrl.split(",")[1];
        
        // Se for a primeira imagem e houver texto, associa o texto a ela.
        // Caso contrário, usa "uploaded image".
        const currentMessage = i === 0 && text ? text : "uploaded image";

        await uploadChatImage({
          conversationId: conversationId,
          companyId,
          companyContext,
          userId: user.id,
          messageId: imageMessageId,
          imageBase64,
          fileName: imagePreview.name,
          message: currentMessage,
          dataUrl: imagePreview.dataUrl,
        });
      }

      if (mountedRef.current) {
        // Se a conversa for nova ("Nova conversa"), renomeia a conversa com base no texto ou nome do arquivo
        if (conversation?.title === "Nova conversa") {
          const title = text 
            ? (text.length > 50 ? `${text.slice(0, 50)}…` : text)
            : `Imagem: ${imagePreviews[0].name}`;

          await renameConversation({
            conversationId,
            companyId,
            title,
          });

          if (!mountedRef.current) return;

          setConversations((items) =>
            items.map((item) =>
              item.id === conversationId
                ? { ...item, title }
                : item
            )
          );
        }

        // Recarregar mensagens para mostrar as imagens processadas
        const updatedMessages = await refreshMessages({
          conversationId: conversationId,
          showLoading: false,
        });

        // Encontrar o último ID de mensagem para configurar timer
        const lastMessage = updatedMessages?.[updatedMessages.length - 1];
        if (lastMessage?.id) {
          setPendingImageMessageId(lastMessage.id);
          setupImageRemovalTimer(lastMessage.id);
        }

        // Limpar previews e texto do input
        setImagePreviews([]);
        setInput("");
        setFormatMenuOpen(false);
      }
    } catch (error) {
      if (mountedRef.current) {
        setImageError(
          error.message || "Erro ao enviar a imagem."
        );
      }
    } finally {
      if (mountedRef.current) {
        setUploadingImage(false);
        setSending(false);
      }
    }
  }

  function setupImageRemovalTimer(messageId) {
    // Limpar timer anterior se existir
    if (imageTimerRef.current) {
      clearTimeout(imageTimerRef.current);
    }

    // Configurar timer de 1 hora (3600000 ms)
    imageTimerRef.current = setTimeout(() => {
      handleImageRemovalTimeout(messageId);
    }, 3600000);
  }

  async function handleImageRemovalTimeout(messageId) {
    if (!mountedRef.current || activeConversationId !== activeConversationId) return;

    try {
      setMessages((current) => {
        // Remover a mensagem de imagem e adicionar mensagem de remoção
        const filtered = current.filter((msg) => msg.id !== messageId);
        
        const removalMessage = {
          id: `removal-${messageId}`,
          conversation_id: activeConversationId,
          company_id: companyId,
          created_by: user.id,
          role: "system",
          content: "IMAGENS TEMPORARIA REMOVIDA",
          created_at: new Date().toISOString(),
        };

        return [...filtered, removalMessage];
      });

      setPendingImageMessageId(null);
    } catch (error) {
      console.error("Erro ao remover imagem temporária:", error);
    }
  }

  function applyComposerFormat(type) {
    const textarea = composerInputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = input.slice(start, end);
    let replacement;
    let cursorStart;
    let cursorEnd;

    if (type === "bold") {
      replacement = `**${selectedText}**`;
      cursorStart = start + 2;
      cursorEnd = selectedText ? end + 2 : start + 2;
    } else {
      const lineStart = input.lastIndexOf("\n", start - 1) + 1;
      const selectionEnd = end || start;
      const block = input.slice(lineStart, selectionEnd);
      replacement = block.split("\n").map((line) => `- ${line}`).join("\n");
      setInput(`${input.slice(0, lineStart)}${replacement}${input.slice(selectionEnd)}`);
      setFormatMenuOpen(false);
      window.requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(lineStart + 2, lineStart + replacement.length);
      });
      return;
    }

    setInput(`${input.slice(0, start)}${replacement}${input.slice(end)}`);
    setFormatMenuOpen(false);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  async function handleCopyMessage(message) {
    await navigator.clipboard.writeText(cleanAssistantPrefix(message.content));
    setCopiedMessageId(message.id);
  }

  return (
    <div className={`${styles.root} page chat-page`}>
      <section
        className={`chat-panel ${styles.chatPanel} ${
          historyCollapsed ? styles.historyCollapsed : ""
        }`}
      >
        <aside
          ref={historyMenuRef}
          className={styles.history}
          aria-hidden={historyCollapsed}
        >
          <div className={styles.historyHeader}>
            <button
              type="button"
              className={styles.newConversation}
              onClick={handleNewConversation}
              disabled={sending || loadingConversations}
            >
              <Plus size={17} />
              <span>Nova conversa</span>
            </button>

            <button
              type="button"
              className={styles.collapseButton}
              onClick={() => setHistoryCollapsed(true)}
              aria-label="Fechar conversas recentes"
            >
              <X size={18} />
            </button>
          </div>

          <div className={styles.conversationList}>
            {loadingConversations && (
              <div className={styles.listLoading}>
                <LoaderCircle
                  size={18}
                  className={styles.spinner}
                />
                <span>Carregando conversas...</span>
              </div>
            )}

            {!loadingConversations &&
              !conversations.length && (
              <p className={styles.noConversations}>
                Nenhuma conversa ainda
              </p>
              )}

            {conversations.map((conversation) => (
              <div
                className={`${styles.conversationItem} ${
                  conversation.id === activeConversationId
                    ? styles.activeConversation
                    : ""
                }`}
                key={conversation.id}
              >
                <button
                  type="button"
                  className={styles.selectConversation}
                  onClick={() =>
                    handleSelectConversation(conversation.id)
                  }
                >
                  <MessageSquare size={16} />
                  <span>{conversation.title}</span>
                </button>

                <button
                  type="button"
                  className={styles.deleteButton}
                  aria-label={`Excluir ${conversation.title}`}
                  disabled={
                    deletingConversationId === conversation.id
                  }
                  onClick={(event) =>
                    handleDeleteConversation(
                      event,
                      conversation.id
                    )
                  }
                >
                  {deletingConversationId === conversation.id ? (
                    <LoaderCircle
                      size={15}
                      className={styles.spinner}
                    />
                  ) : (
                    <Trash2 size={15} />
                  )}
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className={styles.conversation}>
          <header className={styles.conversationHeader}>
            <button
              type="button"
              className={styles.expandButton}
              onClick={() => setHistoryCollapsed(false)}
              aria-label="Mostrar conversas recentes"
              aria-expanded={!historyCollapsed}
            >
              <MessageSquare size={17} />
              <span>Conversas recentes</span>
            </button>

            <h2>
              {activeConversation?.title ||
                "Chat Interno"}
            </h2>
          </header>

          <div
            className={`messages ${styles.messages}`}
            aria-live="polite"
          >
            {!loadingMessages && !activeConversation && (
              <div className={`empty ${styles.empty}`}>
                <Bot size={38} />
                <h2>Nenhuma conversa selecionada</h2>
                <p>
                  Selecione uma conversa ou crie uma nova para
                  começar.
                </p>
              </div>
            )}

            {activeConversation &&
              !messages.length &&
              !sending &&
              !loadingMessages && (
                <div className={`empty ${styles.empty}`}>
                  <Bot size={38} />
                  <p>
                    Faça uma pergunta sobre o conhecimento da
                    sua empresa.
                  </p>
                </div>
              )}

              {loadingMessages && (
                <div className={styles.messagesLoading}>
                  <LoaderCircle
                    size={20}
                    className={styles.spinner}
                  />
                  <span>Carregando mensagens...</span>
                </div>
              )}

              {!loadingMessages && messages.map((message) => (
                <div
                  className={`message ${message.role} ${
                    message.role === "assistant"
                      ? styles.assistant
                      : styles.user
                  }`}
                  key={message.id}
                >
                  {message.role === "user" ? (
                    <UserRound size={17} />
                  ) : (
                    <Bot size={17} />
                  )}
                  <div className={styles.messageBody}>
                    <MarkdownMessage content={cleanAssistantPrefix(message.content)} />
                    <button type="button" className={styles.copyButton} onClick={() => handleCopyMessage(message)} aria-label="Copiar mensagem" title="Copiar mensagem">
                      <Copy size={13} />
                      <span>{copiedMessageId === message.id ? "Copiado" : "Copiar"}</span>
                    </button>
                  </div>
                </div>
              ))}

            {sending && activeConversation && (
              <div
                className={`message assistant ${styles.assistant} ${styles.thinking}`}
              >
                <Bot size={17} />
                <p>
                  <LoaderCircle
                    size={15}
                    className={styles.spinner}
                  />
                  Pensando...
                </p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div className={styles.error} role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
              {failedAssistantRequest && (
                <button
                  type="button"
                  onClick={handleRetryAssistant}
                  disabled={sending}
                >
                  Tentar novamente
                </button>
              )}
              <button
                type="button"
                onClick={() => setError("")}
              >
                Fechar
              </button>
            </div>
          )}

          <form
            className={`composer ${styles.composer}`}
            onSubmit={handleSendMessage}
          >
            {imageError && (
              <div className={styles.imageError} role="alert">
                <AlertCircle size={16} />
                <span>{imageError}</span>
                <button
                  type="button"
                  onClick={() => setImageError("")}
                  aria-label="Fechar erro de imagem"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className={styles.composerActions}>
              <div className={styles.inputShell}>
                {formatMenuOpen && (
                  <div className={styles.formatMenu} role="toolbar" aria-label="Formatar mensagem">
                    <button type="button" onClick={() => applyComposerFormat("bold")} title="Negrito"><Bold size={16} /><span>Negrito</span></button>
                    <button type="button" onClick={() => applyComposerFormat("list")} title="Lista"><List size={16} /><span>Lista</span></button>
                  </div>
                )}
                <div className={styles.toolsContainer}>
                  <button
                    type="button"
                    className={styles.formatToggle}
                    onClick={() => setFormatMenuOpen((open) => !open)}
                    aria-label="Opções de formatação"
                    aria-expanded={formatMenuOpen}
                  >
                    <Type size={20} strokeWidth={2.6} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.imageUploadButton}
                    onClick={handleImageClick}
                    disabled={uploadingImage || sending || loadingConversations || loadingMessages || !activeConversationId}
                    aria-label="Upload de imagem"
                    title="Fazer upload de imagem (máximo 10 MB)"
                  >
                    {uploadingImage ? (
                      <LoaderCircle size={20} strokeWidth={2.6} className={styles.spinner} />
                    ) : (
                      <ImagePlus size={20} strokeWidth={2.6} aria-hidden="true" />
                    )}
                  </button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className={styles.hiddenFileInput}
                    aria-hidden="true"
                    disabled={uploadingImage || sending}
                  />
                </div>
                
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {imagePreviews.length > 0 && (
                      <div className={styles.imagePreviews}>
                        {imagePreviews.map((image) => (
                          <div key={image.id} className={styles.imagePreviewItem}>
                            <img 
                              src={image.dataUrl} 
                              alt={image.name}
                              className={styles.imagePreviewItemImg}
                            />
                            <span className={styles.imageName}>{image.name.length > 15 ? `${image.name.slice(0, 15)}...` : image.name}</span>
                            <div
                              type=""
                              className={styles.removeImageItemButton}
                              onClick={() => handleRemoveImagePreview(image.id)}
                              aria-label="Remover imagem"
                              title="Remover imagem"
                            >
                              <X size={15} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <textarea
                      ref={composerInputRef}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={activeConversation ? "Digite sua mensagem..." : "Digite para iniciar uma nova conversa..."}
                      rows={Math.min(6, Math.max(3, input.split("\n").length))}
                      disabled={sending || loadingConversations || loadingMessages || !companyId}
                      aria-label="Mensagem"
                    />
                </div>
              </div>

              {sending ? (
                <button type="button" className={styles.sendButton} onClick={handleCancelProcessing} aria-label="Cancelar processamento" title="Cancelar processamento"><Square size={18} fill="currentColor" /></button>
              ) : (
                <button type="submit" className={styles.sendButton} disabled={(!input.trim() && !imagePreviews.length) || loadingConversations || loadingMessages || !companyId} aria-label="Enviar"><Send className={styles.sendMessage}  /></button>
              )}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
function cleanAssistantPrefix(content = "") {
  return content.replace(/^\s*Resposta\s+do\s+Gemini\s*:\s*/i, "").trimStart();
}
}
