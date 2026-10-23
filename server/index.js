const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const v = require('./validation');

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 5000;
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

// Em produção faltar configuração não derruba a função: toda rota /api explica o que falta.
const missingConfig = [];
if (isServerless) {
  const dbUrl = process.env.TURSO_DATABASE_URL;
  if (!dbUrl) missingConfig.push('TURSO_DATABASE_URL');
  else if (!dbUrl.startsWith('file:') && !process.env.TURSO_AUTH_TOKEN) missingConfig.push('TURSO_AUTH_TOKEN');
  if (!process.env.JWT_SECRET) missingConfig.push('JWT_SECRET');
}

if (missingConfig.length) {
  console.error('Configuração incompleta, faltam:', missingConfig.join(', '));
  app.use('/api', (req, res) => {
    res.status(503).json({
      error: `Servidor sem configuração: faltam as variáveis ${missingConfig.join(', ')} na Vercel.`,
      missing: missingConfig,
    });
  });
  module.exports = app;
  return; // CommonJS: encerra o carregamento deste módulo (nada abaixo precisa rodar)
}

const { db, initDatabase } = require('./db');
const JWT_SECRET = process.env.JWT_SECRET || 'medplanner-dev-only-secret';

// Initialize Database (as rotas aguardam a inicialização terminar)
const dbReady = initDatabase();
dbReady.catch(err => console.error('Falha ao inicializar o banco:', err));

// Middleware
// Sem CORS: o site e a API ficam no mesmo endereço, então nenhum outro site precisa chamar a API.
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json({ limit: '100kb' }));

// Diagnóstico público (não expõe valores, só se cada item está configurado)
app.get('/api/health', async (req, res) => {
  const report = {
    ok: false,
    serverless: isServerless,
    config: {
      TURSO_DATABASE_URL: Boolean(process.env.TURSO_DATABASE_URL),
      TURSO_AUTH_TOKEN: Boolean(process.env.TURSO_AUTH_TOKEN),
      JWT_SECRET: Boolean(process.env.JWT_SECRET),
      ADMIN_EMAIL: Boolean(process.env.ADMIN_EMAIL),
      ADMIN_PASSWORD: Boolean(process.env.ADMIN_PASSWORD),
    },
    database: 'não testado',
  };
  try {
    await dbReady;
    await db.prepare('SELECT 1 AS ok').get();
    report.database = 'conectado';
    report.ok = true;
    res.json(report);
  } catch (err) {
    report.database = 'erro: ' + err.message;
    res.status(503).json(report);
  }
});

app.use(async (req, res, next) => {
  try {
    await dbReady;
    next();
  } catch (err) {
    res.status(503).json({ error: 'Banco de dados indisponível: ' + err.message });
  }
});

// Fotos de perfil: ficam em memória e são gravadas no banco (disco da Vercel é efêmero)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 }, // 1MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens nos formatos JPEG, PNG ou WEBP são permitidas.'));
    }
  }
});

const USER_FIELDS = 'id, name, email, phone, photo_url, role, birth_date, current_semester, onboarding_completed, created_at';

// Resposta de erro padrão: mensagens de validação vão para o usuário; erros internos não vazam detalhes.
function sendError(res, err) {
  if (err instanceof v.ValidationError) {
    return res.status(400).json({ error: err.message });
  }
  const msg = String(err && err.message || '');
  if (/UNIQUE constraint failed: users\.email/.test(msg)) {
    return res.status(400).json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
  }
  if (/FOREIGN KEY constraint failed/.test(msg)) {
    return res.status(400).json({ error: 'Referência inválida: o item relacionado não existe.' });
  }
  console.error('Erro interno:', err);
  return res.status(500).json({ error: 'Erro interno no servidor. Tente novamente em instantes.' });
}

// Confere a assinatura real do arquivo (não só o tipo informado pelo navegador)
function detectImageMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

async function savePhoto(userId, file) {
  const mime = detectImageMime(file.buffer);
  if (!mime) throw new v.ValidationError('A foto precisa ser uma imagem JPEG, PNG ou WEBP válida.');
  // Chave aleatória: a foto não pode ser encontrada só sabendo o número do aluno
  const key = crypto.randomBytes(24).toString('hex');
  await db.prepare(`
    INSERT INTO user_photos (user_id, mime, data, photo_key) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, photo_key = excluded.photo_key
  `).run(userId, mime, file.buffer.toString('base64'), key);
  const photoUrl = `/api/photos/${key}`;
  await db.prepare('UPDATE users SET photo_url = ? WHERE id = ?').run(photoUrl, userId);
  return photoUrl;
}

// tv = versão da senha; ao trocar a senha a versão sobe e os tokens antigos deixam de valer
function issueToken(user) {
  return jwt.sign({ id: user.id, tv: user.token_version || 0 }, JWT_SECRET, { expiresIn: '7d' });
}

async function tokenFor(userId) {
  const row = await db.prepare('SELECT id, token_version FROM users WHERE id = ?').get(userId);
  return issueToken(row);
}

// Authentication Middleware: valida a assinatura e carrega o usuário (e o papel) do banco
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Acesso não autorizado. Faça login primeiro.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Sessão expirada ou inválida. Faça login novamente.' });
    }

    const user = decoded && decoded.id
      ? await db.prepare('SELECT id, name, email, role, token_version FROM users WHERE id = ?').get(decoded.id)
      : undefined;
    if (!user) {
      return res.status(401).json({ error: 'Conta não encontrada. Faça login novamente.' });
    }
    if ((decoded.tv || 0) !== (user.token_version || 0)) {
      return res.status(401).json({ error: 'Sua senha foi alterada. Faça login novamente.' });
    }

    req.user = user;
    next();
  } catch (err) {
    sendError(res, err);
  }
}

// Admin authorization middleware
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem acessar este recurso.' });
  }
  next();
}

// ==========================================
// 1. AUTH & PROFILE ROUTES
// ==========================================

// Foto de perfil. A rota é pública porque <img> não envia o cabeçalho Authorization;
// a proteção é a chave aleatória de 48 caracteres, que só aparece para quem já vê o aluno.
app.get('/api/photos/:key', async (req, res) => {
  try {
    const key = String(req.params.key || '');
    if (!/^[a-f0-9]{48}$/.test(key)) return res.status(404).end();
    const photo = await db.prepare('SELECT mime, data FROM user_photos WHERE photo_key = ?').get(key);
    if (!photo) return res.status(404).end();
    res.set('Content-Type', photo.mime);
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    res.send(Buffer.from(photo.data, 'base64'));
  } catch (err) {
    res.status(500).end();
  }
});

