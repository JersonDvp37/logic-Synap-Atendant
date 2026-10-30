import { supabase } from './supabase';
import { demoFileUrl, isDemoMode } from './demoService';

const configureGmailWebhookUrl = import.meta.env.VITE_N8N_CONFIGURE_GMAIL_WEBHOOK_URL;
const sendGmailWebhookUrl = import.meta.env.VITE_N8N_SEND_GMAIL_EMAIL_WEBHOOK_URL;
const openGmailAttachmentWebhookUrl = import.meta.env.VITE_N8N_OPEN_GMAIL_ATTACHMENT_WEBHOOK_URL;
const getInboxMessageWebhookUrl = import.meta.env.VITE_N8N_GET_INBOX_MESSAGE_WEBHOOK_URL;
const googleClientId = import.meta.env.VITE_GMAIL_GOOGLE_CLIENT_ID;
const googleOAuthRedirectUri = import.meta.env.VITE_GMAIL_OAUTH_REDIRECT_URI || '';
const googleOAuthScope = import.meta.env.VITE_GMAIL_OAUTH_SCOPE || 'https://mail.google.com/';

function requireCompany(companyId) {
  if (!companyId) throw new Error('Company not identified.');
  if (!supabase) throw new Error('Supabase is not configured.');
}

async function getAuthorizationHeader() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const sessionResult = await supabase.auth.getSession();
  const session = (sessionResult.data || {}).session;
  if (!session?.access_token) throw new Error('Session not authenticated.');
  return 'Bearer ' + session.access_token;
}

function isActiveInstance(instance) {
  if (instance?.is_active === false || instance?.active === false) return false;
  const status = String(instance?.status || instance?.connection_status || '').toLowerCase();
  return !['inactive', 'disabled', 'disconnected', 'revoked', 'expired', 'error'].includes(status);
}

export async function getGmailInstances(companyId) {
  requireCompany(companyId);
  const result = await supabase
    .from('gmail_instances')
    .select('id, email_address, display_name, status, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });
  if (result.error) throw result.error;
  const data = (result.data ?? []).sort((left, right) => Number(isActiveInstance(right)) - Number(isActiveInstance(left)));
  return { data, count: data.length };
}

export async function getActiveGmailInstanceId(companyId, userId) {
  requireCompany(companyId);
  if (!userId) return null;

  const result = await supabase
    .from('gmail_active_instances')
    .select('gmail_instance_id')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .maybeSingle();

  if (result.error) throw result.error;
  return result.data?.gmail_instance_id || null;
}

export async function setActiveGmailInstance({ companyId, userId, instanceId }) {
  requireCompany(companyId);
  if (!userId || !instanceId) throw new Error('Gmail account selection is invalid.');

  const instanceResult = await supabase
    .from('gmail_instances')
    .select('id')
    .eq('company_id', companyId)
    .eq('id', instanceId)
    .maybeSingle();

  if (instanceResult.error) throw instanceResult.error;
  if (!instanceResult.data) throw new Error('Gmail account does not belong to this company.');

  const deactivateOthersResult = await supabase
    .from('gmail_instances')
    .update({ status: 'inactive' })
    .eq('company_id', companyId)
    .neq('id', instanceId);

  if (deactivateOthersResult.error) throw deactivateOthersResult.error;

  const activateSelectedResult = await supabase
    .from('gmail_instances')
    .update({ status: 'active' })
    .eq('company_id', companyId)
    .eq('id', instanceId);

  if (activateSelectedResult.error) throw activateSelectedResult.error;

  const result = await supabase
    .from('gmail_active_instances')
    .upsert({
      company_id: companyId,
      user_id: userId,
      gmail_instance_id: instanceId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,user_id' })
    .select('gmail_instance_id')
    .single();

  if (result.error) throw result.error;
  return result.data;
}

export function getGmailInstanceEmail(instance) {
  return instance?.email_address || instance?.email || instance?.gmail_email || instance?.address || '';
}

export function getGmailInstanceLabel(instance) {
  return instance?.display_name || instance?.name || getGmailInstanceEmail(instance) || 'Gmail account';
}

function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

function messageBelongsToInstance(message, instance) {
  if (!instance) return true;
  const instanceId = normalizeIdentifier(instance.id);
  const messageInstanceId = normalizeIdentifier(message?.gmail_instance_id || message?.instance_id || message?.gmail_account_id || message?.account_id);
  if (instanceId && messageInstanceId) return instanceId === messageInstanceId;
  const instanceEmail = normalizeIdentifier(getGmailInstanceEmail(instance));
  const messageEmail = normalizeIdentifier(message?.email_address || message?.gmail_email || message?.account_email || message?.from_account || message?.source_email);
  if (instanceEmail && messageEmail) return instanceEmail === messageEmail;
  return true;
}

function filterMessagesByInstance(messages, instance) {
  return (messages ?? []).filter((message) => messageBelongsToInstance(message, instance));
}

function getGmailMessagesQuery(companyId, instance = null, onlyAttachments = false, byEmail = false) {
  let query = supabase
    .from('gmail_messages')
    .select('*')
    .eq('company_id', companyId);
  if (onlyAttachments) query = query.eq('has_attachments', true);
  if (!byEmail && instance?.id) query = query.eq('gmail_instance_id', instance.id);
  if (byEmail && instance?.email_address) query = query.eq('email_address', instance.email_address);
  return query.order('created_at', { ascending: false });
}

async function postToWebhook(url, body, defaultError) {
  if (isDemoMode) return { success: true, demo: true, message: 'Ação simulada; nenhuma mensagem foi enviada ou sincronizada com serviços externos.' };
  if (!url) throw new Error('Gmail webhook is not configured.');
  if (url.includes('/webhook-test/')) throw new Error('Configure the Gmail production webhook URL.');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: await getAuthorizationHeader() },
    body: JSON.stringify(body),
  });
  const rawText = await response.text();
  let data = null;
  try { data = rawText ? JSON.parse(rawText) : null; } catch { data = null; }
  if (!response.ok || data?.success === false) {
    const errorText = String(data?.message || data?.error || '');
    if (/unique_company_email|duplicate key|already exists/i.test(errorText)) {
      throw new Error('This Gmail account is already connected to this company.');
    }
    throw new Error(errorText || defaultError);
  }
  return data;
}

