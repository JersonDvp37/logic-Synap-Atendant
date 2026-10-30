// Demo sessions are local. Supplying real credentials preserves real auth.
export function resolveDemoMode(env = {}) {
  if (env.VITE_DEMO_MODE === 'true') return true;
  if (env.VITE_DEMO_MODE === 'false') return false;
  return !env.VITE_SUPABASE_URL && !env.VITE_SUPABASE_ANON_KEY;
}

export const isDemoMode = resolveDemoMode(import.meta.env);
export const DEMO_COMPANY_ID = 'demo-company';
const STORAGE_KEY = 'logic-synap:frontend-demo:v1';
const clone = value => JSON.parse(JSON.stringify(value));
const now = () => new Date().toISOString();
let sequence = 0;
const identifier = () => `demo-${Date.now()}-${++sequence}`;

function initialTables() {
  const stamp = now();
  const company = { id: DEMO_COMPANY_ID, name: 'Empresa de demonstração', slug: 'empresa-demo',
    country: 'Moçambique', areas: ['Tecnologia'], description: 'Empresa fictícia para explorar o frontend da Logic Synap.',
    profile_completed: true, status: 'active' };
  const row = (id, values) => ({ id, company_id: company.id, created_at: stamp, updated_at: stamp, ...values });
  return {
    companies: [company], company_members: [row('demo-member', { role: 'owner', status: 'active' })],
    rag_empresarial: [
      row('demo-document', { nome_arquivo: 'Guia de demonstração.pdf', document_scope: 'internal_chat',
        source_type: 'manual_upload', status: 'ready', mime_type: 'application/pdf', tamanho_bytes: 2048,
        storage_path: 'demo/guia.pdf', data_upload: stamp }),
      row('demo-catalog', { nome_arquivo: 'Catálogo de exemplo.pdf', document_scope: 'customer_service',
        source_type: 'manual_upload', status: 'ready', mime_type: 'application/pdf', tamanho_bytes: 4096,
        storage_path: 'demo/catalogo.pdf', data_upload: stamp }),
    ],
    chat_conversations: [row('demo-chat', { title: 'Conhecer a demonstração', archived_at: null, last_message_at: stamp })],
    chat_messages: [row('demo-welcome', { conversation_id: 'demo-chat', role: 'assistant',
      content: 'Bem-vindo! Explore as páginas e experimente o chat. As respostas são simuladas: esta versão executa apenas o frontend.' })],
    whatsapp_instances: [row('demo-whatsapp', { phone_number_id: 'demo-phone', business_account_id: 'demo-business',
      display_phone_number: '+000 000 000 000', verified_name: 'Canal de demonstração',
      status: 'active', webhook_status: 'demo', quality_rating: 'DEMO', last_check_at: stamp })],
    whatsapp_conversations: [row('demo-customer', { customer_name: 'Cliente de exemplo', phone: '000000000000', status: 'active' })],
    whatsapp_messages: [
      row('demo-inbound', { conversation_id: 'demo-customer', role: 'user', content: 'Olá! Gostaria de conhecer os serviços de exemplo.', message_type: 'text' }),
      row('demo-outbound', { conversation_id: 'demo-customer', role: 'assistant', content: 'Olá! Esta é uma conversa fictícia para demonstrar o atendimento.', message_type: 'text' }),
    ],
    company_received_files: [row('demo-received', { conversation_id: 'demo-customer', telefone: '000000000000',
      filename: 'Pedido de exemplo.txt', mime_type: 'text/plain', file_size: 1024, storage_path: 'demo/pedido.txt' })],
    gmail_instances: [row('demo-gmail', { email_address: 'equipa@example.com', display_name: 'Caixa de demonstração', status: 'active' })],
    gmail_active_instances: [],
    gmail_messages: [row('demo-email', { message_id: 'demo-email', gmail_instance_id: 'demo-gmail', email_address: 'equipa@example.com',
      sender_name: 'Contacto de exemplo', sender_email: 'contacto@example.com', subject: 'Bem-vindo à demonstração',
      body_plain: 'Esta mensagem é fictícia. Explore a caixa de entrada, os anexos e a composição. Nenhuma mensagem é enviada para fora da demonstração.',
      is_read: false, has_attachments: true, attachments: [{ id: 'demo-attachment', filename: 'Apresentação de exemplo.txt', mime_type: 'text/plain', file_size: 1024 }] })],
    empresa_horarios_disponiveis: Array.from({ length: 7 }, (_, index) => row(`demo-rule-${index}`, {
      dia_semana: index + 1, hora_inicio: '08:00', hora_fim: '17:00', duracao_slot_minutos: 30,
      limite_dias_futuro: 30, bloqueado: index > 4 })),
    empresa_dias_bloqueados: [],
    agendamentos: [row('demo-appointment', { customer_name: 'Cliente de exemplo', customer_phone: '000000000000',
      data_agendamento: new Date(new Date().setHours(14, 0, 0, 0)).toISOString(), status: 'confirmado' })],
  };
}

