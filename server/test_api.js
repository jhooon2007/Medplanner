// Teste de integração da API. Uso: npm test
// Usa um banco temporário e não depende de nenhuma credencial real.
const os = require('os');
const path = require('path');
const fs = require('fs');

const dbFile = path.join(os.tmpdir(), `medplanner-test-${process.pid}.db`);
process.env.TURSO_DATABASE_URL = `file:${dbFile}`;
process.env.ADMIN_EMAIL = 'admin@test.local';
process.env.ADMIN_PASSWORD = 'admin-test-pass';
process.env.JWT_SECRET = 'test-secret';
process.env.DISABLE_SERVER_LISTEN = '1';

const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('http');
const app = require('./index');

let baseUrl;
let server;

async function call(method, url, { token, body } = {}) {
  const res = await fetch(baseUrl + url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : {} };
}

test.before(async () => {
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  // Aguarda o banco inicializar (a primeira rota espera o init terminar)
  await call('GET', '/api/announcements');
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
  for (const f of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) fs.rmSync(f, { force: true });
});

const state = {};

test('login do admin e rejeição de tokens forjados', async () => {
  const login = await call('POST', '/api/auth/login', { body: { email: 'admin@test.local', password: 'admin-test-pass' } });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'admin');
  state.admin = login.body.token;

  for (const fake of ['admin-token-1', 'local-token-1', 'google-token-1']) {
    const r = await call('GET', '/api/admin/users', { token: fake });
    assert.equal(r.status, 401, `${fake} não pode autenticar`);
  }

  const noToken = await call('GET', '/api/admin/users');
  assert.equal(noToken.status, 401);
});

test('login do Google sem token válido é recusado (não aceita e-mail informado pelo cliente)', async () => {
  const r = await call('POST', '/api/auth/google', { body: { email: 'admin@test.local', name: 'x' } });
  assert.equal(r.status, 400);
});

test('aluno se cadastra e aparece para o admin', async () => {
  const reg = await call('POST', '/api/auth/register', {
    body: { name: 'Aluna Teste', email: 'Aluna@Test.local', password: 'senha-forte', phone: '(62) 90000-0000' },
  });
  assert.equal(reg.status, 201);
  state.student = reg.body.token;
  state.studentId = reg.body.user.id;

  const list = await call('GET', '/api/admin/users', { token: state.admin });
  assert.equal(list.status, 200);
  const found = list.body.users.find(u => u.email === 'aluna@test.local');
  assert.ok(found, 'admin deve ver o aluno cadastrado');
  assert.equal(found.role, 'student');
  assert.ok(found.last_login_at);

  const stats = await call('GET', '/api/admin/stats', { token: state.admin });
  assert.equal(stats.body.stats.totalStudents, 1);
});

test('aluno não acessa rotas de admin', async () => {
  for (const url of ['/api/admin/users', '/api/admin/stats', '/api/admin/announcements', '/api/admin/events']) {
    const r = await call('GET', url, { token: state.student });
    assert.equal(r.status, 403, url);
  }
  const r = await call('POST', '/api/admin/announcements', { token: state.student, body: { title: 'x', message: 'y' } });
  assert.equal(r.status, 403);
});

test('aviso geral chega ao aluno e some quando ocultado ou expirado', async () => {
  const created = await call('POST', '/api/admin/announcements', {
    token: state.admin,
    body: { title: 'Sem aula na terça', message: 'Não haverá aula.', level: 'urgent' },
  });
  assert.equal(created.status, 201);
  const id = created.body.announcement.id;

  let seen = await call('GET', '/api/announcements', { token: state.student });
  assert.equal(seen.body.announcements.length, 1);
  assert.equal(seen.body.announcements[0].level, 'urgent');

  await call('PUT', `/api/admin/announcements/${id}`, { token: state.admin, body: { active: false } });
  seen = await call('GET', '/api/announcements', { token: state.student });
  assert.equal(seen.body.announcements.length, 0);

  await call('PUT', `/api/admin/announcements/${id}`, { token: state.admin, body: { active: true, expires_at: '2000-01-01' } });
  seen = await call('GET', '/api/announcements', { token: state.student });
  assert.equal(seen.body.announcements.length, 0, 'aviso expirado não aparece');
});

test('evento da turma muda para todos sem mexer nos eventos criados pelo aluno', async () => {
  const mine = await call('POST', '/api/events', {
    token: state.student,
    body: { title: 'Meu estudo', module_or_subject: 'Anatomia', start_date: '2026-11-05', type: 'Prova' },
  });
  assert.equal(mine.status, 201);

  const before = await call('GET', '/api/events', { token: state.student });
  const classEvent = before.body.events.find(e => e.user_id === null);
  assert.ok(classEvent, 'existe ao menos um evento da turma');

  const edited = await call('PUT', `/api/admin/events/${classEvent.id}`, {
    token: state.admin,
    body: { start_date: '2026-12-20' },
  });
  assert.equal(edited.status, 200);

  const after = await call('GET', '/api/events', { token: state.student });
  assert.equal(after.body.events.find(e => e.id === classEvent.id).start_date, '2026-12-20');
  const stillMine = after.body.events.find(e => e.id === mine.body.event.id);
  assert.equal(stillMine.start_date, '2026-11-05', 'evento do aluno permanece intacto');

  const forbidden = await call('PUT', `/api/events/${classEvent.id}`, { token: state.student, body: { title: 'hack' } });
  assert.equal(forbidden.status, 403, 'aluno não altera evento da turma');
});

test('notas vazias são salvas como nulas e não contam como lançadas', async () => {
  const save = await call('POST', '/api/grades/batch', {
    token: state.student,
    body: {
      gradesList: [
        { module: 'CHS_II', item_key: 'BIOQ_N1', item_name: 'BIOQ_N1', score: 7.5 },
        { module: 'CHS_II', item_key: 'BIOQ_N2', item_name: 'BIOQ_N2', score: null },
        { module: 'CHS_II', item_key: 'BIOQ_N3', item_name: 'BIOQ_N3', score: '' },
      ],
    },
  });
  assert.equal(save.status, 200);

  const details = await call('GET', `/api/admin/users/${state.studentId}/details`, { token: state.admin });
  assert.equal(details.status, 200);
  assert.deepEqual(details.body.grades.map(g => g.item_key), ['BIOQ_N1']);
});

test('admin não pode se rebaixar nem se excluir', async () => {
  const me = await call('GET', '/api/auth/me', { token: state.admin });
  const demote = await call('PUT', `/api/admin/users/${me.body.user.id}`, { token: state.admin, body: { role: 'student' } });
  assert.equal(demote.status, 400);
  const del = await call('DELETE', `/api/admin/users/${me.body.user.id}`, { token: state.admin });
  assert.equal(del.status, 400);
});
