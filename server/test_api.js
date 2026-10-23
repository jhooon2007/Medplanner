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
    body: { start_date: '2026-12-20', end_date: '' },
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

// ---------------- Correções da auditoria de segurança ----------------

async function newStudent(tag) {
  const r = await call('POST', '/api/auth/register', {
    body: { name: `Aluno ${tag}`, email: `${tag}@test.local`, password: 'senha-forte' },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}

test('aluno não adiciona assunto em matéria oficial nem na de outro aluno', async () => {
  const a = await newStudent('topa');
  const b = await newStudent('topb');
  const official = (await call('GET', '/api/subjects', { token: a.token })).body.subjects.find(s => s.user_id === null);
  const r1 = await call('POST', `/api/subjects/${official.id}/topics`, { token: a.token, body: { name: 'Falso' } });
  assert.equal(r1.status, 403);

  const mine = (await call('POST', '/api/subjects', { token: a.token, body: { name: 'Minha' } })).body.subject;
  assert.equal((await call('POST', `/api/subjects/${mine.id}/topics`, { token: b.token, body: { name: 'x' } })).status, 403);
  assert.equal((await call('POST', `/api/subjects/${mine.id}/topics`, { token: a.token, body: { name: 'Meu assunto' } })).status, 201);

  // admin continua podendo editar a matéria oficial
  assert.equal((await call('POST', `/api/subjects/${official.id}/topics`, { token: state.admin, body: { name: 'Oficial novo' } })).status, 201);
});

test('grade: adicionar aula mantém as padrão; editar/excluir padrão afeta só o aluno', async () => {
  const a = await newStudent('graa');
  const b = await newStudent('grab');
  const before = (await call('GET', '/api/classes', { token: a.token })).body.classes;
  const official = before.find(c => c.user_id === null);
  assert.ok(official);

  const add = await call('POST', '/api/classes', {
    token: a.token, body: { day_of_week: 6, start_time: '10:00', end_time: '11:00', subject_name: 'Monitoria' },
  });
  assert.equal(add.status, 201);
  assert.equal((await call('GET', '/api/classes', { token: a.token })).body.classes.length, before.length + 1);

  const edit = await call('PUT', `/api/classes/${official.id}`, { token: a.token, body: { ...official, room: 'Sala nova' } });
  assert.equal(edit.status, 200);
  const afterEdit = (await call('GET', '/api/classes', { token: a.token })).body.classes;
  assert.ok(!afterEdit.some(c => c.id === official.id), 'original some da grade do aluno');
  assert.ok(afterEdit.some(c => c.room === 'Sala nova' && c.user_id !== null), 'cópia própria aparece');

  const other = (await call('GET', '/api/classes', { token: b.token })).body.classes.find(c => c.id === official.id);
  assert.equal(other.room, official.room, 'colega continua vendo a aula original');

  const hidden = before.find(c => c.user_id === null && c.id !== official.id);
  assert.equal((await call('DELETE', `/api/classes/${hidden.id}`, { token: a.token })).status, 200);
  assert.ok(!(await call('GET', '/api/classes', { token: a.token })).body.classes.some(c => c.id === hidden.id));
  assert.ok((await call('GET', '/api/classes', { token: b.token })).body.classes.some(c => c.id === hidden.id));
});

test('senha: curta é recusada e troca encerra as sessões antigas', async () => {
  const a = await newStudent('pwd');
  const short = await call('PUT', '/api/auth/profile', { token: a.token, body: { password: '123' } });
  assert.equal(short.status, 400);

  const changed = await call('PUT', '/api/auth/profile', { token: a.token, body: { password: 'nova-senha-1' } });
  assert.equal(changed.status, 200);
  assert.equal((await call('GET', '/api/auth/me', { token: a.token })).status, 401, 'token antigo deixa de valer');
  assert.equal((await call('GET', '/api/auth/me', { token: changed.body.token })).status, 200, 'token novo vale');
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'pwd@test.local', password: 'senha-forte' } })).status, 401);
});

