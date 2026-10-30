import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { checkRepository, inspectPath, scanText } from './check-public-safety.mjs';

test('permite exemplos e código que apenas manipula chaves', () => {
  const text = [
    'https://your-project.supabase.co',
    'https://automation.example.com/webhook/upload',
    'suporte@example.com',
    'key.replace("-----BEGIN PRIVATE KEY-----", "")',
    'const token = session.access_token;',
  ].join('\n');
  assert.deepEqual(scanText(text), []);
});

test('detecta segredos sem devolver os seus valores', () => {
  const key = ['sk', 'proj', 'x'.repeat(30)].join('-');
  const pem = ['-----BEGIN ' + 'PRIVATE KEY-----', 'A'.repeat(64), '-----END ' + 'PRIVATE KEY-----'].join('\n');
  const jwt = ['eyJ' + 'a'.repeat(20), 'b'.repeat(20), 'c'.repeat(20)].join('.');
  for (const value of [key, pem, jwt, 'postgres' + 'ql://user:password@localhost/db']) {
    const findings = scanText(value);
    assert.ok(findings.length > 0);
    assert.ok(findings.every(finding => !JSON.stringify(finding).includes(value)));
  }
});

test('deteta endpoints e contactos reais, incluindo fora de ficheiros env', () => {
  for (const value of [
    'https://' + 'tenant.supabase' + '.co',
    'https://' + 'automation.vendor' + '.invalid/webhook/upload',
    'private' + '@mail.invalid',
  ]) assert.ok(scanText(value).length > 0);
});

test('protege ambientes, backups e capturas, preservando exemplos e migrações SQL', () => {
  for (const file of ['.env.production', 'supabase/.env', 'credentials.json', 'backup.dump',
    '.private/original.txt', 'public/img_documentacao/screenshot.jpg']) {
    assert.ok(inspectPath(file).length > 0);
  }
  assert.deepEqual(inspectPath('supabase/.env.example'), []);
  assert.deepEqual(inspectPath('supabase/migration.sql'), []);
});

test('não esconde ficheiros já rastreados quando são adicionados ao gitignore', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'public-safety-test-'));
  const git = args => {
    const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, 'Git fixture command failed');
  };
  try {
    git(['init', '--quiet']);
    fs.writeFileSync(path.join(directory, '.env.production'), 'NOT_A_REAL_SECRET=example\n');
    git(['add', '.env.production']);
    fs.writeFileSync(path.join(directory, '.gitignore'), '.env*\n.private/\n');
    fs.mkdirSync(path.join(directory, '.private'));
    fs.writeFileSync(path.join(directory, '.private', 'original.txt'), 'private' + '@mail.invalid');
    const result = checkRepository(directory);
    assert.ok(result.findings.some(finding => finding.file === '.env.production'));
    assert.ok(result.findings.every(finding => !finding.file.startsWith('.private/')));
  } finally {
    const resolved = path.resolve(directory);
    const temporaryRoot = path.resolve(os.tmpdir()) + path.sep;
    assert.ok(resolved.startsWith(temporaryRoot) && path.basename(resolved).startsWith('public-safety-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
