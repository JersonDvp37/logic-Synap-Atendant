import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, LoaderCircle, Mail, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useChannelActions } from '../../contexts/ChannelActionsContext';
import {
  getActiveGmailInstanceId,
  getGmailInstanceEmail,
  getGmailInstances,
  setActiveGmailInstance,
} from '../../services/gmailService';
import styles from './GmailAuth.module.css';
import { connectDemoGmail, isDemoMode } from '../../services/demoService';
import DemoDialog from '../../components/Demo/DemoDialog';

const LIMIT = 3;
const OAUTH_CALLBACK_ORIGIN = (() => {
  try {
    return new URL(import.meta.env.VITE_GMAIL_OAUTH_REDIRECT_URI).origin;
  } catch {
    return '';
  }
})();

export default function GmailAuth() {
  const { companyId: currentCompanyId } = useCompany();
  const { user: currentUser } = useAuth();
  const { setHeaderAction } = useChannelActions();
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState(null);
  const [showDemoExplanation, setShowDemoExplanation] = useState(false);

  const loadAccounts = useCallback(async ({ silent = false } = {}) => {
    if (!currentCompanyId) {
      setAccounts([]);
      setSelectedAccountId(null);
      setLoading(false);
      return;
    }
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const result = await getGmailInstances(currentCompanyId);
      const activeInstanceId = await getActiveGmailInstanceId(currentCompanyId, currentUser?.id);
      const nextSelectedAccountId = activeInstanceId
        && result.data.some((account) => String(account.id) === String(activeInstanceId))
        ? activeInstanceId
        : result.data[0]?.id || null;

      setAccounts(result.data);
      setSelectedAccountId(nextSelectedAccountId);

      if (
        nextSelectedAccountId
        && currentUser?.id
        && String(nextSelectedAccountId) !== String(activeInstanceId || '')
      ) {
        await setActiveGmailInstance({
          companyId: currentCompanyId,
          userId: currentUser.id,
          instanceId: nextSelectedAccountId,
        });
      }

      if (!silent) setMessage(null);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Nao foi possivel carregar as contas Gmail.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentCompanyId, currentUser?.id]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  useEffect(() => {
    const handleOAuthMessage = (event) => {
      if (!OAUTH_CALLBACK_ORIGIN || event.origin !== OAUTH_CALLBACK_ORIGIN || event.data?.type !== 'GMAIL_AUTH_SUCCESS') return;
      setConnecting(false);
      loadAccounts({ silent: true }).then(() => {
        setMessage({ type: 'success', text: 'Conta Gmail conectada. Lista atualizada.' });
      });
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [loadAccounts]);

  const handleSelectAccount = useCallback(async (accountId) => {
    setSelectedAccountId(accountId);
    try {
      await setActiveGmailInstance({
        companyId: currentCompanyId,
        userId: currentUser?.id,
        instanceId: accountId,
      });
      setMessage({ type: 'success', text: 'Conta Gmail ativa atualizada.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Nao foi possivel atualizar a conta Gmail ativa.' });
      await loadAccounts({ silent: true });
    }
  }, [currentCompanyId, currentUser?.id, loadAccounts]);

  const handleConnect = useCallback(() => {
    if (isDemoMode) { setShowDemoExplanation(true); return; }
    if (accounts.length >= LIMIT) {
      setMessage({ type: 'info', text: 'Limite maximo de 3 contas do Gmail atingido para esta empresa.' });
      return;
    }
    setMessage(null);
    const metadata = {
      company_id: currentCompanyId,
      user_email: currentUser?.email,
    };
    const state = encodeURIComponent(JSON.stringify(metadata));
    const clientId = import.meta.env.VITE_GMAIL_GOOGLE_CLIENT_ID;
    const redirectUri = encodeURIComponent(
      import.meta.env.VITE_GMAIL_OAUTH_REDIRECT_URI || ''
    );
    const scope = encodeURIComponent(
      'https://mail.google.com/ https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send'
    );

    if (!clientId || !OAUTH_CALLBACK_ORIGIN || !currentCompanyId) {
      setMessage({ type: 'error', text: 'Configure VITE_GMAIL_GOOGLE_CLIENT_ID e VITE_GMAIL_OAUTH_REDIRECT_URI no ambiente.' });
      return;
    }
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;
    const authorizationWindow = window.open(googleAuthUrl, 'GoogleAuth', 'width=550,height=650');
    if (!authorizationWindow) {
      setMessage({ type: 'error', text: 'O navegador bloqueou a janela de autorizacao. Permita pop-ups para conectar o Gmail.' });
      return;
    }
    setConnecting(true);
    setMessage({ type: 'info', text: 'Conclua a autorizacao do Google. A lista sera atualizada quando a janela for fechada.' });
    waitForWindowClose(authorizationWindow).then(async () => {
      setConnecting(false);
      await loadAccounts({ silent: true });
      setMessage((current) => current?.type === 'success' ? current : { type: 'success', text: 'Contas Gmail atualizadas.' });
    });
  }, [accounts.length, currentCompanyId, currentUser?.email, loadAccounts]);

  const connectAction = useMemo(() => (
    <button
      type='button'
      className={styles.primaryButton}
      onClick={handleConnect}
      disabled={connecting || accounts.length >= LIMIT}
      title={accounts.length >= LIMIT ? 'Limite maximo de 3 contas do Gmail atingido para esta empresa.' : undefined}
    >
      <Plus size={16} /> {connecting ? 'Conectando...' : 'Conectar Nova Conta Gmail'}
    </button>
  ), [accounts.length, connecting, handleConnect]);

  useEffect(() => {
    setHeaderAction(connectAction);
    return () => setHeaderAction(null);
  }, [connectAction, setHeaderAction]);

  return (
    <div className={styles.root}>
      <section className={styles.hero}>
        <div className={styles.heroIcon}><ShieldCheck size={22} /></div>
        <div><h2>Gmail Auth</h2><p>Conecte as caixas de e-mail da empresa com autorizacao independente do login principal.</p></div>
        <div className={styles.counter}><strong>{accounts.length} <span>/ {LIMIT}</span></strong><small>Contas conectadas</small></div>
      </section>
      {accounts.length >= LIMIT && <div className={styles.messageInfo} role='status'><AlertCircle size={17} />Limite maximo de 3 contas do Gmail atingido para esta empresa.</div>}
      {message && <div className={styles.message} role={message.type === 'error' ? 'alert' : 'status'}><AlertCircle size={17} /><span>{message.text}</span></div>}
      {showDemoExplanation && <DemoDialog title="Para que serve ligar uma conta Gmail?" onClose={() => setShowDemoExplanation(false)} onConfirm={async () => {
        try {
          await connectDemoGmail(currentCompanyId);
          await loadAccounts({ silent: true });
          setMessage({ type: 'success', text: 'Conta fictícia adicionada. Nenhuma autorização Google foi solicitada.' });
        } catch (error) { setMessage({ type: 'error', text: error.message }); }
        setShowDemoExplanation(false);
      }}>
        <p>Na versão completa, esta área permite autorizar uma conta Google para consultar a caixa de entrada, enviar e-mails e abrir anexos na plataforma.</p>
        <p>Na demonstração, adicionamos apenas uma conta fictícia. Nenhum login Google, leitura ou envio real é realizado.</p>
      </DemoDialog>}
      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div><h3>Contas de Gmail ativas</h3><p>Selecione uma conta para ver as mensagens correspondentes.</p></div>
          <div className={styles.actions}>
            <button type='button' className={styles.secondaryButton} onClick={() => loadAccounts({ silent: true })} disabled={loading || refreshing}><RefreshCw size={15} className={refreshing ? styles.spinner : ''} /> Atualizar</button>
          </div>
        </header>
        {loading ? <div className={styles.empty}><LoaderCircle className={styles.spinner} size={24} />Carregando contas...</div> : accounts.length === 0 ? <div className={styles.empty}><Mail size={25} /><strong>Nenhuma conta Gmail conectada</strong><span>Conecte a primeira caixa para comecar a receber e-mails.</span></div> : (
          <div className={styles.accountList}>{accounts.map((account) => <AccountCard key={account.id} account={account} selected={String(account.id) === String(selectedAccountId)} onSelect={handleSelectAccount} />)}</div>
        )}
      </section>
    </div>
  );
}

function waitForWindowClose(authorizationWindow) {
  return new Promise((resolve) => {
    const timer = window.setInterval(() => {
      if (authorizationWindow.closed) {
        window.clearInterval(timer);
        resolve();
      }
    }, 700);
  });
}

function AccountCard({ account, selected, onSelect }) {
  const email = getGmailInstanceEmail(account) || 'Conta Gmail';
  const label = account.display_name || email;
  const messagesUrl = '/atendimento/gmail?account=' + encodeURIComponent(account.id);

  return (
    <article
      className={styles.account + ' ' + (selected ? styles.accountSelected : '')}
      role='button'
      tabIndex='0'
      onClick={() => onSelect(account.id)}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect(account.id); }}
    >
      <div className={styles.accountIcon}><Mail size={18} /></div>
      <div className={styles.accountMain}><strong>{label}</strong><span>{email}</span></div>
      <span className={styles.connected}><CheckCircle2 size={15} /> {selected ? 'Ativo agora' : 'Disponivel'}</span>
      <a href={messagesUrl} className={styles.external} onClick={(event) => event.stopPropagation()}><ExternalLink size={15} /> Ver mensagens</a>
    </article>
  );
}
