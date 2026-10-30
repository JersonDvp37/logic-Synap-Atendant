import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useCompany } from "./CompanyContext";
import { getWhatsAppChannel } from "../services/whatsappChannelService";

const WhatsAppChannelContext = createContext(null);

export function WhatsAppChannelProvider({ children }) {
  const { companyId } = useCompany();
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const loadChannel = useCallback(async ({ initial = false } = {}) => {
    const requestId = ++requestIdRef.current;

    if (!companyId) {
      setChannel(null);
      setError("");
      setLoading(false);
      setRefreshing(false);
      return null;
    }

    if (initial) setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const data = await getWhatsAppChannel(companyId);
      if (requestId === requestIdRef.current) setChannel(data ?? null);
      return data;
    } catch (loadError) {
      if (requestId === requestIdRef.current) {
        setError(loadError.message || "Nao foi possivel carregar o canal WhatsApp.");
      }
      throw loadError;
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [companyId]);

  const refreshChannel = useCallback(() => loadChannel(), [loadChannel]);

  useEffect(() => {
    requestIdRef.current += 1;
    setChannel(null);
    setError("");
    setLoading(true);
    loadChannel({ initial: true }).catch(() => {});

    return () => {
      requestIdRef.current += 1;
    };
  }, [companyId, loadChannel]);

  const disconnectedStatuses = ["disconnected", "inactive", "unlinked", "desvinculado"];
  const channelStatus = String(channel?.status || "").toLowerCase();
  const webhookStatus = String(channel?.webhook_status || "").toLowerCase();
  const isDisconnected =
    disconnectedStatuses.includes(channelStatus) ||
    disconnectedStatuses.includes(webhookStatus);

  const isConfigured = Boolean(
    !isDisconnected &&
    channel?.id &&
    channel?.company_id === companyId &&
    channel?.phone_number_id
  );
  const isActive = isConfigured && channel?.status === "active";

  return (
    <WhatsAppChannelContext.Provider value={{
      channel,
      isConfigured,
      isActive,
      loading,
      refreshing,
      error,
      refreshChannel,
    }}>
      {children}
    </WhatsAppChannelContext.Provider>
  );
}

export function useWhatsAppChannel() {
  const context = useContext(WhatsAppChannelContext);
  if (!context) {
    throw new Error("useWhatsAppChannel deve ser utilizado dentro de WhatsAppChannelProvider.");
  }
  return context;
}