// Only the query operations used by this frontend; no network connections.
export function createDemoClient(storage) {
  let saved;
  try { saved = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null'); } catch { /* Start with fresh data. */ }
  let tables = saved?.tables || initialTables();
  let session = saved?.session || null;
  const listeners = new Set(), channels = new Set();
  const persist = () => {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify({ tables, session })); } catch { /* In-memory demo still works. */ }
  };
  const authEvent = event => { persist(); listeners.forEach(listener => listener(event, session)); };
  const notify = (table, eventType, record) => {
    persist();
    queueMicrotask(() => channels.forEach(channel => channel.handlers.forEach(({ filter, callback }) => {
      if (filter.table !== table || (filter.event !== '*' && filter.event !== eventType)) return;
      if (filter.filter) {
        const [field, value] = filter.filter.split('=eq.');
        if (String(record[field]) !== value) return;
      }
      callback({ eventType, new: eventType === 'DELETE' ? {} : clone(record), old: eventType === 'DELETE' ? clone(record) : {} });
    })));
  };
  const client = {
    auth: {
      async signInWithPassword({ email, password }) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim()) || !password) {
          return { data: { user: null, session: null }, error: new Error('Preencha um e-mail válido e qualquer senha para a demonstração.') };
        }
        const user = { id: 'demo-user', email: email.trim(), user_metadata: { name: 'Visitante demo' } };
        // Passwords and integration tokens are never retained.
        session = { user, access_token: 'local-demo-session' };
        authEvent('SIGNED_IN');
        return { data: { user, session }, error: null };
      },
      async signUp(values) { return this.signInWithPassword(values); },
      async signOut() { session = null; authEvent('SIGNED_OUT'); return { error: null }; },
      async getSession() { return { data: { session }, error: null }; },
      async getUser() { return { data: { user: session?.user || null }, error: null }; },
      onAuthStateChange(listener) {
        listeners.add(listener);
        return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
      },
      async resetPasswordForEmail() { return { data: {}, error: null }; },
      async updateUser() { return { data: { user: session?.user }, error: null }; },
    },
    from(table) {
      const filters = [], orders = [];
      let action = 'select', payload, options = {}, single = false, maximum = Infinity, conflictKeys, execution;
      const query = {
        select(_fields, config = {}) { options = config; return this; },
        eq(field, value) { filters.push(row => row[field] === value); return this; },
        neq(field, value) { filters.push(row => row[field] !== value); return this; },
        is(field, value) { filters.push(row => value === null ? row[field] == null : row[field] === value); return this; },
        in(field, values) { filters.push(row => values.includes(row[field])); return this; },
        gt(field, value) { filters.push(row => row[field] > value); return this; },
        gte(field, value) { filters.push(row => row[field] >= value); return this; },
        lt(field, value) { filters.push(row => row[field] < value); return this; },
        lte(field, value) { filters.push(row => row[field] <= value); return this; },
        order(field, config = {}) { orders.push({ field, ascending: config.ascending !== false }); return this; },
        limit(value) { maximum = value; return this; },
        maybeSingle() { single = true; return this; }, single() { single = true; return this; },
        insert(value) { action = 'insert'; payload = value; return this; },
        upsert(value, config = {}) { action = 'upsert'; payload = value; conflictKeys = config.onConflict?.split(','); return this; },
        update(value) { action = 'update'; payload = value; return this; }, delete() { action = 'delete'; return this; },
        then(resolve, reject) {
          execution ||= Promise.resolve().then(() => {
            if (!session) return { data: null, error: new Error('Entre na demonstração para continuar.'), count: 0 };
            tables[table] ||= [];
            let rows = tables[table].filter(row => filters.every(filter => filter(row)));
            if (action === 'insert' || action === 'upsert') {
              rows = (Array.isArray(payload) ? payload : [payload]).map(value => {
                const existing = action === 'upsert' && tables[table].find(row => (conflictKeys || ['id']).every(key => value[key] != null && row[key] === value[key]));
                if (existing) { Object.assign(existing, value); notify(table, 'UPDATE', existing); return existing; }
                const record = { id: identifier(), created_at: now(), updated_at: now(), ...value };
                tables[table].push(record); notify(table, 'INSERT', record); return record;
              });
            } else if (action === 'update') {
              rows.forEach(row => { Object.assign(row, payload); notify(table, 'UPDATE', row); });
            } else if (action === 'delete') {
              tables[table] = tables[table].filter(row => !rows.includes(row));
              rows.forEach(row => notify(table, 'DELETE', row));
              if (table === 'chat_conversations') {
                const ids = rows.map(row => row.id);
                tables.chat_messages = tables.chat_messages.filter(row => !ids.includes(row.conversation_id));
                persist();
              }
            }
            if (table === 'company_members') rows = rows.map(row => ({ ...row, companies: tables.companies.find(company => company.id === row.company_id) }));
            rows = [...rows].sort((a, b) => {
              for (const { field, ascending } of orders) {
                const result = a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0;
                if (result) return ascending ? result : -result;
              }
              return 0;
            });
            const count = rows.length;
            rows = rows.slice(0, maximum);
            return { data: options.head ? null : clone(single ? rows[0] || null : rows), error: null, count };
          });
          return execution.then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(name, values) {
      if (name !== 'create_company_account') return { data: null, error: new Error('Operação indisponível na demonstração.') };
      return client.from('companies').update({ name: values.company_name }).eq('id', DEMO_COMPANY_ID).select().single();
    },
    channel() {
      return { handlers: [], on(_type, filter, callback) { this.handlers.push({ filter, callback }); return this; },
        subscribe(callback) { channels.add(this); callback?.('SUBSCRIBED'); return this; } };
    },
    removeChannel(channel) { channels.delete(channel); return Promise.resolve('ok'); },
    reset() { tables = initialTables(); session = null; authEvent('SIGNED_OUT'); },
  };
  return client;
}

let sessionStorage;
try { sessionStorage = globalThis.sessionStorage; } catch { /* Storage can be disabled. */ }
export const demoClient = createDemoClient(sessionStorage);
const localFiles = new Map();

export function demoFileUrl(id) {
  if (localFiles.has(id)) return localFiles.get(id);
  const url = URL.createObjectURL(new Blob(['Demonstração Logic Synap\n\nEste ficheiro é fictício. Esta versão executa apenas o frontend; não existe armazenamento ou processamento no servidor.'], { type: 'text/plain;charset=utf-8' }));
  localFiles.set(id, url);
  return url;
}

export async function uploadDemoDocument({ file, companyId, userId, scope = 'internal_chat' }) {
  if (!file || !companyId) throw new Error('Selecione um ficheiro e uma empresa.');
  if (file.size > 20 * 1024 * 1024) throw new Error('O ficheiro excede o limite de 20 MB.');
  const existing = await demoClient.from('rag_empresarial').select().eq('company_id', companyId).eq('nome_arquivo', file.name);
  if (existing.data?.length) return { success: true, duplicate: true, message: 'Já existe um ficheiro com este nome na demonstração.' };
  const result = await demoClient.from('rag_empresarial').insert({ company_id: companyId, created_by: userId,
    nome_arquivo: file.name, document_scope: scope, source_type: 'manual_upload', status: 'ready',
    mime_type: file.type, tamanho_bytes: file.size, storage_path: 'demo/local-file', data_upload: now() }).select().single();
  if (result.error) throw result.error;
  localFiles.set(result.data.id, URL.createObjectURL(file));
  return { success: true, message: 'Ficheiro adicionado à demonstração local. Não foi enviado nem processado por um servidor.' };
}

export async function demoAssistantReply({ conversationId, companyId, signal }) {
  signal?.throwIfAborted();
  const result = await demoClient.from('chat_messages').insert({ conversation_id: conversationId, company_id: companyId,
    role: 'assistant', content: 'Esta é uma resposta de demonstração. Na versão completa, o assistente consultaria os documentos da sua empresa para responder. Aqui pode experimentar o envio de mensagens e a organização das conversas, sem IA ou backend ligados.' }).select().single();
  if (result.error) throw result.error;
  await demoClient.from('chat_conversations').update({ last_message_at: now() }).eq('id', conversationId);
  return result.data;
}

export async function connectDemoGmail(companyId) {
  const existing = await demoClient.from('gmail_instances').select().eq('company_id', companyId);
  const number = (existing.data?.length || 0) + 1;
  if (number > 3) throw new Error('A demonstração permite até três contas fictícias.');
  return demoClient.from('gmail_instances').insert({ company_id: companyId, email_address: `equipa${number}@example.com`,
    display_name: `Caixa de demonstração ${number}`, status: 'active' }).select().single();
}
