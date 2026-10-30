import { ArrowLeft, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { LEGAL_LINKS, OPERATOR_NAME, SUPPORT_EMAIL } from "../../constants/legalLinks";
import styles from "./LegalPage.module.css";

const lastUpdated = "24 de setembro de 2026";

export default function LegalPage({ type }) {
  const privacy = type === "privacy";
  return (
    <main className={styles.page}>
      <article className={styles.document}>
        <header className={styles.header}>
          <Link className={styles.backLink} to="/login"><ArrowLeft size={16} /> Voltar ao login</Link>
          <div className={styles.brand}><span><img src="/logo_synap/logic_synap_logo.svg" alt="" /></span>Logic Synap Hub</div>
          <p className={styles.eyebrow}>DOCUMENTO LEGAL</p>
          <h1>{privacy ? "Política de Privacidade" : "Termos e Condições de Serviço"}</h1>
          <p className={styles.updated}>Última atualização: {lastUpdated}</p>
          <nav className={styles.switcher} aria-label="Documentos legais">
            <a className={privacy ? styles.active : undefined} href={LEGAL_LINKS.privacy}>Privacidade</a>
            <a className={!privacy ? styles.active : undefined} href={LEGAL_LINKS.terms}>Termos e condições</a>
          </nav>
        </header>
        {privacy ? <PrivacyContent /> : <TermsContent />}
        <footer className={styles.footer}>
          <span>Logic Synap Hub · Moçambique</span>
          <a href={LEGAL_LINKS.support}><Mail size={14} /> {SUPPORT_EMAIL}</a>
        </footer>
      </article>
    </main>
  );
}

function PrivacyContent() {
  return <div className={styles.content}>
    <Section title="1. Identificação do controlador e contacto">
      <p>A <strong>Logic Synap Hub</strong> é uma plataforma SaaS modular de automação, orquestração de workflows e gestão de atendimento operada e gerida por <strong>{OPERATOR_NAME}</strong>, com sede em <strong>Moçambique</strong>.</p>
      <p>Para dúvidas, pedidos relacionados com privacidade ou exercício dos seus direitos, contacte-nos:</p>
      <ul><li><strong>Controlador:</strong> Logic Synap Hub / {OPERATOR_NAME}</li><li><strong>Localização:</strong> Moçambique</li><li><strong>Contacto de privacidade:</strong> <a href={LEGAL_LINKS.support}>{SUPPORT_EMAIL}</a></li><li><strong>Website:</strong> <a href={LEGAL_LINKS.website}>{LEGAL_LINKS.website}</a></li></ul>
    </Section>
    <Section title="2. Visão geral e escopo"><p>Esta Política descreve como a Logic Synap Hub recolhe, utiliza, armazena, partilha e protege os dados pessoais dos utilizadores e clientes ao acederem à plataforma, aos serviços e às integrações disponíveis.</p></Section>
    <Section title="3. Dados recolhidos e finalidades">
      <p>Recolhemos apenas os dados necessários para prestar os serviços de automação:</p>
      <ul><li><strong>Dados de registo e conta:</strong> nome, e-mail e credenciais de acesso para identificação e autenticação.</li><li><strong>Dados de integração e APIs:</strong> identificadores, chaves de API e tokens autorizados para conectar WhatsApp Cloud API, Google Cloud Storage, Google Gemini API e Gmail API.</li><li><strong>Logs operacionais e histórico:</strong> registos de execução de workflows, mensagens e eventos técnicos para auditoria, diagnóstico e manutenção.</li></ul>
    </Section>
    <Section title="4. Uso de dados das APIs do Google (Gmail API)">
      <p>A plataforma integra-se com a Gmail API para permitir leitura, envio, criação de rascunhos e gestão de mensagens de forma dinâmica e autorizada pelo utilizador.</p>
      <h3>4.1. Uso limitado (Limited Use)</h3>
      <p>O uso e a transferência de informações recebidas de APIs do Google obedecerão rigorosamente à <a href="https://developers.google.com/workspace/workspace-api-user-data-developer-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, incluindo os requisitos de Uso Limitado.</p>
      <h3>4.2. Garantias específicas do Gmail</h3>
      <ul><li><strong>Finalidade estrita:</strong> os dados são utilizados exclusivamente para executar automações de e-mail ativadas e configuradas pelo utilizador.</li><li><strong>Proibição de venda e anúncios:</strong> os dados do Gmail não são vendidos, alugados ou partilhados para fins comerciais, publicidade, marketing ou perfilamento.</li><li><strong>Proibição de treino de IA genérica:</strong> os dados do Gmail não são utilizados para treinar, melhorar ou alimentar modelos genéricos de IA ou Machine Learning.</li></ul>
    </Section>
    <Section title="5. Segurança e técnicas de proteção de dados">
      <ul><li><strong>Encriptação:</strong> credenciais, segredos e tokens OAuth 2.0 são armazenados em repouso com AES-256 e transmitidos através de HTTPS/TLS.</li><li><strong>Isolamento multiempresa:</strong> a segregação de dados é garantida na base de dados através de Row Level Security (RLS) por <code>company_id</code>.</li><li><strong>Eliminação de tokens:</strong> ao desconectar uma integração ou solicitar a remoção da conta, os tokens de acesso associados são eliminados do sistema.</li><li><strong>Ausência de treino de IA:</strong> conteúdos privados processados não são fornecidos a terceiros para treino de modelos genéricos.</li></ul>
    </Section>
    <Section title="6. Retenção e eliminação de dados"><ul><li><strong>Retenção:</strong> os dados são retidos enquanto a conta permanecer ativa e pelo período necessário à prestação dos serviços.</li><li><strong>Backups:</strong> backups automatizados são sobrescritos ou eliminados no prazo máximo de 30 dias após a solicitação de eliminação definitiva da conta.</li></ul></Section>
    <Section title="7. Cookies e tecnologias de rastreio"><p>Utilizamos apenas cookies estritamente necessários para autenticação, segurança da navegação e manutenção do estado da aplicação. Não utilizamos cookies de rastreio publicitário de terceiros.</p></Section>
    <Section title="8. Subcontratados e transferências internacionais">
      <p>Podemos utilizar fornecedores de infraestrutura, incluindo:</p>
      <ul><li><strong>Supabase:</strong> base de dados, autenticação e armazenamento.</li><li><strong>Google Cloud Platform:</strong> armazenamento, processamento de IA e serviços autorizados de e-mail.</li><li><strong>Hostinger / EasyPanel:</strong> alojamento e orquestração de automações n8n.</li><li><strong>Meta:</strong> envio e receção de mensagens pela WhatsApp Cloud API.</li></ul>
      <p>As transferências internacionais decorrentes destes fornecedores são realizadas com medidas adequadas de segurança e proteção contratual.</p>
    </Section>
    <Section title="9. Direitos do titular dos dados"><p>Os utilizadores podem solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio, eliminação, revogação de consentimento e eliminação da conta e das integrações, quando aplicável.</p><p>Para exercer estes direitos, contacte <a href={LEGAL_LINKS.support}>{SUPPORT_EMAIL}</a>.</p></Section>
  </div>;
}

function TermsContent() {
  return <div className={styles.content}>
    <Section title="1. Aceitação dos termos"><p>Ao registar-se, aceder ou utilizar a Logic Synap Hub, o utilizador concorda expressamente com estes Termos e Condições de Serviço. Se não concordar, não deverá utilizar a plataforma.</p></Section>
    <Section title="2. Descrição do serviço"><p>A Logic Synap Hub fornece uma plataforma SaaS modular de orquestração de workflows, gestão de conhecimento e automação de canais de comunicação para empresas.</p></Section>
    <Section title="3. Faturamento, subscrições e cancelamento"><ul><li>Os serviços podem ser prestados mediante subscrição mensal ou plano contratado.</li><li>O utilizador pode cancelar a subscrição através do painel ou contactando o suporte. O cancelamento interrompe a renovação automática no ciclo seguinte.</li></ul></Section>
    <Section title="4. Responsabilidade pelas integrações e credenciais"><p>O utilizador é responsável por manter a confidencialidade das credenciais e pelos acessos autorizados através de OAuth 2.0, incluindo serviços do Google e da Meta. A utilização de integrações de e-mail deve respeitar a legislação aplicável e as políticas contra mensagens não solicitadas.</p></Section>
    <Section title="5. Propriedade intelectual"><p>Os direitos de propriedade intelectual sobre o software, marca, código-fonte, interface, design e funcionalidades da Logic Synap Hub pertencem ao seu desenvolvedor e fundador. O utilizador recebe uma licença limitada, não exclusiva e revogável para utilizar o serviço.</p></Section>
    <Section title="6. Uso proibido e restrito"><p>O utilizador não poderá utilizar a plataforma para:</p><ul><li>Enviar SPAM ou violar políticas anti-spam do Gmail ou da Meta;</li><li>Praticar atividades ilícitas, fraudulentas ou que violem direitos de terceiros;</li><li>Injetar código malicioso ou tentar fazer engenharia reversa do sistema.</li></ul></Section>
    <Section title="7. Suspensão e encerramento de contas"><p>A Logic Synap Hub reserva-se o direito de suspender ou encerrar contas que violem estes Termos, tentem contornar medidas de segurança ou utilizem APIs conectadas de forma indevida.</p></Section>
    <Section title="8. Isenção de garantias e limitação de responsabilidade"><p>A plataforma é fornecida “como está”. Não nos responsabilizamos por interrupções temporárias decorrentes de falhas em serviços de terceiros, alterações de APIs do Google ou da Meta, indisponibilidade de servidores externos ou problemas de rede fora do nosso controlo.</p></Section>
    <Section title="9. Lei aplicável e resolução de conflitos"><p>Estes Termos são regidos pela legislação aplicável. Qualquer litígio será submetido preferencialmente à resolução amigável através de <a href={LEGAL_LINKS.support}>{SUPPORT_EMAIL}</a> e, se necessário, ao foro competente do país de sede do controlador, Moçambique.</p></Section>
  </div>;
}

function Section({ title, children }) {
  return <section className={styles.section}><h2>{title}</h2>{children}</section>;
}