// Register
app.post('/api/auth/register', upload.single('photo'), async (req, res) => {
  try {
    const name = v.text(req.body.name, 'Nome', { max: 100, min: 2 });
    const normalizedEmail = v.email(req.body.email);
    const password = v.password(req.body.password);
    const phone = v.text(req.body.phone, 'Telefone', { max: 30, required: false });
    if (req.file && !detectImageMime(req.file.buffer)) {
      throw new v.ValidationError('A foto precisa ser uma imagem JPEG, PNG ou WEBP válida.');
    }

    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }

    const result = await db.prepare(`
      INSERT INTO users (name, email, password, phone, role, last_login_at)
      VALUES (?, ?, ?, ?, 'student', CURRENT_TIMESTAMP)
    `).run(name, normalizedEmail, bcrypt.hashSync(password, 10), phone);

    if (req.file) {
      await savePhoto(result.lastInsertRowid, req.file);
    }

    const user = await db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(result.lastInsertRowid);

    res.status(201).json({
      message: 'Usuário cadastrado com sucesso!',
      token: await tokenFor(user.id),
      user
    });
  } catch (err) {
    sendError(res, err);
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ error: 'Informe e-mail e senha.' });
    }

    const row = await db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!row || !bcrypt.compareSync(password, row.password)) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    await db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
    const user = await db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(row.id);

    res.json({
      message: 'Login realizado com sucesso!',
      token: await tokenFor(user.id),
      user
    });
  } catch (err) {
    sendError(res, err);
  }
});

// Valida o token do Google no servidor (o cliente nunca é confiável para dizer qual é o e-mail)
async function verifyGoogleToken({ credential, access_token }) {
  const query = credential
    ? `id_token=${encodeURIComponent(credential)}`
    : `access_token=${encodeURIComponent(access_token)}`;
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?${query}`);
  if (!res.ok) throw new Error('Token do Google inválido ou expirado.');
  const info = await res.json();

  if (String(info.email_verified) !== 'true' || !info.email) {
    throw new Error('A conta Google não possui e-mail verificado.');
  }
  const expectedClient = process.env.GOOGLE_CLIENT_ID;
  if (expectedClient && info.aud !== expectedClient && info.azp !== expectedClient) {
    throw new Error('Token do Google emitido para outro aplicativo.');
  }

  let name = info.name;
  let picture = info.picture;
  if (!name && access_token) {
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    if (profileRes.ok) {
      const profile = await profileRes.json();
      name = profile.name;
      picture = picture || profile.picture;
    }
  }
  return { email: info.email.toLowerCase().trim(), name, picture };
}

// Google Authentication
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential, access_token } = req.body || {};
    if ((!credential || typeof credential !== 'string') && (!access_token || typeof access_token !== 'string')) {
      return res.status(400).json({ error: 'Credencial do Google não informada.' });
    }

    let google;
    try {
      google = await verifyGoogleToken({ credential, access_token });
    } catch (verifyErr) {
      return res.status(401).json({ error: verifyErr.message });
    }

    let row = await db.prepare('SELECT * FROM users WHERE email = ?').get(google.email);
    if (!row) {
      const randomPassword = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
      const result = await db.prepare(`
        INSERT INTO users (name, email, password, photo_url, role)
        VALUES (?, ?, ?, ?, 'student')
      `).run((google.name || google.email.split('@')[0]).slice(0, 100), google.email, randomPassword, google.picture || null);
      row = { id: result.lastInsertRowid };
    } else if (google.picture && !row.photo_url) {
      await db.prepare('UPDATE users SET photo_url = ? WHERE id = ?').run(google.picture, row.id);
    }

    await db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
    const user = await db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(row.id);

    res.json({
      message: 'Autenticado via Google com sucesso!',
      token: await tokenFor(user.id),
      user
    });
  } catch (err) {
    sendError(res, err);
  }
});

// Get current user profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.json({ user });
  } catch (err) {
    sendError(res, err);
  }
});

// O próprio aluno apaga a conta e todos os dados dele (direito de exclusão da LGPD)
app.delete('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    if ((req.body || {}).confirm !== 'EXCLUIR') {
      return res.status(400).json({ error: 'Para confirmar, envie a palavra EXCLUIR.' });
    }
    if (req.user.role === 'admin') {
      return res.status(400).json({ error: 'Contas de administrador não podem ser excluídas por aqui. Peça a outro administrador.' });
    }
    await db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
    res.json({ message: 'Sua conta e todos os seus dados foram excluídos.' });
  } catch (err) {
    sendError(res, err);
  }
});

// Data de nascimento: válida, no passado e com idade plausível
function birthDate(value) {
  const d = v.date(value, 'Data de nascimento');
  const year = parseInt(d.slice(0, 4), 10);
  const today = new Date().toISOString().slice(0, 10);
  if (d >= today || year < 1900) throw new v.ValidationError('Data de nascimento inválida.');
  return d;
}

// Onboarding Submission (Mandatory questionnaire after account creation)
async function handleOnboarding(req, res) {
  try {
    const body = req.body || {};
    const birth = birthDate(body.birth_date);
    const semesterNum = v.semester(body.current_semester);
    const name = v.text(body.name, 'Nome', { max: 100, min: 2, required: false });
    const phone = v.text(body.phone, 'Telefone', { max: 30, required: false });

    let query = 'UPDATE users SET birth_date = ?, current_semester = ?, onboarding_completed = 1';
    const params = [birth, semesterNum];

    if (name) {
      query += ', name = ?';
      params.push(name);
    }
    if (phone) {
      query += ', phone = ?';
      params.push(phone);
    }

    query += ' WHERE id = ?';
    params.push(req.user.id);

    await db.prepare(query).run(...params);

    const user = await db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(req.user.id);

    res.json({
      message: 'Questionário de onboarding concluído com sucesso!',
      user,
      token: await tokenFor(user.id)
    });
  } catch (err) {
    sendError(res, err);
  }
}
app.post('/api/auth/onboarding', authenticateToken, handleOnboarding);
app.put('/api/auth/onboarding', authenticateToken, handleOnboarding);

// Update profile (photo, phone, name, password)
app.put('/api/auth/profile', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const body = req.body || {};
    const userId = req.user.id;
    const name = v.text(body.name, 'Nome', { max: 100, min: 2, required: false });
    const phone = v.text(body.phone, 'Telefone', { max: 30, required: false });
    const birth = body.birth_date ? birthDate(body.birth_date) : null;
    const semesterNum = v.semester(body.current_semester, { required: false });
    // Senha inválida agora gera erro em vez de ser ignorada em silêncio
    const password = v.password(body.password, { required: false });

    let query = 'UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone)';
    const params = [name, phone];

    if (birth) {
      query += ', birth_date = ?';
      params.push(birth);
    }
    if (semesterNum) {
      query += ', current_semester = ?';
      params.push(semesterNum);
    }
    if (password) {
      query += ', password = ?, token_version = token_version + 1';
      params.push(bcrypt.hashSync(password, 10));
    }

    query += ' WHERE id = ?';
    params.push(userId);

    await db.prepare(query).run(...params);
    if (req.file) {
      await savePhoto(userId, req.file);
    }

    const user = await db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(userId);

    res.json({
      message: password ? 'Perfil e senha atualizados! Outras sessões abertas foram encerradas.' : 'Perfil atualizado com sucesso!',
      user,
      token: await tokenFor(userId)
    });
  } catch (err) {
    sendError(res, err);
  }
});

// ==========================================
// 2. ADMIN DASHBOARD ROUTES
// ==========================================

const todayInBrazil = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

// List all users for Admin (com indicadores de uso de cada aluno)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.photo_url, u.role, u.birth_date, u.current_semester,
             u.onboarding_completed, u.created_at, u.last_login_at,
             (SELECT COUNT(*) FROM checklist_progress cp WHERE cp.user_id = u.id AND cp.completed = 1) AS completed_subtopics_count,
             (SELECT COUNT(*) FROM grades g WHERE g.user_id = u.id AND g.score IS NOT NULL) AS grades_filled_count,
             (SELECT COUNT(*) FROM events e WHERE e.user_id = u.id) AS custom_events_count,
             (SELECT COUNT(*) FROM classes c WHERE c.user_id = u.id) AS custom_classes_count
      FROM users u
      ORDER BY u.created_at DESC
    `).all();

    res.json({ users });
  } catch (err) {
    sendError(res, err);
  }
});

