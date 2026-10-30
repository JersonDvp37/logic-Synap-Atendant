import { useEffect, useRef } from "react";
import { supabase } from "../services/supabase";

const POLL_INTERVAL_MS = 300000;
const TABLES = [
  { key: "whatsapp", table: "whatsapp_messages", label: "mensagem(ns) do WhatsApp" },
  { key: "gmail", table: "gmail_messages", label: "e-mail(s) novo(s)" },
  { key: "appointments", table: "agendamentos", label: "agendamento(s) novo(s)" },
];

function storageKey(companyId) {
  return `logic-synap:notification-polling:${companyId}`;
}

async function countNewRecords({ table, companyId, since, until }) {
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gt("created_at", since);

  if (until) query = query.lte("created_at", until);
  return query;
}

export function useNotificationPolling({ companyId, enabled = true, onNotification }) {
  const callbackRef = useRef(onNotification);

  useEffect(() => {
    callbackRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    if (!companyId || !enabled || !supabase) return undefined;

    let disposed = false;
    const key = storageKey(companyId);
    let since = window.localStorage.getItem(key) || new Date().toISOString();

    async function checkForNotifications() {
      const until = new Date().toISOString();
      const results = await Promise.all(TABLES.map(async (item) => {
        const { count, error } = await countNewRecords({ ...item, companyId, since, until });
        if (error) return { ...item, count: 0 };
        return { ...item, count: count || 0 };
      }));

      since = until;
      window.localStorage.setItem(key, since);

      if (disposed) return;
      const changes = results.filter((item) => item.count > 0);
      if (changes.length) {
        callbackRef.current?.({
          total: changes.reduce((total, item) => total + item.count, 0),
          changes,
        });
      }
    }

    const intervalId = window.setInterval(checkForNotifications, POLL_INTERVAL_MS);
    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [companyId, enabled]);
}
