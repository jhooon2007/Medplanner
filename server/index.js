const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
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
app.use(cors());
app.use(express.json());

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

async function savePhoto(userId, file) {
  await db.prepare(`
    INSERT INTO user_photos (user_id, mime, data) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET mime = excluded.mime, data = excluded.data
  `).run(userId, file.mimetype, file.buffer.toString('base64'));
  const photoUrl = `/api/users/${userId}/photo?v=${Date.now()}`;
  await db.prepare('UPDATE users SET photo_url = ? WHERE id = ?').run(photoUrl, userId);
  return photoUrl;
}

function issueToken(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
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
      ? await db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(decoded.id)
      : undefined;
    if (!user) {
      return res.status(401).json({ error: 'Conta não encontrada. Faça login novamente.' });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
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

// Foto de perfil (pública: usada em <img>, que não envia o cabeçalho Authorization)
app.get('/api/users/:id/photo', async (req, res) => {
  try {
    const photo = await db.prepare('SELECT mime, data FROM user_photos WHERE user_id = ?').get(parseInt(req.params.id, 10));
    if (!photo) return res.status(404).end();
    res.set('Content-Type', photo.mime);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(photo.data, 'base64'));
  } catch (err) {
    res.status(500).end();
  }
});

// Register
app.post('/api/auth/register', upload.single('photo'), async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }

    const result = await db.prepare(`
      INSERT INTO users (name, email, password, phone, role, last_login_at)
      VALUES (?, ?, ?, ?, 'student', CURRENT_TIMESTAMP)
    `).run(name.trim(), normalizedEmail, bcrypt.hashSync(password, 10), phone || null);

    if (req.file) {
      await savePhoto(result.lastInsertRowid, req.file);
    }

    const user = await db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(result.lastInsertRowid);

    res.status(201).json({
      message: 'Usuário cadastrado com sucesso!',
      token: issueToken(user),
      user
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erro ao cadastrar usuário: ' + err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
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
      token: issueToken(user),
      user
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro ao autenticar: ' + err.message });
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
    const { credential, access_token } = req.body;
    if (!credential && !access_token) {
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
      const randomPassword = bcrypt.hashSync(Math.random().toString(36) + Date.now(), 10);
      const result = await db.prepare(`
        INSERT INTO users (name, email, password, photo_url, role)
        VALUES (?, ?, ?, ?, 'student')
      `).run(google.name || google.email.split('@')[0], google.email, randomPassword, google.picture || null);
      row = { id: result.lastInsertRowid };
    } else if (google.picture && !row.photo_url) {
      await db.prepare('UPDATE users SET photo_url = ? WHERE id = ?').run(google.picture, row.id);
    }

    await db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
    const user = await db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(row.id);

    res.json({
      message: 'Autenticado via Google com sucesso!',
      token: issueToken(user),
      user
    });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Erro no login com Google: ' + err.message });
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
    res.status(500).json({ error: err.message });
  }
});

// Onboarding Submission (Mandatory questionnaire after account creation)
async function handleOnboarding(req, res) {
  try {
    const { name, phone, birth_date, current_semester } = req.body;

    if (!birth_date || !current_semester) {
      return res.status(400).json({ error: 'Data de nascimento e período acadêmico são obrigatórios.' });
    }

    const semesterNum = parseInt(current_semester, 10);
    if (isNaN(semesterNum) || semesterNum < 1 || semesterNum > 12) {
      return res.status(400).json({ error: 'Período acadêmico inválido. Escolha entre o 1º e o 12º semestre.' });
    }

    let query = 'UPDATE users SET birth_date = ?, current_semester = ?, onboarding_completed = 1';
    const params = [birth_date.trim(), semesterNum];

    if (name && name.trim()) {
      query += ', name = ?';
      params.push(name.trim());
    }
    if (phone && phone.trim()) {
      query += ', phone = ?';
      params.push(phone.trim());
    }

    query += ' WHERE id = ?';
    params.push(req.user.id);

    await db.prepare(query).run(...params);

    const user = await db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(req.user.id);

    res.json({
      message: 'Questionário de onboarding concluído com sucesso!',
      user,
      token: issueToken(user)
    });
  } catch (err) {
    console.error('Onboarding error:', err);
    res.status(500).json({ error: 'Erro ao registrar respostas do onboarding: ' + err.message });
  }
}
app.post('/api/auth/onboarding', authenticateToken, handleOnboarding);
app.put('/api/auth/onboarding', authenticateToken, handleOnboarding);