test('validação de entrada recusa dados inválidos com 400', async () => {
  const a = await newStudent('val');
  const cases = [
    ['POST', '/api/auth/register', { name: 'X', email: 'sem-arroba', password: 'senha123' }, null],
    ['POST', '/api/auth/register', { name: 'X'.repeat(500), email: 'longo@test.local', password: 'senha123' }, null],
    ['POST', '/api/grades/batch', { gradesList: [{ module: 'CHS_II', item_key: 'BIOQ_N1', score: 999 }] }, a.token],
    ['POST', '/api/grades/batch', { gradesList: [{ module: 'CHS_II', item_key: 'BIOQ_N1', score: -5 }] }, a.token],
    ['POST', '/api/grades/batch', { gradesList: [{ score: 5 }] }, a.token],
    ['POST', '/api/events', { title: { x: 1 }, module_or_subject: 'X', start_date: '2026-01-01' }, a.token],
    ['POST', '/api/events', { title: 'T', module_or_subject: 'X', start_date: 'ontem' }, a.token],
    ['POST', '/api/events', { title: 'T', module_or_subject: 'X', start_date: '2026-01-01', topics: [{ o: 1 }] }, a.token],
    ['POST', '/api/classes', { day_of_week: 9, start_time: 'xx', end_time: 'yy', subject_name: 'A' }, a.token],
    ['POST', '/api/checklist/toggle', { subtopic_id: 999999, completed: true }, a.token],
    ['POST', '/api/admin/announcements', { title: 'a', message: 'b', expires_at: 'amanhã' }, state.admin],
  ];
  for (const [method, url, body, token] of cases) {
    const r = await call(method, url, { token, body });
    assert.ok(r.status === 400 || r.status === 404, `${method} ${url} ${JSON.stringify(body).slice(0, 60)} → ${r.status}`);
  }
  // nada inválido foi gravado
  const grades = (await call('GET', '/api/grades', { token: a.token })).body.grades;
  assert.equal(grades.length, 0);
});

test('erros não expõem detalhes internos do banco', async () => {
  const a = await newStudent('dupa');
  await newStudent('dupb');
  const r = await call('PUT', `/api/admin/users/${a.user.id}`, { token: state.admin, body: { email: 'dupb@test.local' } });
  assert.equal(r.status, 400);
  assert.ok(!/SQLITE|constraint/i.test(r.body.error), r.body.error);

  const res = await fetch(baseUrl + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{quebrado' });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error && !/at .+\.js/.test(JSON.stringify(body)));
});

test('cabeçalhos de segurança e sem CORS aberto', async () => {
  const res = await fetch(baseUrl + '/api/announcements', { headers: { Origin: 'https://site-malicioso.com' } });
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('foto: só imagem de verdade, servida por chave aleatória', async () => {
  const a = await newStudent('foto');
  const send = (blob) => {
    const fd = new FormData();
    fd.append('photo', blob, 'f.png');
    return fetch(baseUrl + '/api/auth/profile', { method: 'PUT', headers: { Authorization: `Bearer ${a.token}` }, body: fd });
  };
  const fake = await send(new Blob(['<html><script>alert(1)</script></html>'], { type: 'image/png' }));
  assert.equal(fake.status, 400, 'HTML disfarçado de PNG é recusado');

  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const ok = await send(new Blob([png], { type: 'image/png' }));
  assert.equal(ok.status, 200);
  const { user } = await ok.json();
  assert.match(user.photo_url, /^\/api\/photos\/[a-f0-9]{48}$/);
  assert.equal((await fetch(baseUrl + user.photo_url)).status, 200);
  assert.equal((await fetch(baseUrl + `/api/users/${a.user.id}/photo`)).status !== 200, true, 'rota antiga por número não existe mais');
});

test('aluno exclui a própria conta e os dados dele', async () => {
  const a = await newStudent('bye');
  await call('POST', '/api/events', { token: a.token, body: { title: 'E', module_or_subject: 'X', start_date: '2026-11-01' } });
  assert.equal((await call('DELETE', '/api/auth/me', { token: a.token, body: {} })).status, 400, 'exige confirmação');
  assert.equal((await call('DELETE', '/api/auth/me', { token: a.token, body: { confirm: 'EXCLUIR' } })).status, 200);
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'bye@test.local', password: 'senha-forte' } })).status, 401);
  const list = (await call('GET', '/api/admin/users', { token: state.admin })).body.users;
  assert.ok(!list.some(u => u.email === 'bye@test.local'));

  assert.equal((await call('DELETE', '/api/auth/me', { token: state.admin, body: { confirm: 'EXCLUIR' } })).status, 400, 'admin não se exclui por aqui');
});
