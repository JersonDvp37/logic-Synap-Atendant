> **Esta não é a versão completa da Logic Synap Hub.**
>
> Este repositório contém apenas uma demonstração pública do frontend, com dados fictícios e operações simuladas. A plataforma completa já possui backend, inteligência artificial e integrações; esses serviços e workflows não estão incluídos integralmente nesta publicação.

<div align="center">
  <img src="public/logo_synap/logic_synap_logo.svg" alt="Logótipo Logic Synap" width="76" />

  <h1>Logic Synap Atendant</h1>
  <p>Gestão de conhecimento e atendimento empresarial numa única interface.</p>
  <p><strong>React · Vite · CSS Modules · Demonstração interativa</strong></p>
</div>

---



## Sobre o projeto

A Logic Synap reúne interfaces para organizar documentos da empresa, consultar conhecimento através de um chat e acompanhar o atendimento em canais como WhatsApp e Gmail.

Este repositório apresenta a experiência de utilização da plataforma. O backend completo, os workflows de automação e as configurações da instalação de produção não estão incluídos.

## O que pode explorar

| Área | Recursos da demonstração |
| --- | --- |
| Visão geral | Indicadores, atividade recente e atalhos com dados fictícios. |
| Documentos | Listagem, adição local, abertura e exclusão de ficheiros de exemplo. |
| Chat interno | Criação e organização de conversas, mensagens e respostas simuladas. |
| Atendimento WhatsApp | Histórico de conversas, respostas locais e arquivos de exemplo. |
| Gmail | Caixa de entrada fictícia, composição de e-mails e anexos de demonstração. |
| Agendamentos | Disponibilidade, dias bloqueados e gestão de agendamentos de exemplo. |
| Configuração de canais | Pop-ups explicativos e simulação da ligação de WhatsApp e Gmail. |
| Perfil e aparência | Edição local dos dados da empresa e alternância entre tema claro e escuro. |

As ações na demonstração não enviam mensagens reais, não autorizam contas Google e não ligam números de WhatsApp. O chat utiliza respostas predefinidas, sem consultar um modelo de IA.

## Executar localmente

### Requisitos

- Node.js 22.12 ou superior.
- npm.

Com o repositório no seu computador, execute na pasta do projeto:

```bash
npm ci
npm run dev
```

**Não precisa de criar um `.env` para experimentar:** sem configuração Supabase, a aplicação inicia em modo de demonstração.

### Entrar na demonstração

| Campo | O que inserir |
| --- | --- |
| E-mail | Um e-mail válido, por exemplo `demo@example.com`. |
| Senha | Qualquer valor preenchido, por exemplo `1`. |
| Registo | Não é necessário criar uma conta. |

O login apresenta um cartão com as limitações da versão. Durante a navegação, um aviso identifica o modo de demonstração.

A sessão e as alterações ficam no navegador durante a sessão do separador. Os ficheiros escolhidos não são enviados para um servidor: o conteúdo fica em memória até recarregar a página; depois disso, a abertura apresenta um exemplo explicativo.

## Tecnologias utilizadas

### Frontend incluído neste repositório

- **JavaScript e TypeScript** para o código da interface, ferramentas e funções de integração.
- **React 19** e **React Router 7** para a interface e a navegação.
- **Vite 8**, **Node.js** e **npm** para desenvolvimento, dependências e compilação.
- **CSS Modules** para estilos dos componentes.
- **Lucide React** para ícones.
- **React Markdown**, **remark** e **KaTeX** para apresentação de mensagens.
- **Supabase JS** para a ligação opcional ao backend de uma instalação configurada.
- **Docker e Nginx** para servir os ficheiros compilados.

### Tecnologias já utilizadas na versão completa

A plataforma completa já utiliza backend, inteligência artificial, armazenamento e automações. A lista abaixo descreve essa arquitetura existente; os serviços externos e os workflows completos não acompanham esta demonstração pública.

| Tecnologia | Função na plataforma completa |
| --- | --- |
| **Supabase / PostgreSQL** | Persistência dos dados de empresas, documentos, conversas, mensagens e agendamentos. |
| **Supabase Auth e JWT** | Autenticação dos utilizadores e identificação das sessões nos pedidos ao backend. |
| **Row Level Security (RLS)** | Políticas de acesso e isolamento dos dados entre empresas. |
| **Supabase Realtime** | Atualizações de dados na interface, complementadas por atualização manual e consultas periódicas. |
| **Supabase Edge Functions, Deno e TypeScript** | Funções de backend, incluindo autorização e geração de acesso temporário a documentos. |
| **n8n e webhooks** | Orquestração dos workflows de documentos, chat, atendimento e operações administrativas. |
| **Google Gemini API** | Geração de respostas contextualizadas, processamento multimodal e criação de embeddings para o conhecimento empresarial. |
| **Google Cloud Storage (GCS)** | Armazenamento privado de documentos e arquivos, com acesso temporário através de URLs assinadas. |
| **Meta WhatsApp Cloud API** | Integração oficial do WhatsApp Business para receção e envio de mensagens. |
| **Gmail API e Google OAuth 2.0** | Autorização de contas de e-mail, leitura de mensagens, envio e acesso a anexos. |
| **Docker, Docker Compose e Nginx** | Compilação, distribuição e disponibilização do frontend. |
| **VPS Hostinger e EasyPanel** | Alojamento e gestão operacional dos serviços da plataforma. |