// Detalhes de um aluno: notas lançadas e progresso por matéria
app.get('/api/admin/users/:id/details', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const user = await db.prepare(`SELECT ${USER_FIELDS}, last_login_at FROM users WHERE id = ?`).get(targetId);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const grades = await db.prepare(`
      SELECT module, discipline, item_key, score FROM grades
      WHERE user_id = ? AND score IS NOT NULL ORDER BY module, item_key
    `).all(targetId);

    const progress = await db.prepare(`
      SELECT s.id AS subject_id, s.name AS subject_name,
             (SELECT COUNT(*) FROM subtopics st JOIN topics t ON t.id = st.topic_id WHERE t.subject_id = s.id) AS total,
             (SELECT COUNT(*) FROM checklist_progress cp
                JOIN subtopics st ON st.id = cp.subtopic_id
                JOIN topics t ON t.id = st.topic_id
              WHERE t.subject_id = s.id AND cp.user_id = ? AND cp.completed = 1) AS completed
      FROM subjects s
      WHERE s.user_id IS NULL OR s.user_id = ?
      ORDER BY s.order_index
    `).all(targetId, targetId);

    const events = await db.prepare('SELECT id, title, module_or_subject, start_date, type FROM events WHERE user_id = ? ORDER BY start_date').all(targetId);

    res.json({ user, grades, progress, events });
  } catch (err) {
    sendError(res, err);
  }
});

// Update user by Admin
app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const body = req.body || {};
    const existing = await db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const name = v.text(body.name, 'Nome', { max: 100, min: 2, required: false });
    const email = body.email ? v.email(body.email) : null;
    const phone = v.text(body.phone, 'Telefone', { max: 30, required: false });
    const role = v.oneOf(body.role, ['student', 'admin'], 'Perfil', null);
    const birth = body.birth_date ? birthDate(body.birth_date) : null;
    const semesterNum = v.semester(body.current_semester, { required: false });
    const password = v.password(body.password, { required: false });

    if (targetId === req.user.id && role && role !== 'admin') {
      return res.status(400).json({ error: 'Você não pode remover seu próprio acesso de administrador.' });
    }

    let query = 'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone), role = COALESCE(?, role)';
    const params = [name, email, phone, role];

    if (birth) {
      query += ', birth_date = ?';
      params.push(birth);
    }
    if (semesterNum) {
      query += ', current_semester = ?';
      params.push(semesterNum);
    }
    if (body.onboarding_completed !== undefined) {
      query += ', onboarding_completed = ?';
      params.push(body.onboarding_completed ? 1 : 0);
    }
    if (password) {
      // Nova senha encerra as sessões abertas desse usuário
      query += ', password = ?, token_version = token_version + 1';
      params.push(bcrypt.hashSync(password, 10));
    }

    query += ' WHERE id = ?';
    params.push(targetId);

    await db.prepare(query).run(...params);

    const updated = await db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(targetId);
    res.json({ message: 'Usuário atualizado pelo Administrador.', user: updated });
  } catch (err) {
    sendError(res, err);
  }
});

// Delete user by Admin
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Você não pode excluir sua própria conta de administrador.' });
    }

    await db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    res.json({ message: 'Usuário removido com sucesso.' });
  } catch (err) {
    sendError(res, err);
  }
});

