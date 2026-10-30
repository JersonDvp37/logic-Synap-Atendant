const STORAGE_PREFIX = "logic-synap:conversation-read-state";

function storageKey(companyId) {
  return `${STORAGE_PREFIX}:${companyId}`;
}

function readState(companyId) {
  if (!companyId || typeof window === "undefined") return {};

  try {
    return JSON.parse(window.localStorage.getItem(storageKey(companyId)) || "{}") ?? {};
  } catch {
    return {};
  }
}

export function getUnreadConversationIds({ companyId, conversations }) {
  const openedAtByConversation = readState(companyId);

  return new Set((conversations ?? []).filter((conversation) => {
    const receivedAt = conversation.last_inbound_message?.created_at;
    if (!receivedAt) return false;

    const openedAt = openedAtByConversation[conversation.id];
    return !openedAt || new Date(receivedAt).getTime() > new Date(openedAt).getTime();
  }).map((conversation) => conversation.id));
}

export function markConversationAsRead({ companyId, conversationId, readAt }) {
  if (!companyId || !conversationId || !readAt || typeof window === "undefined") return;

  const current = readState(companyId);
  const previous = current[conversationId];

  if (previous && new Date(previous).getTime() >= new Date(readAt).getTime()) return;

  window.localStorage.setItem(storageKey(companyId), JSON.stringify({
    ...current,
    [conversationId]: readAt,
  }));
}