O processamento documental da versão completa inclui extração de texto e tratamento de documentos digitalizados, com OCR quando necessário. A base de conhecimento utiliza **RAG (Retrieval-Augmented Generation)**, divisão do conteúdo em **chunks**, **embeddings** e **recuperação semântica** para fornecer contexto às respostas do assistente.

Na demonstração deste repositório, estas operações são simuladas localmente. Os detalhes de configuração, as credenciais e os endpoints da instalação real não são publicados.

## Estrutura do projeto

```text
public/                  Estilos globais, logótipos e outros recursos estáticos
src/
  components/            Componentes partilhados e diálogos da demonstração
  constants/             Constantes e configurações da interface
  contexts/              Autenticação, empresa, aparência e canais
  hooks/                 Hooks reutilizáveis
  pages/                 Páginas organizadas por funcionalidade
  services/              Acesso a dados e operações da aplicação
    demoService.js       Sessão, dados fictícios e operações locais
scripts/                 Verificação de publicação e testes
supabase/
  functions/             Código da função de acesso a documentos
  .env.example           Exemplo de configuração exclusiva do servidor
  config.toml            Configuração da função
  gmail_active_instances.sql
.env.example             Exemplo de configuração do frontend
Dockerfile               Compilação e imagem de distribuição
docker-compose.yml       Configuração do serviço Docker
```

## Configuração dos modos

O ficheiro [`.env.example`](.env.example) contém apenas valores fictícios e ativa `VITE_DEMO_MODE=true`.

Para personalizar a configuração, copie-o para `.env`:

| Ambiente | Comando |
| --- | --- |
| Linux / macOS | `cp .env.example .env` |
| Windows PowerShell | `Copy-Item .env.example .env` |

| Configuração | Comportamento |
| --- | --- |
| `VITE_DEMO_MODE=true` | Usa a sessão e os dados locais da demonstração. |
| `VITE_DEMO_MODE=false` | Usa a autenticação e as integrações configuradas. Exige backend próprio. |
| Variável não definida | Ativa a demonstração se ambas as variáveis Supabase estiverem ausentes. Uma configuração Supabase mantém o fluxo de autenticação real. |

### Integrações reais

Para ligar uma instalação própria, defina `VITE_DEMO_MODE=false` e configure as variáveis necessárias:

| Variáveis | Finalidade |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | URL e chave pública anon/publishable do projeto Supabase. |
| `VITE_N8N_*` | Endpoints das automações da sua instalação. |
| `VITE_GMAIL_GOOGLE_CLIENT_ID`, `VITE_GMAIL_OAUTH_REDIRECT_URI`, `VITE_GMAIL_OAUTH_SCOPE` | Configuração pública do cliente OAuth para Gmail. |
| `VITE_PUBLIC_WEBSITE_URL`, `VITE_SUPPORT_EMAIL`, `VITE_OPERATOR_NAME` | Identidade pública e contactos apresentados pela instalação. |

Este modo depende de tabelas, políticas de acesso e workflows que não são fornecidos na íntegra neste repositório. O backend deve validar a sessão e as permissões da empresa em cada pedido.

A função de documentos utiliza configurações exclusivas do servidor, descritas em [`supabase/.env.example`](supabase/.env.example), incluindo as origens autorizadas em `ALLOWED_ORIGINS` e as credenciais do Google Cloud Storage.

**Todas as variáveis `VITE_*` ficam visíveis no navegador.** Chaves privadas, segredos OAuth, tokens permanentes e chaves Supabase `service_role` devem permanecer exclusivamente no servidor.

## Comandos disponíveis

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento. |
| `npm run build` | Gera a aplicação para distribuição em `dist/`. |
| `npm run preview` | Serve localmente a versão já compilada. |
| `npm run lint` | Executa o ESLint com a configuração do projeto. |
| `npm run test:demo` | Testa o login e os serviços do modo de demonstração. |
| `npm run test:public-safety` | Testa o verificador de dados sensíveis. |
| `npm run check:public` | Procura padrões sensíveis nos ficheiros candidatos à publicação. |

Para verificar as alterações:

```bash
npm run test:demo
npm run test:public-safety
npm run check:public
npm run lint
npm run build
```

## Executar com Docker

Com Docker e Docker Compose disponíveis:

```bash
docker compose up -d --build
```

O serviço publica a aplicação na porta `80`. Sem credenciais configuradas, executa a demonstração; o `.env.example` também pode ser usado como base para ativar esse modo explicitamente.

As variáveis `VITE_*` são lidas durante a compilação. Depois de as alterar, reconstrua a imagem.

## Segurança

Use apenas dados fictícios em exemplos, capturas de ecrã e testes. Os ambientes locais, credenciais e backups estão excluídos do Git e do contexto Docker pelas regras do projeto.

O comando `npm run check:public` identifica padrões de credenciais, contactos e endpoints de instalação sem mostrar os valores encontrados. A verificação não cobre o conteúdo de imagens, o histórico Git ou os serviços externos.

Consulte [SECURITY.md](SECURITY.md) para orientações de publicação e [PUBLIC_RELEASE_REVIEW.md](PUBLIC_RELEASE_REVIEW.md) para o registo da limpeza inicial.