// Create user by Admin
app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const name = v.text(body.name, 'Nome', { max: 100, min: 2 });
    const normalizedEmail = v.email(body.email);
    const password = v.password(body.password);
    const phone = v.text(body.phone, 'Telefone', { max: 30, required: false });
    const role = v.oneOf(body.role, ['student', 'admin'], 'Perfil', 'student');
    const birth = body.birth_date ? birthDate(body.birth_date) : null;
    const sem = v.semester(body.current_semester, { required: false }) || 1;

    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return res.status(400).json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
    }

    // Sem foto: a tela mostra as iniciais (não enviamos o nome do aluno para serviços externos)
    const result = await db.prepare(`
      INSERT INTO users (name, email, password, phone, photo_url, role, birth_date, current_semester, onboarding_completed)
      VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 1)
    `).run(name, normalizedEmail, bcrypt.hashSync(password, 10), phone, role, birth, sem);

    const newUser = await db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ message: 'Usuário cadastrado com sucesso!', user: newUser });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin Stats
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const count = async (sql, ...args) => (await db.prepare(sql).get(...args)).count;

    const totalUsers = await count('SELECT count(*) as count FROM users');
    const totalStudents = await count("SELECT count(*) as count FROM users WHERE role = 'student'");
    const totalEvents = await count('SELECT count(*) as count FROM events WHERE user_id IS NULL');
    const totalSubjects = await count('SELECT count(*) as count FROM subjects WHERE user_id IS NULL');
    const totalSubtopics = await count('SELECT count(*) as count FROM subtopics');
    const newThisWeek = await count("SELECT count(*) as count FROM users WHERE role = 'student' AND created_at >= datetime('now', '-7 days')");
    const activeThisWeek = await count("SELECT count(*) as count FROM users WHERE role = 'student' AND last_login_at >= datetime('now', '-7 days')");
    const pendingOnboarding = await count("SELECT count(*) as count FROM users WHERE role = 'student' AND COALESCE(onboarding_completed, 0) = 0");
    const activeAnnouncements = await count(
      'SELECT count(*) as count FROM announcements WHERE active = 1 AND (expires_at IS NULL OR expires_at >= ?)',
      todayInBrazil()
    );
    const bySemester = await db.prepare(`
      SELECT current_semester AS semester, count(*) AS count FROM users
      WHERE role = 'student' AND current_semester IS NOT NULL
      GROUP BY current_semester ORDER BY current_semester
    `).all();

    res.json({
      stats: {
        totalUsers,
        totalStudents,
        totalEvents,
        totalSubjects,
        totalSubtopics,
        newThisWeek,
        activeThisWeek,
        pendingOnboarding,
        activeAnnouncements,
        bySemester
      }
    });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin System Health & Diagnostic
app.get('/api/admin/health', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const count = async (sql) => (await db.prepare(sql).get()).count;

    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      node_version: process.version,
      memory: process.memoryUsage(),
      database: {
        type: process.env.TURSO_DATABASE_URL ? 'Turso (libSQL)' : 'SQLite local',
        status: 'connected',
        records: {
          users: await count('SELECT count(*) as count FROM users'),
          grades: await count('SELECT count(*) as count FROM grades'),
          events: await count('SELECT count(*) as count FROM events'),
          completed_subtopics: await count('SELECT count(*) as count FROM checklist_progress WHERE completed = 1'),
        }
      }
    });
  } catch (err) {
    sendError(res, err);
  }
});

// ------------------------------------------
// Avisos gerais
// ------------------------------------------

const ANNOUNCEMENT_LEVELS = ['info', 'warning', 'urgent'];

