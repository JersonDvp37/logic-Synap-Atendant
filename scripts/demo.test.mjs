import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDemoClient, resolveDemoMode } from '../src/services/demoService.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), values };
}

test('demo funciona sem configuração; credenciais configuradas não desativam autenticação real', () => {
  assert.equal(resolveDemoMode({}), true);
  assert.equal(resolveDemoMode({ VITE_SUPABASE_URL: 'https://database.example.com', VITE_SUPABASE_ANON_KEY: 'example-key' }), false);
  assert.equal(resolveDemoMode({ VITE_SUPABASE_URL: 'https://database.example.com' }), false);
  assert.equal(resolveDemoMode({ VITE_DEMO_MODE: 'false' }), false);
  assert.equal(resolveDemoMode({ VITE_DEMO_MODE: 'true', VITE_SUPABASE_URL: 'https://database.example.com' }), true);
});

test('login aceita senha de um carácter, valida e-mail e não guarda a senha', async () => {
  const storage = memoryStorage(), client = createDemoClient(storage);
  assert.ok((await client.auth.signInWithPassword({ email: 'inválido', password: 'x' })).error);
  assert.ok((await client.auth.signInWithPassword({ email: 'demo@example.com', password: '' })).error);
  const password = 'value-that-must-never-be-stored';
  assert.equal((await client.auth.signInWithPassword({ email: 'demo@example.com', password })).error, null);
  assert.ok([...storage.values.values()].every(value => !value.includes(password)));
  await client.auth.signOut();
  assert.equal((await client.auth.signInWithPassword({ email: 'outro@example.com', password: 'x' })).data.user.email, 'outro@example.com');
  assert.equal((await createDemoClient(storage).auth.getSession()).data.session.user.email, 'outro@example.com');
  await client.auth.signOut();
  assert.equal((await client.auth.getSession()).data.session, null);
  assert.ok((await client.from('companies').select()).error);
});

test('perfil, filtros e mutações locais mantêm o percurso da aplicação', async () => {
  const client = createDemoClient(memoryStorage());
  await client.auth.signInWithPassword({ email: 'demo@example.com', password: 'x' });
  await client.from('companies').update({ name: 'Empresa editada' }).eq('id', 'demo-company');
  const membership = await client.from('company_members').select('companies(*)').eq('status', 'active').maybeSingle();
  assert.equal(membership.data.companies.name, 'Empresa editada');
  assert.equal(membership.data.companies.profile_completed, true);
  const insert = client.from('chat_conversations').insert({ company_id: 'demo-company', title: 'Teste' }).select().single();
  const first = await insert, second = await insert;
  assert.equal(first.data.id, second.data.id);
  const count = await client.from('chat_conversations').select('*', { count: 'exact', head: true }).eq('company_id', 'demo-company');
  assert.equal(count.count, 2);
  assert.equal(count.data, null);
  await client.from('gmail_active_instances').upsert({ company_id: 'demo-company', user_id: 'demo-user', gmail_instance_id: 'first' }, { onConflict: 'company_id,user_id' });
  await client.from('gmail_active_instances').upsert({ company_id: 'demo-company', user_id: 'demo-user', gmail_instance_id: 'second' }, { onConflict: 'company_id,user_id' });
  const active = await client.from('gmail_active_instances').select();
  assert.equal(active.data.length, 1);
  assert.equal(active.data[0].gmail_instance_id, 'second');
});