// Update profile (photo, phone, name)
app.put('/api/auth/profile', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { name, phone, password, birth_date, current_semester } = req.body;
    const userId = req.user.id;

    let query = 'UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone)';
    const params = [name || null, phone || null];

    if (birth_date) {
      query += ', birth_date = ?';
      params.push(birth_date.trim());
    }
    if (current_semester) {
      query += ', current_semester = ?';
      params.push(parseInt(current_semester, 10));
    }

    if (password && password.trim().length >= 6) {
      query += ', password = ?';
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
      message: 'Perfil atualizado com sucesso!',
      user,
      token: issueToken(user)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

// Update user by Admin
app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { name, email, phone, role, password, birth_date, current_semester, onboarding_completed } = req.body;

    if (role && !['student', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Perfil inválido.' });
    }
    if (targetId === req.user.id && role && role !== 'admin') {
      return res.status(400).json({ error: 'Você não pode remover seu próprio acesso de administrador.' });
    }

    let query = 'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone), role = COALESCE(?, role)';
    const params = [name || null, email ? email.toLowerCase().trim() : null, phone || null, role || null];

    if (birth_date) {
      query += ', birth_date = ?';
      params.push(birth_date.trim());
    }
    if (current_semester) {
      query += ', current_semester = ?';
      params.push(parseInt(current_semester, 10));
    }
    if (onboarding_completed !== undefined) {
      query += ', onboarding_completed = ?';
      params.push(onboarding_completed ? 1 : 0);
    }

    if (password && password.trim().length >= 6) {
      query += ', password = ?';
      params.push(bcrypt.hashSync(password, 10));
    }

    query += ' WHERE id = ?';
    params.push(targetId);

    await db.prepare(query).run(...params);

    const updated = await db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(targetId);
    res.json({ message: 'Usuário atualizado pelo Administrador.', user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

// Create user by Admin
app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, phone, role, password, birth_date, current_semester } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }
    if (role && !['student', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Perfil inválido.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return res.status(400).json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
    }

    const photoUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`;
    const sem = current_semester ? parseInt(current_semester, 10) : 1;
    const bDate = birth_date ? birth_date.trim() : null;

    const result = await db.prepare(`
      INSERT INTO users (name, email, password, phone, photo_url, role, birth_date, current_semester, onboarding_completed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(name.trim(), normalizedEmail, bcrypt.hashSync(password, 10), phone || null, photoUrl, role || 'student', bDate, sem);

    const newUser = await db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ message: 'Usuário cadastrado com sucesso!', user: newUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/announcements', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const announcements = await db.prepare('SELECT * FROM announcements ORDER BY created_at DESC, id DESC').all();
    res.json({ announcements });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/announcements', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, message, level, expires_at } = req.body;
    if (!title || !title.trim() || !message || !message.trim()) {
      return res.status(400).json({ error: 'Título e mensagem são obrigatórios.' });
    }
    const lvl = ANNOUNCEMENT_LEVELS.includes(level) ? level : 'info';

    const result = await db.prepare(`
      INSERT INTO announcements (title, message, level, expires_at, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(title.trim(), message.trim(), lvl, expires_at || null, req.user.id);

    const created = await db.prepare('SELECT * FROM announcements WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Aviso publicado!', announcement: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/announcements/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Aviso não encontrado.' });

    const { title, message, level, active, expires_at } = req.body;
    await db.prepare(`
      UPDATE announcements
      SET title = ?, message = ?, level = ?, active = ?, expires_at = ?
      WHERE id = ?
    `).run(
      title !== undefined ? String(title).trim() : existing.title,
      message !== undefined ? String(message).trim() : existing.message,
      ANNOUNCEMENT_LEVELS.includes(level) ? level : existing.level,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      expires_at !== undefined ? (expires_at || null) : existing.expires_at,
      id
    );

    const updated = await db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
    res.json({ message: 'Aviso atualizado!', announcement: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/announcements/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.prepare('DELETE FROM announcements WHERE id = ?').run(parseInt(req.params.id, 10));
    res.json({ message: 'Aviso removido.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------
// Eventos da turma (valem para todos os alunos; não mexem nos eventos criados por eles)
// ------------------------------------------

const parseTopics = (topics) => (
  Array.isArray(topics) ? topics : [topics].filter(Boolean)
);

app.get('/api/admin/events', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const events = await db.prepare('SELECT * FROM events WHERE user_id IS NULL ORDER BY start_date ASC').all();
    res.json({ events: events.map(e => ({ ...e, topics: JSON.parse(e.topics || '[]') })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/events', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, module_or_subject, start_date, end_date, type, topics } = req.body;
    if (!title || !start_date || !module_or_subject) {
      return res.status(400).json({ error: 'Título, data e matéria são obrigatórios.' });
    }

    const result = await db.prepare(`
      INSERT INTO events (user_id, title, module_or_subject, start_date, end_date, type, topics, is_custom)
      VALUES (NULL, ?, ?, ?, ?, ?, ?, 0)
    `).run(title.trim(), module_or_subject.trim(), start_date, end_date || null, type || 'Prova', JSON.stringify(parseTopics(topics)));

    const created = await db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
    created.topics = JSON.parse(created.topics);
    res.status(201).json({ message: 'Evento da turma criado para todos os alunos.', event: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/events/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await db.prepare('SELECT * FROM events WHERE id = ? AND user_id IS NULL').get(id);
    if (!existing) return res.status(404).json({ error: 'Evento da turma não encontrado.' });

    const { title, module_or_subject, start_date, end_date, type, topics } = req.body;
    await db.prepare(`
      UPDATE events
      SET title = ?, module_or_subject = ?, start_date = ?, end_date = ?, type = ?, topics = ?
      WHERE id = ?
    `).run(
      title ? title.trim() : existing.title,
      module_or_subject ? module_or_subject.trim() : existing.module_or_subject,
      start_date || existing.start_date,
      end_date !== undefined ? (end_date || null) : existing.end_date,
      type || existing.type,
      topics !== undefined ? JSON.stringify(parseTopics(topics)) : existing.topics,
      id
    );

    const updated = await db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    updated.topics = JSON.parse(updated.topics);
    res.json({ message: 'Evento atualizado para todos os alunos.', event: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/events/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.prepare('DELETE FROM events WHERE id = ? AND user_id IS NULL').run(parseInt(req.params.id, 10));
    if (!result.changes) return res.status(404).json({ error: 'Evento da turma não encontrado.' });
    res.json({ message: 'Evento removido para todos os alunos.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. ABA 1: AGENDA SEMANAL (CLASSES)
// ==========================================

// Get weekly schedule
app.get('/api/classes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // Get user-specific classes OR default template classes if user has none
    const userClasses = await db.prepare('SELECT * FROM classes WHERE user_id = ? ORDER BY day_of_week, start_time').all(userId);

    if (userClasses.length > 0) {
      return res.json({ classes: userClasses });
    }

    // Fallback to default template classes
    const defaultClasses = await db.prepare('SELECT * FROM classes WHERE user_id IS NULL ORDER BY day_of_week, start_time').all();
    res.json({ classes: defaultClasses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new class
app.post('/api/classes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { day_of_week, start_time, end_time, subject_name, room, teacher, type, color } = req.body;

    if (!day_of_week || !start_time || !end_time || !subject_name) {
      return res.status(400).json({ error: 'Dia da semana, horários e nome da matéria são obrigatórios.' });
    }

    const result = await db.prepare(`
      INSERT INTO classes (user_id, day_of_week, start_time, end_time, subject_name, room, teacher, type, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, parseInt(day_of_week), start_time, end_time, subject_name, room || '', teacher || '', type || 'Teórica', color || 'teal');

    const created = await db.prepare('SELECT * FROM classes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Aula adicionada com sucesso!', classItem: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update class
app.put('/api/classes/:id', authenticateToken, async (req, res) => {
  try {
    const classId = parseInt(req.params.id);
    const userId = req.user.id;
    const { day_of_week, start_time, end_time, subject_name, room, teacher, type, color } = req.body;

    // Check if class exists and belongs to user or is default
    const existing = await db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
    if (!existing) {
      return res.status(404).json({ error: 'Aula não encontrada.' });
    }

    const isOwner = existing.user_id === userId;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para alterar esta aula.' });
    }

    await db.prepare(`
      UPDATE classes
      SET day_of_week = ?, start_time = ?, end_time = ?, subject_name = ?, room = ?, teacher = ?, type = ?, color = ?
      WHERE id = ?
    `).run(parseInt(day_of_week), start_time, end_time, subject_name, room || '', teacher || '', type || 'Teórica', color || 'teal', classId);

    const updated = await db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
    res.json({ message: 'Aula atualizada!', classItem: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete class
app.delete('/api/classes/:id', authenticateToken, async (req, res) => {
  try {
    const classId = parseInt(req.params.id);
    const userId = req.user.id;

    const existing = await db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
    if (!existing) {
      return res.status(404).json({ error: 'Aula não encontrada.' });
    }

    const isOwner = existing.user_id === userId;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para deletar esta aula.' });
    }

    await db.prepare('DELETE FROM classes WHERE id = ?').run(classId);
    res.json({ message: 'Aula removida.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

// Add new event (Student or Admin)
app.post('/api/events', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, module_or_subject, start_date, end_date, type, topics } = req.body;

    if (!title || !start_date || !module_or_subject) {
      return res.status(400).json({ error: 'Título, data e matéria são obrigatórios.' });
    }

    const topicsJson = Array.isArray(topics) ? JSON.stringify(topics) : JSON.stringify([topics].filter(Boolean));

    const result = await db.prepare(`
      INSERT INTO events (user_id, title, module_or_subject, start_date, end_date, type, topics, is_custom)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(userId, title, module_or_subject, start_date, end_date || null, type || 'Prova', topicsJson);

    const created = await db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
    created.topics = JSON.parse(created.topics);

    res.status(201).json({ message: 'Evento criado com sucesso!', event: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit event date & details (Autonomous student editing for calendar changes / strikes)
app.put('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const userId = req.user.id;
    const { title, module_or_subject, start_date, end_date, type, topics } = req.body;

    const existing = await db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!existing) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }

    const isOwner = existing.user_id === userId;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para alterar este evento.' });
    }

    const topicsJson = Array.isArray(topics) ? JSON.stringify(topics) : JSON.stringify([topics].filter(Boolean));

    // Update in place
    await db.prepare(`
      UPDATE events
      SET title = COALESCE(?, title),
          module_or_subject = COALESCE(?, module_or_subject),
          start_date = COALESCE(?, start_date),
          end_date = ?,
          type = COALESCE(?, type),
          topics = COALESCE(?, topics)
      WHERE id = ?
    `).run(title || null, module_or_subject || null, start_date || null, end_date !== undefined ? end_date : existing.end_date, type || null, topicsJson, eventId);

    const updated = await db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    updated.topics = JSON.parse(updated.topics);

    res.json({ message: 'Evento e data atualizados!', event: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

// Save or batch update grades
app.post('/api/grades/batch', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { gradesList } = req.body; // Array of { module, discipline, item_key, item_name, score, weight }

    if (!Array.isArray(gradesList)) {
      return res.status(400).json({ error: 'gradesList deve ser uma lista de notas.' });
    }

    await db.transaction(async (tx) => {
      const upsert = tx.prepare(`
        INSERT INTO grades (user_id, module, discipline, item_key, item_name, score, weight)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, module, item_key) DO UPDATE SET
          score = excluded.score,
          weight = excluded.weight,
          item_name = excluded.item_name
      `);

      for (const item of gradesList) {
        const score = item.score !== undefined && item.score !== null && item.score !== '' ? parseFloat(item.score) : null;
        await upsert.run(
          userId,
          item.module,
          item.discipline || null,
          item.item_key,
          item.item_name,
          Number.isNaN(score) ? null : score,
          item.weight || 1.0
        );
      }
    });

    const allGrades = await db.prepare('SELECT * FROM grades WHERE user_id = ?').all(userId);
    res.json({ message: 'Notas salvas com sucesso!', grades: allGrades });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

// Toggle checklist item
app.post('/api/checklist/toggle', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { subtopic_id, completed } = req.body;

    if (!subtopic_id) {
      return res.status(400).json({ error: 'subtopic_id é obrigatório.' });
    }

    const isCompleted = completed ? 1 : 0;
    const now = isCompleted ? new Date().toISOString() : null;

    await db.prepare(`
      INSERT INTO checklist_progress (user_id, subtopic_id, completed, completed_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, subtopic_id) DO UPDATE SET
        completed = excluded.completed,
        completed_at = excluded.completed_at
    `).run(userId, subtopic_id, isCompleted, now);

    res.json({ message: 'Progresso atualizado!', subtopic_id, completed: Boolean(isCompleted) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new Subject (Student Autonomy)
app.post('/api/subjects', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, code, color, icon, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome da matéria é obrigatório.' });
    }

    const result = await db.prepare(`
      INSERT INTO subjects (user_id, name, code, color, icon, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, name, code || '', color || 'teal', icon || 'BookOpen', description || '');

    const created = await db.prepare('SELECT * FROM subjects WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Matéria adicionada com sucesso!', subject: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Subject
app.put('/api/subjects/:id', authenticateToken, async (req, res) => {
  try {
    const subjectId = parseInt(req.params.id);
    const { name, code, color, icon, description } = req.body;

    const existing = await db.prepare('SELECT * FROM subjects WHERE id = ?').get(subjectId);
    if (!existing) return res.status(404).json({ error: 'Matéria não encontrada.' });

    const isOwner = existing.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para alterar esta matéria.' });
    }

    await db.prepare(`
      UPDATE subjects
      SET name = COALESCE(?, name),
          code = COALESCE(?, code),
          color = COALESCE(?, color),
          icon = COALESCE(?, icon),
          description = COALESCE(?, description)
      WHERE id = ?
    `).run(name || null, code || null, color || null, icon || null, description || null, subjectId);

    const updated = await db.prepare('SELECT * FROM subjects WHERE id = ?').get(subjectId);
    res.json({ message: 'Matéria atualizada!', subject: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Subject
app.delete('/api/subjects/:id', authenticateToken, async (req, res) => {
  try {
    const subjectId = parseInt(req.params.id);

    const existing = await db.prepare('SELECT * FROM subjects WHERE id = ?').get(subjectId);
    if (!existing) return res.status(404).json({ error: 'Matéria não encontrada.' });

    const isOwner = existing.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para excluir esta matéria.' });
    }

    await db.prepare('DELETE FROM subjects WHERE id = ?').run(subjectId);
    res.json({ message: 'Matéria removida com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Topic
app.post('/api/subjects/:id/topics', authenticateToken, async (req, res) => {
  try {
    const subjectId = parseInt(req.params.id);
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome do assunto é obrigatório.' });
    }

    const result = await db.prepare(`
      INSERT INTO topics (subject_id, name)
      VALUES (?, ?)
    `).run(subjectId, name);

    const created = await db.prepare('SELECT * FROM topics WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Assunto adicionado!', topic: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Topic
app.put('/api/topics/:id', authenticateToken, async (req, res) => {
  try {
    const topicId = parseInt(req.params.id);
    const { name } = req.body;

    const topic = await db.prepare(`
      SELECT t.*, s.user_id FROM topics t
      JOIN subjects s ON s.id = t.subject_id
      WHERE t.id = ?
    `).get(topicId);
    if (!topic) return res.status(404).json({ error: 'Assunto não encontrado.' });

    const isOwner = topic.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para alterar este assunto.' });
    }

    await db.prepare('UPDATE topics SET name = ? WHERE id = ?').run(name, topicId);
    const updated = await db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId);
    res.json({ message: 'Assunto atualizado!', topic: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Topic
app.delete('/api/topics/:id', authenticateToken, async (req, res) => {
  try {
    const topicId = parseInt(req.params.id);

    const topic = await db.prepare(`
      SELECT t.*, s.user_id FROM topics t
      JOIN subjects s ON s.id = t.subject_id
      WHERE t.id = ?
    `).get(topicId);
    if (!topic) return res.status(404).json({ error: 'Assunto não encontrado.' });

    const isOwner = topic.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para excluir este assunto.' });
    }

    await db.prepare('DELETE FROM topics WHERE id = ?').run(topicId);
    res.json({ message: 'Assunto removido!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Subtopic
app.post('/api/topics/:id/subtopics', authenticateToken, async (req, res) => {
  try {
    const topicId = parseInt(req.params.id);
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome do subassunto é obrigatório.' });
    }

    const topic = await db.prepare(`
      SELECT t.*, s.user_id FROM topics t
      JOIN subjects s ON s.id = t.subject_id
      WHERE t.id = ?
    `).get(topicId);
    if (!topic) return res.status(404).json({ error: 'Assunto não encontrado.' });

    const isOwner = topic.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para adicionar subassunto neste assunto.' });
    }

    const result = await db.prepare(`
      INSERT INTO subtopics (topic_id, name)
      VALUES (?, ?)
    `).run(topicId, name);

    const created = await db.prepare('SELECT * FROM subtopics WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Subassunto adicionado!', subtopic: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Subtopic
app.put('/api/subtopics/:id', authenticateToken, async (req, res) => {
  try {
    const subtopicId = parseInt(req.params.id);
    const { name } = req.body;

    const subtopic = await db.prepare(`
      SELECT st.*, s.user_id FROM subtopics st
      JOIN topics t ON t.id = st.topic_id
      JOIN subjects s ON s.id = t.subject_id
      WHERE st.id = ?
    `).get(subtopicId);
    if (!subtopic) return res.status(404).json({ error: 'Subassunto não encontrado.' });

    const isOwner = subtopic.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para alterar este subassunto.' });
    }

    await db.prepare('UPDATE subtopics SET name = ? WHERE id = ?').run(name, subtopicId);
    const updated = await db.prepare('SELECT * FROM subtopics WHERE id = ?').get(subtopicId);
    res.json({ message: 'Subassunto atualizado!', subtopic: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Subtopic
app.delete('/api/subtopics/:id', authenticateToken, async (req, res) => {
  try {
    const subtopicId = parseInt(req.params.id);

    const subtopic = await db.prepare(`
      SELECT st.*, s.user_id FROM subtopics st
      JOIN topics t ON t.id = st.topic_id
      JOIN subjects s ON s.id = t.subject_id
      WHERE st.id = ?
    `).get(subtopicId);
    if (!subtopic) return res.status(404).json({ error: 'Subassunto não encontrado.' });

    const isOwner = subtopic.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para excluir este subassunto.' });
    }

    await db.prepare('DELETE FROM subtopics WHERE id = ?').run(subtopicId);
    res.json({ message: 'Subassunto removido!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

// Start Server (only if not running inside a Vercel serverless environment or automated test)
if (!process.env.VERCEL && !process.env.DISABLE_SERVER_LISTEN) {
  app.listen(PORT, () => {
    console.log(`Med Planner Backend rodando com sucesso na porta ${PORT}`);
  });
}

module.exports = app;