// Avisos ativos que o aluno deve ver
app.get('/api/announcements', authenticateToken, async (req, res) => {
  try {
    const announcements = await db.prepare(`
      SELECT id, title, message, level, expires_at, created_at FROM announcements
      WHERE active = 1 AND (expires_at IS NULL OR expires_at >= ?)
      ORDER BY created_at DESC, id DESC
    `).all(todayInBrazil());
    res.json({ announcements });
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/admin/announcements', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const announcements = await db.prepare('SELECT * FROM announcements ORDER BY created_at DESC, id DESC').all();
    res.json({ announcements });
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/admin/announcements', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const title = v.text(body.title, 'Título', { max: 120 });
    const message = v.text(body.message, 'Mensagem', { max: 1000 });
    const lvl = v.oneOf(body.level, ANNOUNCEMENT_LEVELS, 'Importância', 'info');
    const expires = v.date(body.expires_at, 'Data para o aviso sumir', { required: false });

    const result = await db.prepare(`
      INSERT INTO announcements (title, message, level, expires_at, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(title, message, lvl, expires, req.user.id);

    const created = await db.prepare('SELECT * FROM announcements WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Aviso publicado!', announcement: created });
  } catch (err) {
    sendError(res, err);
  }
});

app.put('/api/admin/announcements/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Aviso não encontrado.' });

    const body = req.body || {};
    const title = body.title !== undefined ? v.text(body.title, 'Título', { max: 120 }) : existing.title;
    const message = body.message !== undefined ? v.text(body.message, 'Mensagem', { max: 1000 }) : existing.message;
    const level = v.oneOf(body.level, ANNOUNCEMENT_LEVELS, 'Importância', existing.level);
    const expires = body.expires_at !== undefined
      ? v.date(body.expires_at, 'Data para o aviso sumir', { required: false })
      : existing.expires_at;

    await db.prepare(`
      UPDATE announcements
      SET title = ?, message = ?, level = ?, active = ?, expires_at = ?
      WHERE id = ?
    `).run(title, message, level, body.active !== undefined ? (body.active ? 1 : 0) : existing.active, expires, id);

    const updated = await db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
    res.json({ message: 'Aviso atualizado!', announcement: updated });
  } catch (err) {
    sendError(res, err);
  }
});

app.delete('/api/admin/announcements/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.prepare('DELETE FROM announcements WHERE id = ?').run(parseInt(req.params.id, 10));
    res.json({ message: 'Aviso removido.' });
  } catch (err) {
    sendError(res, err);
  }
});

// ------------------------------------------
// Eventos da turma (valem para todos os alunos; não mexem nos eventos criados por eles)
// ------------------------------------------

const EVENT_TYPES = ['Prova', 'Seminário', 'Fórum', 'Apresentação', 'Recuperação', 'TBL', 'Trabalho', 'Outro'];

// Valida um evento. Em atualização (partial), campos ausentes ficam com o valor atual.
function parseEvent(body, existing) {
  const b = body || {};
  const keep = (field) => existing && b[field] === undefined;
  const title = keep('title') ? existing.title : v.text(b.title, 'Título', { max: 200 });
  const subject = keep('module_or_subject') ? existing.module_or_subject : v.text(b.module_or_subject, 'Matéria', { max: 200 });
  const start = keep('start_date') ? existing.start_date : v.date(b.start_date, 'Data');
  const end = keep('end_date') ? existing.end_date : v.date(b.end_date, 'Data final', { required: false });
  if (end && end < start) throw new v.ValidationError('A data final não pode ser antes da data inicial.');
  const type = keep('type') ? existing.type : v.oneOf(b.type, EVENT_TYPES, 'Tipo de evento', 'Prova');
  const topics = keep('topics') ? existing.topics : JSON.stringify(v.topicList(b.topics));
  return { title, subject, start, end, type, topics };
}

app.get('/api/admin/events', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const events = await db.prepare('SELECT * FROM events WHERE user_id IS NULL ORDER BY start_date ASC').all();
    res.json({ events: events.map(e => ({ ...e, topics: JSON.parse(e.topics || '[]') })) });
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/admin/events', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const ev = parseEvent(req.body);
    const result = await db.prepare(`
      INSERT INTO events (user_id, title, module_or_subject, start_date, end_date, type, topics, is_custom)
      VALUES (NULL, ?, ?, ?, ?, ?, ?, 0)
    `).run(ev.title, ev.subject, ev.start, ev.end, ev.type, ev.topics);

    const created = await db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
    created.topics = JSON.parse(created.topics);
    res.status(201).json({ message: 'Evento da turma criado para todos os alunos.', event: created });
  } catch (err) {
    sendError(res, err);
  }
});

app.put('/api/admin/events/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await db.prepare('SELECT * FROM events WHERE id = ? AND user_id IS NULL').get(id);
    if (!existing) return res.status(404).json({ error: 'Evento da turma não encontrado.' });

    const ev = parseEvent(req.body, existing);
    await db.prepare(`
      UPDATE events
      SET title = ?, module_or_subject = ?, start_date = ?, end_date = ?, type = ?, topics = ?
      WHERE id = ?
    `).run(ev.title, ev.subject, ev.start, ev.end, ev.type, ev.topics, id);

    const updated = await db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    updated.topics = JSON.parse(updated.topics);
    res.json({ message: 'Evento atualizado para todos os alunos.', event: updated });
  } catch (err) {
    sendError(res, err);
  }
});

app.delete('/api/admin/events/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.prepare('DELETE FROM events WHERE id = ? AND user_id IS NULL').run(parseInt(req.params.id, 10));
    if (!result.changes) return res.status(404).json({ error: 'Evento da turma não encontrado.' });
    res.json({ message: 'Evento removido para todos os alunos.' });
  } catch (err) {
    sendError(res, err);
  }
});

// ==========================================
// 3. ABA 1: AGENDA SEMANAL (CLASSES)
// ==========================================

// Get weekly schedule
const CLASS_TYPES = ['Teórica', 'Prática', 'TBL', 'Seminário', 'Laboratório'];

function parseClass(body) {
  const b = body || {};
  const day = v.integer(b.day_of_week, 'Dia da semana', { min: 1, max: 6 });
  const start = v.time(b.start_time, 'Horário de início');
  const end = v.time(b.end_time, 'Horário de término');
  if (end <= start) throw new v.ValidationError('O horário de término precisa ser depois do início.');
  return {
    day, start, end,
    subject: v.text(b.subject_name, 'Matéria', { max: 120 }),
    room: v.text(b.room, 'Sala', { max: 200, required: false }) || '',
    teacher: v.text(b.teacher, 'Professor', { max: 120, required: false }) || '',
    type: v.oneOf(b.type, CLASS_TYPES, 'Tipo de aula', 'Teórica'),
    color: v.text(b.color, 'Cor', { max: 30, required: false }) || 'teal',
  };
}

// Grade = aulas padrão da turma (menos as que o aluno escondeu) + aulas próprias do aluno
app.get('/api/classes', authenticateToken, async (req, res) => {
  try {
    const classes = await db.prepare(`
      SELECT c.* FROM classes c
      WHERE c.user_id = ?
         OR (c.user_id IS NULL AND NOT EXISTS (
              SELECT 1 FROM hidden_classes h WHERE h.user_id = ? AND h.class_id = c.id))
      ORDER BY c.day_of_week, c.start_time
    `).all(req.user.id, req.user.id);
    res.json({ classes });
  } catch (err) {
    sendError(res, err);
  }
});

// Create new class
app.post('/api/classes', authenticateToken, async (req, res) => {
  try {
    const c = parseClass(req.body);
    const result = await db.prepare(`
      INSERT INTO classes (user_id, day_of_week, start_time, end_time, subject_name, room, teacher, type, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, c.day, c.start, c.end, c.subject, c.room, c.teacher, c.type, c.color);

    const created = await db.prepare('SELECT * FROM classes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Aula adicionada com sucesso!', classItem: created });
  } catch (err) {
    sendError(res, err);
  }
});