test('serviços de demonstração funcionam sem qualquer pedido ao backend', async () => {
  const originalFetch = globalThis.fetch;
  const originalFlag = process.env.VITE_DEMO_MODE;
  process.env.VITE_DEMO_MODE = 'true';
  let networkRequests = 0, server;
  globalThis.fetch = async () => { networkRequests++; throw new Error('Unexpected network request'); };
  try {
    const { createServer } = await import('vite');
    server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
    const load = file => server.ssrLoadModule(`/src/services/${file}.js`);
    const [auth, company, chat, documents, knowledge, whatsapp, conversations, gmail, geral, appointments, demo] = await Promise.all(
      ['authService', 'companyService', 'chatService', 'documentosService', 'knowledgeDocumentsService',
        'whatsappChannelService', 'whatsappConversationsService', 'gmailService', 'geralService', 'appointmentService', 'demoService'].map(load));
    await auth.signIn('demo@example.com', 'x');
    assert.equal((await company.getMyCompany()).data.companies.profile_completed, true);
    assert.equal((await whatsapp.getWhatsAppChannel('demo-company')).status, 'active');
    assert.ok((await geral.getGeralData('demo-company')).metrics.messages > 0);
    assert.ok((await documents.getCompanyDocuments('demo-company')).data.length > 0);
    assert.ok((await appointments.getAvailabilityRules('demo-company')).data.length === 7);
    const thread = await chat.createConversation({ companyId: 'demo-company', userId: 'demo-user' });
    const userMessage = await chat.createUserMessage({ conversationId: thread.id, companyId: 'demo-company', userId: 'demo-user', content: 'Olá' });
    const reply = await chat.requestAssistantResponse({ conversationId: thread.id, companyId: 'demo-company', messageId: userMessage.id, message: 'Olá' });
    assert.ok(reply.content.includes('demonstração'));
    assert.equal((await chat.getConversationMessages({ conversationId: thread.id, companyId: 'demo-company' })).length, 2);
    const file = new File(['%PDF-1.0\nDemo'], 'exemplo.pdf', { type: 'application/pdf' });
    await documents.uploadCompanyDocument({ file, companyId: 'demo-company', userId: 'demo-user' });
    const uploaded = (await documents.getCompanyDocuments('demo-company')).data.find(row => row.nome_arquivo === file.name);
    assert.ok(uploaded);
    const url = await documents.openCompanyFile({ fileId: uploaded.id, companyId: 'demo-company' });
    assert.ok(url.startsWith('blob:'));
    URL.revokeObjectURL(url);
    await knowledge.deleteKnowledgeDocument({ documentId: uploaded.id, companyId: 'demo-company' });
    assert.ok(!(await documents.getCompanyDocuments('demo-company')).data.some(row => row.id === uploaded.id));
    await conversations.sendManualWhatsAppMessage({ companyId: 'demo-company', conversationId: 'demo-customer', phone: '000000000000', message: 'Resposta simulada' });
    assert.ok((await conversations.getWhatsAppMessages({ companyId: 'demo-company', conversationId: 'demo-customer' })).some(row => row.content === 'Resposta simulada'));
    await whatsapp.disconnectWhatsAppChannel('demo-company');
    await whatsapp.configureWhatsAppChannel({ companyId: 'demo-company', phoneNumberId: 'demo-phone', businessAccountId: 'demo-business', accessToken: 'never-retain-this-value' });
    assert.ok(!JSON.stringify(await whatsapp.getWhatsAppChannel('demo-company')).includes('never-retain-this-value'));
    assert.equal((await gmail.sendGmailEmail({ companyId: 'demo-company', to: 'contacto@example.com', subject: 'Demo', body: 'Demo' })).demo, true);
    await demo.connectDemoGmail('demo-company');
    assert.equal((await gmail.getGmailInstances('demo-company')).data.length, 2);
    await auth.signOut();
    const { default: Login } = await server.ssrLoadModule('/src/pages/Auth/Cadastro.jsx');
    const { AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx');
    const { createElement } = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { MemoryRouter } = await import('react-router-dom');
    const html = renderToString(createElement(AuthProvider, null,
      createElement(MemoryRouter, { initialEntries: ['/login'] }, createElement(Login))));
    assert.ok(html.includes('Entrar na demonstração'));
    assert.ok(html.includes('O projeto está incompleto e executa apenas o frontend'));
    assert.ok(/minLength="1"/i.test(html));
    assert.ok(!html.includes('Esqueceu a palavra-passe?'));
    assert.equal(networkRequests, 0);
  } finally {
    await server?.close();
    globalThis.fetch = originalFetch;
    if (originalFlag === undefined) delete process.env.VITE_DEMO_MODE;
    else process.env.VITE_DEMO_MODE = originalFlag;
  }
});
