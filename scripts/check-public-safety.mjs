import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const secretPatterns = [
  ['chave privada', /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----\s+[A-Za-z0-9+/=]{20,}/],
  ['JWT incorporado', /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['chave de fornecedor', /\b(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[0-9A-Za-z-]{15,}|sb_secret_[A-Za-z0-9_-]{16,}|GOCSPX-[A-Za-z0-9_-]{16,}|npm_[A-Za-z0-9]{20,})/],
  ['credenciais em URL', /\b(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s/:]+:[^\s/@]+@/i],
  ['caminho pessoal', /(?:[A-Z]:\\Users\\|\/Users\/|\/home\/)[A-Za-z0-9_.-]+[\\/]/i],
];

function isExampleHost(host) {
  return /(^|\.)example\.(com|org|net)$/.test(host)
    || ['localhost', '127.0.0.1', 'your-project.supabase.co'].includes(host);
}

export function inspectPath(file) {
  const normalized = file.replaceAll('\\', '/');
  const name = path.posix.basename(normalized);
  if (/^\.env/.test(name) && name !== '.env.example') {
    return ['ficheiro de ambiente privado'];
  }
  if (/(?:^|\/)(?:\.private|\.aws|\.codex|\.agents|Microsoft|backups|dumps)(?:\/|$)/i.test(normalized)
    || /^public\/img_documentacao\//.test(normalized)) {
    return ['material local ou dados operacionais'];
  }
  if (/\.(?:pem|key|p12|pfx|keystore|sqlite3?|db|dump|bak|log|sql\.gz)$/i.test(name)
    || /^(?:service[-_]account|credentials|client_secret).*\.json$/i.test(name)) {
    return ['ficheiro de credenciais, dados ou backup'];
  }
  return [];
}

// Findings contain only a line number and a category, never the matched value.
export function scanText(text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const categories = new Set();
    for (const [category, pattern] of secretPatterns) {
      if (pattern.test(line)) categories.add(category);
    }
    // PEM headers and their key material may be on separate lines.
    if (/-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/.test(line)
      && /^[A-Za-z0-9+/=]{20,}$/.test(lines[index + 1] || '')) {
      categories.add('chave privada');
    }
    for (const match of line.matchAll(/https?:\/\/[^\s"'<>`]+/g)) {
      try {
        const url = new URL(match[0]);
        if (!isExampleHost(url.hostname) && (/(^|\.)supabase\.co$/.test(url.hostname)
          || /\/webhook(?:-test)?\//.test(url.pathname))) {
          categories.add('endpoint de instalação incorporado');
        }
      } catch { /* Interpolated URLs are checked after configuration. */ }
    }
    for (const match of line.matchAll(/\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g)) {
      if (!isExampleHost(match[1]) && match[0] !== 'your-service-account@your-project.iam.gserviceaccount.com') {
        categories.add('contacto pessoal ou de instalação');
      }
    }
    for (const category of categories) findings.push({ line: index + 1, category });
  }
  return findings;
}

export function checkRepository(cwd = process.cwd()) {
  // Cached files remain visible even if someone adds them to .gitignore later.
  const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error('Não foi possível listar os ficheiros com Git.');
  const files = [...new Set(result.stdout.split('\0').filter(Boolean))];
  const findings = [];
  let texts = 0;
  let binaries = 0;
  for (const file of files) {
    for (const category of inspectPath(file)) findings.push({ file, category });
    const absolute = path.join(cwd, file);
    if (!fs.existsSync(absolute)) continue;
    const data = fs.lstatSync(absolute).isSymbolicLink()
      ? Buffer.from(fs.readlinkSync(absolute)) : fs.readFileSync(absolute);
    let text;
    if (data[0] === 0xff && data[1] === 0xfe) text = data.subarray(2).toString('utf16le');
    else if (data.includes(0)) { binaries++; continue; }
    else text = data.toString('utf8');
    texts++;
    findings.push(...scanText(text).map(finding => ({ file, ...finding })));
  }
  return { texts, binaries, findings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { texts, binaries, findings } = checkRepository();
    for (const finding of findings) {
      console.error(`${finding.file}${finding.line ? ':' + finding.line : ''}: ${finding.category}`);
    }
    console.log(`${texts} ficheiros de texto verificados; ${binaries} binários sem análise de conteúdo.`);
    console.log('Verificação por padrões; imagens, histórico Git e serviços externos exigem revisão separada.');
    if (findings.length) process.exitCode = 1;
    else console.log('Nenhum dos padrões sensíveis pesquisados foi encontrado nos ficheiros publicáveis.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