// Update class. Aula padrão editada por aluno vira uma cópia só dele (a original fica escondida para ele).
app.put('/api/classes/:id', authenticateToken, async (req, res) => {
  try {
    const classId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const existing = await db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
    if (!existing) {
      return res.status(404).json({ error: 'Aula não encontrada.' });
    }
    const isAdmin = req.user.role === 'admin';
    const isTemplate = existing.user_id === null;
    if (!isTemplate && existing.user_id !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para alterar esta aula.' });
    }

    const c = parseClass(req.body);

    if (isTemplate && !isAdmin) {
      const created = await db.transaction(async (tx) => {
        const r = await tx.prepare(`
          INSERT INTO classes (user_id, day_of_week, start_time, end_time, subject_name, room, teacher, type, color)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(userId, c.day, c.start, c.end, c.subject, c.room, c.teacher, c.type, c.color);
        await tx.prepare('INSERT OR IGNORE INTO hidden_classes (user_id, class_id) VALUES (?, ?)').run(userId, classId);
        return tx.prepare('SELECT * FROM classes WHERE id = ?').get(r.lastInsertRowid);
      });
      return res.json({ message: 'Aula ajustada só na sua grade.', classItem: created, replacedId: classId });
    }

    await db.prepare(`
      UPDATE classes
      SET day_of_week = ?, start_time = ?, end_time = ?, subject_name = ?, room = ?, teacher = ?, type = ?, color = ?
      WHERE id = ?
    `).run(c.day, c.start, c.end, c.subject, c.room, c.teacher, c.type, c.color, classId);

    const updated = await db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
    res.json({ message: 'Aula atualizada!', classItem: updated });
  } catch (err) {
    sendError(res, err);
  }
});

// Delete class. Aula padrão "excluída" por aluno só é escondida da grade dele.
app.delete('/api/classes/:id', authenticateToken, async (req, res) => {
  try {
    const classId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const existing = await db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
    if (!existing) {
      return res.status(404).json({ error: 'Aula não encontrada.' });
    }
    const isAdmin = req.user.role === 'admin';

    if (existing.user_id === null && !isAdmin) {
      await db.prepare('INSERT OR IGNORE INTO hidden_classes (user_id, class_id) VALUES (?, ?)').run(userId, classId);
      return res.json({ message: 'Aula removida da sua grade.', hidden: true });
    }
    if (existing.user_id !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para excluir esta aula.' });
    }

    await db.prepare('DELETE FROM classes WHERE id = ?').run(classId);
    res.json({ message: 'Aula removida.' });
  } catch (err) {
    sendError(res, err);
  }
});

// ==========================================
// 4. ABA 2: EVENTOS IMPORTANTES (PROVAS & PRAZOS)
// ==========================================

// Get all events
app.get('/api/events', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Query events where user_id IS NULL OR user_id = userId
    const events = await db.prepare(`
      SELECT * FROM events
      WHERE user_id IS NULL OR user_id = ?
      ORDER BY start_date ASC
    `).all(userId);

    const parsedEvents = events.map(e => ({
      ...e,
      topics: JSON.parse(e.topics || '[]')
    }));

    res.json({ events: parsedEvents });
  } catch (err) {
    sendError(res, err);
  }
});

// Add new event (Student or Admin)
app.post('/api/events', authenticateToken, async (req, res) => {
  try {
    const ev = parseEvent(req.body);
    const result = await db.prepare(`
      INSERT INTO events (user_id, title, module_or_subject, start_date, end_date, type, topics, is_custom)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(req.user.id, ev.title, ev.subject, ev.start, ev.end, ev.type, ev.topics);

    const created = await db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
    created.topics = JSON.parse(created.topics);
    res.status(201).json({ message: 'Evento criado com sucesso!', event: created });
  } catch (err) {
    sendError(res, err);
  }
});

// Edit event (o aluno só altera os eventos que ele mesmo criou; os da turma são do admin)
app.put('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id, 10);
    const existing = await db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!existing) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }

    const isOwner = existing.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para alterar este evento.' });
    }

    const ev = parseEvent(req.body, existing);
    await db.prepare(`
      UPDATE events
      SET title = ?, module_or_subject = ?, start_date = ?, end_date = ?, type = ?, topics = ?
      WHERE id = ?
    `).run(ev.title, ev.subject, ev.start, ev.end, ev.type, ev.topics, eventId);

    const updated = await db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    updated.topics = JSON.parse(updated.topics);
    res.json({ message: 'Evento e data atualizados!', event: updated });
  } catch (err) {
    sendError(res, err);
  }
});

// Delete event
app.delete('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const userId = req.user.id;

    const existing = await db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!existing) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }

    const isOwner = existing.user_id === userId;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para excluir este evento.' });
    }

    await db.prepare('DELETE FROM events WHERE id = ?').run(eventId);
    res.json({ message: 'Evento excluído com sucesso.' });
  } catch (err) {
    sendError(res, err);
  }
});

// ==========================================
// 5. ABA 3: CÁLCULO DE NOTAS (UFG RULES)
// ==========================================

// Get user grades
app.get('/api/grades', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const grades = await db.prepare('SELECT * FROM grades WHERE user_id = ?').all(userId);
    res.json({ grades });
  } catch (err) {
    sendError(res, err);
  }
});

// Save or batch update grades
app.post('/api/grades/batch', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { gradesList } = req.body || {};

    if (!Array.isArray(gradesList)) {
      return res.status(400).json({ error: 'gradesList deve ser uma lista de notas.' });
    }
    if (gradesList.length > 300) {
      return res.status(400).json({ error: 'Lista de notas grande demais.' });
    }

    // Valida tudo antes de gravar: ou salva a lista inteira, ou nada
    const items = gradesList.map((item) => {
      const it = item || {};
      const raw = it.score;
      let score = null;
      if (raw !== undefined && raw !== null && raw !== '') {
        score = typeof raw === 'number' ? raw : parseFloat(raw);
        if (!Number.isFinite(score) || score < 0 || score > 10) {
          throw new v.ValidationError(`Nota inválida em ${String(it.item_key || 'um dos campos')}: use valores de 0 a 10.`);
        }
      }
      const weight = it.weight === undefined || it.weight === null ? 1.0 : Number(it.weight);
      if (!Number.isFinite(weight) || weight < 0 || weight > 100) throw new v.ValidationError('Peso inválido.');
      return {
        module: v.text(it.module, 'Módulo da nota', { max: 50 }),
        discipline: v.text(it.discipline, 'Disciplina', { max: 80, required: false }),
        item_key: v.text(it.item_key, 'Identificador da nota', { max: 80 }),
        item_name: v.text(it.item_name, 'Nome da nota', { max: 120, required: false }) || it.item_key,
        score,
        weight,
      };
    });

    await db.transaction(async (tx) => {
      const upsert = tx.prepare(`
        INSERT INTO grades (user_id, module, discipline, item_key, item_name, score, weight)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, module, item_key) DO UPDATE SET
          score = excluded.score,
          weight = excluded.weight,
          item_name = excluded.item_name
      `);
      for (const it of items) {
        await upsert.run(userId, it.module, it.discipline, it.item_key, it.item_name, it.score, it.weight);
      }
    });

    const allGrades = await db.prepare('SELECT * FROM grades WHERE user_id = ?').all(userId);
    res.json({ message: 'Notas salvas com sucesso!', grades: allGrades });
  } catch (err) {
    sendError(res, err);
  }
});

// ==========================================
// 6. ABA 4: MATÉRIAS DO SEMESTRE & CHECKLIST
// ==========================================

