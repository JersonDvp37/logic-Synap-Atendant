import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useCompany } from "../contexts/CompanyContext";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../services/supabase";
import { isDemoMode } from "../services/demoService";

export const DEFAULT_DISCOVERY_TEXT =
  "💡 Explore os recursos do Synap para otimizar seu trabalho e aumentar a produtividade da sua equipe.";

const DYNAMIC_TIP_TTL_MS = 15 * 60 * 1000;
const DEFAULT_TIP_TTL_MS = 15 * 60 * 1000;
const FADE_DURATION_MS = 220;
const CACHE_KEY_PREFIX = "logic-synap:discovery-tip";

const DISCOVERY_WEBHOOK_URL = import.meta.env.VITE_N8N_DISCOVERY_FEATURE_WEBHOOK_URL || "";

export const FEATURE_DISCOVERY_PINS = [
  "pin_doc_resumo_executivo", "pin_doc_extracao_prazos", "pin_doc_explicacao_contratos", "pin_doc_comparacao_propostas", "pin_doc_extracao_requisitos", "pin_doc_politicas_internas", "pin_doc_busca_conceitos", "pin_doc_checklists_operacionais", "pin_doc_analise_riscos", "pin_doc_sintese_reuniao", "pin_doc_normas_compliance", "pin_doc_fatos_historicos", "pin_doc_dicionario_termos", "pin_doc_valida_escopo", "pin_doc_fichas_tecnicas", "pin_doc_triagem_fatura", "pin_doc_matriz_responsabilidade", "pin_doc_fluxo_trabalho", "pin_doc_guia_integracao", "pin_doc_auditoria_conteudo", "pin_doc_sumario_diretivo", "pin_doc_pesquisa_multiplos", "pin_doc_mudar_tom_comunicacao", "pin_doc_extracao_contatos", "pin_doc_valida_versao",
  "pin_chat_roteiro_conteudo", "pin_chat_tom_de_voz", "pin_chat_matriz_swot", "pin_chat_simulacao_vendas", "pin_chat_faqs_internas", "pin_chat_diferenciais_competitivos", "pin_chat_ideias_inovacao", "pin_chat_argumentario_comercial", "pin_chat_script_qualificacao", "pin_chat_modelo_comunicado", "pin_chat_resumo_sessao", "pin_chat_validacao_citacao", "pin_chat_traduc_simplificada", "pin_chat_plano_acao", "pin_chat_modelos_email", "pin_chat_simulacao_crise", "pin_chat_revisao_gramatical", "pin_chat_proposta_valor", "pin_chat_guia_resolucao", "pin_chat_extracao_insights", "pin_chat_preparacao_pitch", "pin_chat_comparativo_interno", "pin_chat_mudanca_contexto", "pin_chat_guia_atendimento", "pin_chat_feedback_respostas",
  "pin_dash_status_canal", "pin_dash_numero_conectado", "pin_dash_volume_conversas", "pin_dash_total_arquivos", "pin_dash_isolamento_empresa", "pin_dash_tempo_resposta", "pin_dash_alerta_indisponibilidade", "pin_dash_distribuicao_horarios", "pin_dash_taxa_resolucao", "pin_dash_atalho_configuracao",
  "pin_conv_historico_cliente", "pin_conv_sincronizacao_mensagens", "pin_conv_suporte_midia", "pin_conv_identificacao_contato", "pin_conv_resposta_contextual", "pin_conv_transicao_humana", "pin_conv_status_entrega", "pin_conv_busca_atendimentos", "pin_conv_segregacao_conversas", "pin_conv_notificacao_pendencia", "pin_conv_triagem_duvidas", "pin_conv_reproducao_audio", "pin_conv_envio_documento", "pin_conv_filtro_estado", "pin_conv_sincronizacao_multidevice",
  "pin_arq_documentos_apoio", "pin_arq_arquivos_recebidos", "pin_arq_separacao_escopos", "pin_arq_visualizacao_rapida", "pin_arq_download_seguro", "pin_arq_exclusao_sincronizada", "pin_arq_detalhes_remetente", "pin_arq_filtro_formato", "pin_arq_gestao_catalogos", "pin_arq_armazenamento_segregado", "pin_arq_confirmacao_remocao", "pin_arq_pesquisa_nome", "pin_arq_alerta_canal_inativo", "pin_arq_ordenacao_cronologica", "pin_arq_registro_atendimento",
  "pin_canal_status_instancia", "pin_canal_validacao_credenciais", "pin_canal_nome_verificado", "pin_canal_indicador_qualidade", "pin_canal_teste_conexao", "pin_canal_desbloqueio_modulo", "pin_canal_registro_verificacao", "pin_canal_isolamento_chaves", "pin_canal_diagnostico_erros", "pin_canal_acesso_permanente",
];