export function connectGmailAccount(companyId) {
  requireCompany(companyId);
  return postToWebhook(configureGmailWebhookUrl, { company_id: companyId }, 'Could not start Gmail connection.');
}

export function getGmailAuthorizationUrl(companyId) {
  if (!googleClientId || !googleOAuthRedirectUri) return '';
  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: googleOAuthRedirectUri,
    response_type: 'code',
    scope: googleOAuthScope,
    access_type: 'offline',
    prompt: 'consent',
    state: companyId || '',
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
}

export async function getGmailMessages(companyId, instance = null) {
  requireCompany(companyId);
  let result = await getGmailMessagesQuery(companyId, instance);
  if (result.error && instance?.email_address) result = await getGmailMessagesQuery(companyId, instance, false, true);
  if (result.error && instance?.id) result = await getGmailMessagesQuery(companyId);
  if (result.error) throw result.error;
  return filterMessagesByInstance(result.data, instance);
}

export async function markGmailMessageAsRead(messageId) {
  if (!messageId) return;
  if (!supabase) throw new Error('Supabase connection is not configured.');
  const updateResult = await supabase.from('gmail_messages').update({ is_read: 'true' }).eq('id', messageId);
  if (updateResult.error) throw updateResult.error;
  return updateResult.data;
}

export async function getGmailAttachments(companyId, instance = null) {
  requireCompany(companyId);
  let result = await getGmailMessagesQuery(companyId, instance, true);
  if (result.error && instance?.email_address) result = await getGmailMessagesQuery(companyId, instance, true, true);
  if (result.error && instance?.id) result = await getGmailMessagesQuery(companyId, null, true);
  if (result.error) throw result.error;
  return filterMessagesByInstance(result.data, instance).flatMap((message) => {
    let attachments = message.attachments;
    if (typeof attachments === 'string') {
      try { attachments = JSON.parse(attachments); } catch { attachments = []; }
    }
    return (Array.isArray(attachments) ? attachments : []).map((attachment) => ({
      id: message.id,
      message_id: message.message_id,
      filename: attachment?.filename,
      mime_type: attachment?.mime_type,
      storage_path: attachment?.storage_path,
      file_size: attachment?.file_size,
      sender_email: message.sender_email,
      sender_name: message.sender_name,
      subject: message.subject,
      created_at: message.created_at,
    }));
  });
}

export function sendGmailEmail({ companyId, to, subject, body }) {
  requireCompany(companyId);
  return postToWebhook(sendGmailWebhookUrl, { company_id: companyId, to, subject, body }, 'Could not send email.');
}

export function requestGmailInboxSync({ companyId, instance }) {
  requireCompany(companyId);
  const email = getGmailInstanceEmail(instance);
  if (!instance?.id || !email) throw new Error('Active Gmail account is invalid.');

  return postToWebhook(
    getInboxMessageWebhookUrl,
    { company_id: companyId, email, gmail_instance_id: instance.id },
    'Could not synchronize the Gmail inbox.',
  );
}

export async function openGmailAttachment({ attachmentId, companyId }) {
  if (isDemoMode) { window.open(demoFileUrl(attachmentId), '_blank', 'noopener,noreferrer'); return; }
  requireCompany(companyId);
  if (!attachmentId) throw new Error('Invalid attachment.');
  const response = await fetch(openGmailAttachmentWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: await getAuthorizationHeader() },
    body: JSON.stringify({ attachment_id: attachmentId, company_id: companyId }),
  });
  if (!response.ok) throw new Error('Could not open attachment.');
  if ((response.headers.get('content-type') || '').includes('application/json')) {
    const data = await response.json();
    const url = data?.signed_url || data?.temporary_url || data?.url;
    if (!url) throw new Error('Temporary attachment URL was not returned.');
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const objectUrl = URL.createObjectURL(await response.blob());
  window.open(objectUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
}

export function getMessageId(message) { return message?.message_id || message?.id; }
export function getMessageSubject(message) { return message?.subject || '(Sem assunto)'; }
export function getMessageSender(message) { return message?.sender_name || message?.sender_email || 'Sender not identified'; }
export function getMessageDate(message) { return message?.created_at; }
export function getMessageBody(message) { return message?.body_plain || message?.body_html || 'This message has no text content.'; }
export function getAttachmentName(attachment) { return attachment?.filename || attachment?.file_name || attachment?.name || 'Unnamed attachment'; }