// Get all subjects with their full hierarchy (Topics -> Subtopics -> User Progress)
app.get('/api/subjects', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Subjects: available to user (user_id IS NULL OR user_id = userId)
    const subjects = await db.prepare(`
      SELECT * FROM subjects
      WHERE user_id IS NULL OR user_id = ?
      ORDER BY order_index ASC, id ASC
    `).all(userId);

    // Topics for these subjects
    const topics = await db.prepare(`
      SELECT t.* FROM topics t
      JOIN subjects s ON s.id = t.subject_id
      WHERE s.user_id IS NULL OR s.user_id = ?
      ORDER BY t.order_index ASC, t.id ASC
    `).all(userId);

    // Subtopics
    const subtopics = await db.prepare(`
      SELECT st.* FROM subtopics st
      JOIN topics t ON t.id = st.topic_id
      JOIN subjects s ON s.id = t.subject_id
      WHERE s.user_id IS NULL OR s.user_id = ?
      ORDER BY st.order_index ASC, st.id ASC
    `).all(userId);

    // User checklist progress
    const progressList = await db.prepare(`
      SELECT subtopic_id, completed FROM checklist_progress WHERE user_id = ?
    `).all(userId);

    const progressMap = {};
    progressList.forEach(p => {
      progressMap[p.subtopic_id] = p.completed === 1;
    });

    // Nest hierarchical tree
    const subtopicByTopic = {};
    subtopics.forEach(st => {
      if (!subtopicByTopic[st.topic_id]) subtopicByTopic[st.topic_id] = [];
      subtopicByTopic[st.topic_id].push({
        ...st,
        completed: Boolean(progressMap[st.id])
      });
    });

    const topicBySubject = {};
    topics.forEach(t => {
      if (!topicBySubject[t.subject_id]) topicBySubject[t.subject_id] = [];
      topicBySubject[t.subject_id].push({
        ...t,
        subtopics: subtopicByTopic[t.id] || []
      });
    });

    const fullTree = subjects.map(s => {
      const subjectTopics = topicBySubject[s.id] || [];
      let totalSubtopics = 0;
      let completedSubtopics = 0;

      subjectTopics.forEach(t => {
        t.subtopics.forEach(st => {
          totalSubtopics++;
          if (st.completed) completedSubtopics++;
        });
      });

      const percentage = totalSubtopics > 0 ? Math.round((completedSubtopics / totalSubtopics) * 100) : 0;

      return {
        ...s,
        topics: subjectTopics,
        totalSubtopics,
        completedSubtopics,
        percentage
      };
    });

    res.json({ subjects: fullTree });
  } catch (err) {
    console.error('Error fetching subjects tree:', err);
    sendError(res, err);
  }
});

// Matéria, assunto ou subassunto: só o dono da matéria (ou o admin) altera.
// Matérias oficiais (user_id nulo) são da turma toda e só o admin mexe nelas.
const canManage = (req, ownerId) => req.user.role === 'admin' || (ownerId !== null && ownerId === req.user.id);

async function subjectOf(subjectId) {
  return db.prepare('SELECT * FROM subjects WHERE id = ?').get(subjectId);
}
async function topicWithOwner(topicId) {
  return db.prepare(`
    SELECT t.*, s.user_id FROM topics t
    JOIN subjects s ON s.id = t.subject_id
    WHERE t.id = ?
  `).get(topicId);
}
async function subtopicWithOwner(subtopicId) {
  return db.prepare(`
    SELECT st.*, s.user_id FROM subtopics st
    JOIN topics t ON t.id = st.topic_id
    JOIN subjects s ON s.id = t.subject_id
    WHERE st.id = ?
  `).get(subtopicId);
}

// Toggle checklist item (o aluno marca o próprio progresso em qualquer subassunto que ele enxerga)
app.post('/api/checklist/toggle', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { subtopic_id, completed } = req.body || {};
    const subtopicId = v.integer(subtopic_id, 'Subassunto', { min: 1, max: Number.MAX_SAFE_INTEGER });

    const st = await subtopicWithOwner(subtopicId);
    if (!st || (st.user_id !== null && st.user_id !== userId)) {
      return res.status(404).json({ error: 'Subassunto não encontrado.' });
    }

    const isCompleted = completed ? 1 : 0;
    const now = isCompleted ? new Date().toISOString() : null;

    await db.prepare(`
      INSERT INTO checklist_progress (user_id, subtopic_id, completed, completed_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, subtopic_id) DO UPDATE SET
        completed = excluded.completed,
        completed_at = excluded.completed_at
    `).run(userId, subtopicId, isCompleted, now);

    res.json({ message: 'Progresso atualizado!', subtopic_id: subtopicId, completed: Boolean(isCompleted) });
  } catch (err) {
    sendError(res, err);
  }
});

function parseSubject(body, existing) {
  const b = body || {};
  const keep = (f) => existing && (b[f] === undefined || b[f] === null || b[f] === '');
  return {
    name: keep('name') ? existing.name : v.text(b.name, 'Nome da matéria', { max: 150 }),
    code: keep('code') ? existing.code : (v.text(b.code, 'Código', { max: 30, required: false }) || ''),
    color: keep('color') ? existing.color : (v.text(b.color, 'Cor', { max: 30, required: false }) || 'teal'),
    icon: keep('icon') ? existing.icon : (v.text(b.icon, 'Ícone', { max: 40, required: false }) || 'BookOpen'),
    description: keep('description') ? existing.description : (v.text(b.description, 'Descrição', { max: 500, required: false }) || ''),
  };
}