// ─── Helpers de cache (localStorage) ─────────────────────────────────────────

function getCacheKey(companyId, userId) {
  return `${CACHE_KEY_PREFIX}:${companyId || "unknown-company"}:${userId || "anonymous"}`;
}

function readCache(cacheKey) {
  try {
    const raw = localStorage.getItem(cacheKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(cacheKey, tip, isDefault) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ tip, fetchedAt: Date.now(), isDefault }));
  } catch {
    // localStorage indisponível (modo privado, quota, etc.)
  }
}

function isCacheValid(cache) {
  if (!cache?.fetchedAt || typeof cache.tip !== "string" || !cache.tip.trim()) return false;
  const ttl = cache.isDefault ? DEFAULT_TIP_TTL_MS : DYNAMIC_TIP_TTL_MS;
  return Date.now() - cache.fetchedAt < ttl;
}

function cacheRemaining(cache) {
  const ttl = cache.isDefault ? DEFAULT_TIP_TTL_MS : DYNAMIC_TIP_TTL_MS;
  return Math.max(0, ttl - (Date.now() - cache.fetchedAt));
}

// ─── extractTip ───────────────────────────────────────────────────────────────

function extractTip(payload) {
  if (Array.isArray(payload)) return extractTip(payload[0]);
  if (typeof payload === "string") return payload.trim();
  const value =
    payload?.tip ||
    payload?.dica ||
    payload?.message ||
    payload?.text ||
    payload?.content ||
    payload?.output ||
    payload?.body?.tip ||
    payload?.body?.message ||
    payload?.data?.tip ||
    payload?.assistant_message?.content;
  return typeof value === "string" ? value.trim() : "";
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFeatureDiscovery() {
  const { pathname } = useLocation();
  const { companyId } = useCompany();
  const { user } = useAuth();
  const userId = user?.id || "anonymous";
  const isOverview = pathname === "/" || pathname === "/geral";
  const cacheKey = getCacheKey(companyId, userId);

  const [text, setText]       = useState(DEFAULT_DISCOVERY_TEXT);
  const [visible, setVisible] = useState(true);
  const timersRef             = useRef([]);
  const controllerRef         = useRef(null);

  const clearPendingWork = useCallback(() => {
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const transitionTo = useCallback((nextText) => {
    setVisible(false);
    const t = window.setTimeout(() => { setText(nextText); setVisible(true); }, FADE_DURATION_MS);
    timersRef.current.push(t);
  }, []);

  useEffect(() => {
    clearPendingWork();
    setText(DEFAULT_DISCOVERY_TEXT);
    setVisible(true);
    if (isDemoMode) return clearPendingWork;
    if (!isOverview) return clearPendingWork;
    if (!companyId) return clearPendingWork;

    let cancelled = false;
    const scheduleRetry = (delay) => {
      const retryTimer = window.setTimeout(() => {
        if (!cancelled) showTip();
      }, delay);
      timersRef.current.push(retryTimer);
    };

    // Busca dica no webhook, guarda em cache e agenda expiração
    const showTip = async () => {
      if (!DISCOVERY_WEBHOOK_URL) {
        console.warn("[Discovery] VITE_N8N_DISCOVERY_FEATURE_WEBHOOK_URL não configurada.");
        writeCache(cacheKey, DEFAULT_DISCOVERY_TEXT, true);
        return;
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      const pin = FEATURE_DISCOVERY_PINS[Math.floor(Math.random() * FEATURE_DISCOVERY_PINS.length)];

      try {
        const { data: { session } } =
          (await supabase?.auth.getSession()) || { data: { session: null } };

        const headers = { "Content-Type": "application/json" };
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        const response = await fetch(DISCOVERY_WEBHOOK_URL, {
          method: "POST",
          headers,
          body: JSON.stringify({
            pin,
            feature_pin: pin,
            company_id: companyId,
            user_id: userId,
          }),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`Webhook respondeu com ${response.status}`);
        const rawBody = await response.text();
        let payload = rawBody;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          // O n8n tamb�m pode responder com texto puro.
        }
        const tip = extractTip(payload);
        if (cancelled) return;
        if (!tip) {
          writeCache(cacheKey, DEFAULT_DISCOVERY_TEXT, true);
          scheduleRetry(DEFAULT_TIP_TTL_MS);
          return;
        }

        // Guarda no cache por 2h e mostra
        writeCache(cacheKey, tip, false);
        transitionTo(tip);

        // Após 2h: volta ao padrão e agenda nova dica depois de 3h
        const restoreTimer = window.setTimeout(() => {
          if (cancelled) return;
          transitionTo(DEFAULT_DISCOVERY_TEXT);
          writeCache(cacheKey, DEFAULT_DISCOVERY_TEXT, true);
          // Após as 3h do padrão, tenta nova dica
          const retryTimer = window.setTimeout(() => {
            if (!cancelled) showTip();
          }, DEFAULT_TIP_TTL_MS);
          timersRef.current.push(retryTimer);
        }, DYNAMIC_TIP_TTL_MS);
        timersRef.current.push(restoreTimer);

      } catch (error) {
        if (error.name === "AbortError") return;
        console.warn("[Discovery] Não foi possível carregar a dica dinâmica.", error);
        // Em falha: guarda padrão por 3h para não repetir chamadas
        writeCache(cacheKey, DEFAULT_DISCOVERY_TEXT, true);
        scheduleRetry(DEFAULT_TIP_TTL_MS);
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    };

    // ── Ponto de entrada: verificar cache antes de chamar o webhook ─────────
    const cache = readCache(cacheKey);

    if (isCacheValid(cache)) {
      // Cache válido → mostrar sem chamar o webhook
      if (cache.tip !== DEFAULT_DISCOVERY_TEXT) {
        transitionTo(cache.tip);
        // Agenda o restore para o tempo restante dos 2h
        const remaining = cacheRemaining(cache);
        const restoreTimer = window.setTimeout(() => {
          if (cancelled) return;
          transitionTo(DEFAULT_DISCOVERY_TEXT);
          writeCache(cacheKey, DEFAULT_DISCOVERY_TEXT, true);
          const retryTimer = window.setTimeout(() => {
            if (!cancelled) showTip();
          }, DEFAULT_TIP_TTL_MS);
          timersRef.current.push(retryTimer);
        }, remaining);
        timersRef.current.push(restoreTimer);
      } else {
        scheduleRetry(cacheRemaining(cache));
      }
      // Se é padrão em cache: nada a fazer, o timer de retry será criado na próxima expiração
    } else {
      // Cache expirado ou inexistente → buscar nova dica
      showTip();
    }

    return () => { cancelled = true; clearPendingWork(); };
  }, [cacheKey, clearPendingWork, companyId, isOverview, transitionTo, userId]);

  return { text, visible, isDynamic: text !== DEFAULT_DISCOVERY_TEXT };
}