// Create new Subject (Student Autonomy)
app.post('/api/subjects', authenticateToken, async (req, res) => {
  try {
    const sub = parseSubject(req.body);
    const result = await db.prepare(`
      INSERT INTO subjects (user_id, name, code, color, icon, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user.id, sub.name, sub.code, sub.color, sub.icon, sub.description);

    const created = await subjectOf(result.lastInsertRowid);
    res.status(201).json({ message: 'Matéria adicionada com sucesso!', subject: created });
  } catch (err) {
    sendError(res, err);
  }
});

// Update Subject
app.put('/api/subjects/:id', authenticateToken, async (req, res) => {
  try {
    const subjectId = parseInt(req.params.id, 10);
    const existing = await subjectOf(subjectId);
    if (!existing) return res.status(404).json({ error: 'Matéria não encontrada.' });
    if (!canManage(req, existing.user_id)) {
      return res.status(403).json({ error: 'Sem permissão para alterar esta matéria.' });
    }

    const sub = parseSubject(req.body, existing);
    await db.prepare(`
      UPDATE subjects SET name = ?, code = ?, color = ?, icon = ?, description = ? WHERE id = ?
    `).run(sub.name, sub.code, sub.color, sub.icon, sub.description, subjectId);

    const updated = await subjectOf(subjectId);
    res.json({ message: 'Matéria atualizada!', subject: updated });
  } catch (err) {
    sendError(res, err);
  }
});

// Delete Subject
app.delete('/api/subjects/:id', authenticateToken, async (req, res) => {
  try {
    const subjectId = parseInt(req.params.id, 10);
    const existing = await subjectOf(subjectId);
    if (!existing) return res.status(404).json({ error: 'Matéria não encontrada.' });
    if (!canManage(req, existing.user_id)) {
      return res.status(403).json({ error: 'Sem permissão para excluir esta matéria.' });
    }

    await db.prepare('DELETE FROM subjects WHERE id = ?').run(subjectId);
    res.json({ message: 'Matéria removida com sucesso.' });
  } catch (err) {
    sendError(res, err);
  }
});

// Add Topic
app.post('/api/subjects/:id/topics', authenticateToken, async (req, res) => {
  try {
    const subjectId = parseInt(req.params.id, 10);
    const subject = await subjectOf(subjectId);
    if (!subject) return res.status(404).json({ error: 'Matéria não encontrada.' });
    if (!canManage(req, subject.user_id)) {
      return res.status(403).json({ error: 'Sem permissão para adicionar assunto nesta matéria.' });
    }
    const name = v.text((req.body || {}).name, 'Nome do assunto', { max: 150 });

    const result = await db.prepare('INSERT INTO topics (subject_id, name) VALUES (?, ?)').run(subjectId, name);
    const created = await db.prepare('SELECT * FROM topics WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Assunto adicionado!', topic: created });
  } catch (err) {
    sendError(res, err);
  }
});

// Update Topic
app.put('/api/topics/:id', authenticateToken, async (req, res) => {
  try {
    const topicId = parseInt(req.params.id, 10);
    const topic = await topicWithOwner(topicId);
    if (!topic) return res.status(404).json({ error: 'Assunto não encontrado.' });
    if (!canManage(req, topic.user_id)) {
      return res.status(403).json({ error: 'Sem permissão para alterar este assunto.' });
    }
    const name = v.text((req.body || {}).name, 'Nome do assunto', { max: 150 });

    await db.prepare('UPDATE topics SET name = ? WHERE id = ?').run(name, topicId);
    const updated = await db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId);
    res.json({ message: 'Assunto atualizado!', topic: updated });
  } catch (err) {
    sendError(res, err);
  }
});

// Delete Topic
app.delete('/api/topics/:id', authenticateToken, async (req, res) => {
  try {
    const topicId = parseInt(req.params.id, 10);
    const topic = await topicWithOwner(topicId);
    if (!topic) return res.status(404).json({ error: 'Assunto não encontrado.' });
    if (!canManage(req, topic.user_id)) {
      return res.status(403).json({ error: 'Sem permissão para excluir este assunto.' });
    }

    await db.prepare('DELETE FROM topics WHERE id = ?').run(topicId);
    res.json({ message: 'Assunto removido!' });
  } catch (err) {
    sendError(res, err);
  }
});

// Add Subtopic
app.post('/api/topics/:id/subtopics', authenticateToken, async (req, res) => {
  try {
    const topicId = parseInt(req.params.id, 10);
    const topic = await topicWithOwner(topicId);
    if (!topic) return res.status(404).json({ error: 'Assunto não encontrado.' });
    if (!canManage(req, topic.user_id)) {
      return res.status(403).json({ error: 'Sem permissão para adicionar subassunto neste assunto.' });
    }
    const name = v.text((req.body || {}).name, 'Nome do subassunto', { max: 200 });

    const result = await db.prepare('INSERT INTO subtopics (topic_id, name) VALUES (?, ?)').run(topicId, name);
    const created = await db.prepare('SELECT * FROM subtopics WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Subassunto adicionado!', subtopic: created });
  } catch (err) {
    sendError(res, err);
  }
});

// Update Subtopic
app.put('/api/subtopics/:id', authenticateToken, async (req, res) => {
  try {
    const subtopicId = parseInt(req.params.id, 10);
    const subtopic = await subtopicWithOwner(subtopicId);
    if (!subtopic) return res.status(404).json({ error: 'Subassunto não encontrado.' });
    if (!canManage(req, subtopic.user_id)) {
      return res.status(403).json({ error: 'Sem permissão para alterar este subassunto.' });
    }
    const name = v.text((req.body || {}).name, 'Nome do subassunto', { max: 200 });

    await db.prepare('UPDATE subtopics SET name = ? WHERE id = ?').run(name, subtopicId);
    const updated = await db.prepare('SELECT * FROM subtopics WHERE id = ?').get(subtopicId);
    res.json({ message: 'Subassunto atualizado!', subtopic: updated });
  } catch (err) {
    sendError(res, err);
  }
});

// Delete Subtopic
app.delete('/api/subtopics/:id', authenticateToken, async (req, res) => {
  try {
    const subtopicId = parseInt(req.params.id, 10);
    const subtopic = await subtopicWithOwner(subtopicId);
    if (!subtopic) return res.status(404).json({ error: 'Subassunto não encontrado.' });
    if (!canManage(req, subtopic.user_id)) {
      return res.status(403).json({ error: 'Sem permissão para excluir este subassunto.' });
    }

    await db.prepare('DELETE FROM subtopics WHERE id = ?').run(subtopicId);
    res.json({ message: 'Subassunto removido!' });
  } catch (err) {
    sendError(res, err);
  }
});

// Serve static client bundle if it exists (for single-command production deploy)
const clientDistPath = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') ) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
}

// Tratador de erros final (JSON malformado, corpo grande demais, upload inválido, erros inesperados)
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Dados enviados em formato inválido.' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Dados enviados grandes demais.' });
  }
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'A foto pode ter no máximo 1 MB.' : 'Erro no envio da foto.';
    return res.status(400).json({ error: msg });
  }
  if (err && /Apenas imagens/.test(err.message || '')) {
    return res.status(400).json({ error: err.message });
  }
  sendError(res, err);
});

// Start Server (only if not running inside a Vercel serverless environment or automated test)
if (!process.env.VERCEL && !process.env.DISABLE_SERVER_LISTEN) {
  app.listen(PORT, () => {
    console.log(`Med Planner Backend rodando com sucesso na porta ${PORT}`);
  });
}

module.exports = app;



