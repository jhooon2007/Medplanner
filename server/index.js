const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'med_planner_by_joao_secret_2026';

// Initialize Database
initDatabase();

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Multer storage for profile photos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'avatar-' + uniqueSuffix + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas!'));
    }
  }
});

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado. Faça login primeiro.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Sessão expirada ou inválida. Faça login novamente.' });
    }
    req.user = decoded;
    next();
  });
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

// Register
app.post('/api/auth/register', upload.single('photo'), (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existingUser) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const result = db.prepare(`
      INSERT INTO users (name, email, password, phone, photo_url, role)
      VALUES (?, ?, ?, ?, ?, 'student')
    `).run(name.trim(), email.toLowerCase().trim(), hashedPassword, phone || null, photoUrl);

    const user = {
      id: result.lastInsertRowid,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone || null,
      photo_url: photoUrl,
      role: 'student'
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Usuário cadastrado com sucesso!',
      token,
      user
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erro ao cadastrar usuário: ' + err.message });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Informe e-mail e senha.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      photo_url: user.photo_url,
      role: user.role
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login realizado com sucesso!',
      token,
      user: userPayload
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro ao autenticar: ' + err.message });
  }
});

// Get current user profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, email, phone, photo_url, role, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update profile (photo, phone, name)
app.put('/api/auth/profile', authenticateToken, upload.single('photo'), (req, res) => {
  try {
    const { name, phone, password } = req.body;
    const userId = req.user.id;

    let query = 'UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone)';
    const params = [name || null, phone || null];

    if (req.file) {
      query += ', photo_url = ?';
      params.push(`/uploads/${req.file.filename}`);
    }

    if (password && password.trim().length >= 4) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(userId);

    db.prepare(query).run(...params);

    const updatedUser = db.prepare('SELECT id, name, email, phone, photo_url, role FROM users WHERE id = ?').get(userId);
    const token = jwt.sign(updatedUser, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Perfil atualizado com sucesso!',
      user: updatedUser,
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. ADMIN DASHBOARD ROUTES
// ==========================================

// List all users for Admin
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.photo_url, u.role, u.created_at,
             COUNT(DISTINCT cp.subtopic_id) as completed_subtopics_count
      FROM users u
      LEFT JOIN checklist_progress cp ON cp.user_id = u.id AND cp.completed = 1
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all();

    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user by Admin
app.put('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const { name, email, phone, role, password } = req.body;

    let query = 'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone), role = COALESCE(?, role)';
    const params = [name || null, email ? email.toLowerCase().trim() : null, phone || null, role || null];

    if (password && password.trim().length >= 4) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(targetId);

    db.prepare(query).run(...params);

    const updated = db.prepare('SELECT id, name, email, phone, photo_url, role FROM users WHERE id = ?').get(targetId);
    res.json({ message: 'Usuário atualizado pelo Administrador.', user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user by Admin
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Você não pode excluir sua própria conta de administrador.' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    res.json({ message: 'Usuário removido com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Stats
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT count(*) as count FROM users').get().count;
    const totalStudents = db.prepare("SELECT count(*) as count FROM users WHERE role = 'student'").get().count;
    const totalEvents = db.prepare('SELECT count(*) as count FROM events').get().count;
    const totalSubjects = db.prepare('SELECT count(*) as count FROM subjects').get().count;
    const totalSubtopics = db.prepare('SELECT count(*) as count FROM subtopics').get().count;

    res.json({
      stats: {
        totalUsers,
        totalStudents,
        totalEvents,
        totalSubjects,
        totalSubtopics
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. ABA 1: AGENDA SEMANAL (CLASSES)
// ==========================================

// Get weekly schedule
app.get('/api/classes', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    // Get user-specific classes OR default template classes if user has none
    const userClasses = db.prepare('SELECT * FROM classes WHERE user_id = ? ORDER BY day_of_week, start_time').all(userId);

    if (userClasses.length > 0) {
      return res.json({ classes: userClasses });
    }

    // Fallback to default template classes
    const defaultClasses = db.prepare('SELECT * FROM classes WHERE user_id IS NULL ORDER BY day_of_week, start_time').all();
    res.json({ classes: defaultClasses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new class
app.post('/api/classes', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { day_of_week, start_time, end_time, subject_name, room, teacher, type, color } = req.body;

    if (!day_of_week || !start_time || !end_time || !subject_name) {
      return res.status(400).json({ error: 'Dia da semana, horários e nome da matéria são obrigatórios.' });
    }

    const result = db.prepare(`
      INSERT INTO classes (user_id, day_of_week, start_time, end_time, subject_name, room, teacher, type, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, parseInt(day_of_week), start_time, end_time, subject_name, room || '', teacher || '', type || 'Teórica', color || 'teal');

    const created = db.prepare('SELECT * FROM classes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Aula adicionada com sucesso!', classItem: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update class
app.put('/api/classes/:id', authenticateToken, (req, res) => {
  try {
    const classId = parseInt(req.params.id);
    const userId = req.user.id;
    const { day_of_week, start_time, end_time, subject_name, room, teacher, type, color } = req.body;

    // Check if class exists and belongs to user or is default
    const existing = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
    if (!existing) {
      return res.status(404).json({ error: 'Aula não encontrada.' });
    }

    if (existing.user_id !== null && existing.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para alterar esta aula.' });
    }

    db.prepare(`
      UPDATE classes
      SET day_of_week = ?, start_time = ?, end_time = ?, subject_name = ?, room = ?, teacher = ?, type = ?, color = ?
      WHERE id = ?
    `).run(parseInt(day_of_week), start_time, end_time, subject_name, room || '', teacher || '', type || 'Teórica', color || 'teal', classId);

    const updated = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
    res.json({ message: 'Aula atualizada!', classItem: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete class
app.delete('/api/classes/:id', authenticateToken, (req, res) => {
  try {
    const classId = parseInt(req.params.id);
    const userId = req.user.id;

    const existing = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
    if (!existing) {
      return res.status(404).json({ error: 'Aula não encontrada.' });
    }

    if (existing.user_id !== null && existing.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para deletar esta aula.' });
    }

    db.prepare('DELETE FROM classes WHERE id = ?').run(classId);
    res.json({ message: 'Aula removida.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. ABA 2: EVENTOS IMPORTANTES (PROVAS & PRAZOS)
// ==========================================

// Get all events
app.get('/api/events', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    // Query events where user_id IS NULL OR user_id = userId
    const events = db.prepare(`
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
app.post('/api/events', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { title, module_or_subject, start_date, end_date, type, topics } = req.body;

    if (!title || !start_date || !module_or_subject) {
      return res.status(400).json({ error: 'Título, data e matéria são obrigatórios.' });
    }

    const topicsJson = Array.isArray(topics) ? JSON.stringify(topics) : JSON.stringify([topics].filter(Boolean));

    const result = db.prepare(`
      INSERT INTO events (user_id, title, module_or_subject, start_date, end_date, type, topics, is_custom)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(userId, title, module_or_subject, start_date, end_date || null, type || 'Prova', topicsJson);

    const created = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
    created.topics = JSON.parse(created.topics);

    res.status(201).json({ message: 'Evento criado com sucesso!', event: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit event date & details (Autonomous student editing for calendar changes / strikes)
app.put('/api/events/:id', authenticateToken, (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const userId = req.user.id;
    const { title, module_or_subject, start_date, end_date, type, topics } = req.body;

    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!existing) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }

    const topicsJson = Array.isArray(topics) ? JSON.stringify(topics) : JSON.stringify([topics].filter(Boolean));

    // Update in place
    db.prepare(`
      UPDATE events
      SET title = COALESCE(?, title),
          module_or_subject = COALESCE(?, module_or_subject),
          start_date = COALESCE(?, start_date),
          end_date = ?,
          type = COALESCE(?, type),
          topics = COALESCE(?, topics)
      WHERE id = ?
    `).run(title || null, module_or_subject || null, start_date || null, end_date !== undefined ? end_date : existing.end_date, type || null, topicsJson, eventId);

    const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    updated.topics = JSON.parse(updated.topics);

    res.json({ message: 'Evento e data atualizados!', event: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete event
app.delete('/api/events/:id', authenticateToken, (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const userId = req.user.id;

    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!existing) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }

    db.prepare('DELETE FROM events WHERE id = ?').run(eventId);
    res.json({ message: 'Evento excluído com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. ABA 3: CÁLCULO DE NOTAS (UFG RULES)
// ==========================================

// Get user grades
app.get('/api/grades', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const grades = db.prepare('SELECT * FROM grades WHERE user_id = ?').all(userId);
    res.json({ grades });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save or batch update grades
app.post('/api/grades/batch', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { gradesList } = req.body; // Array of { module, discipline, item_key, item_name, score, weight }

    if (!Array.isArray(gradesList)) {
      return res.status(400).json({ error: 'gradesList deve ser uma lista de notas.' });
    }

    const upsert = db.prepare(`
      INSERT INTO grades (user_id, module, discipline, item_key, item_name, score, weight)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, module, item_key) DO UPDATE SET
        score = excluded.score,
        weight = excluded.weight,
        item_name = excluded.item_name
    `);

    const tx = db.transaction(() => {
      for (const item of gradesList) {
        upsert.run(
          userId,
          item.module,
          item.discipline || null,
          item.item_key,
          item.item_name,
          item.score !== undefined && item.score !== null ? parseFloat(item.score) : null,
          item.weight || 1.0
        );
      }
    });

    tx();

    const allGrades = db.prepare('SELECT * FROM grades WHERE user_id = ?').all(userId);
    res.json({ message: 'Notas salvas com sucesso!', grades: allGrades });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. ABA 4: MATÉRIAS DO SEMESTRE & CHECKLIST
// ==========================================

// Get all subjects with their full hierarchy (Topics -> Subtopics -> User Progress)
app.get('/api/subjects', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    // Subjects: available to user (user_id IS NULL OR user_id = userId)
    const subjects = db.prepare(`
      SELECT * FROM subjects
      WHERE user_id IS NULL OR user_id = ?
      ORDER BY order_index ASC, id ASC
    `).all(userId);

    // Topics for these subjects
    const topics = db.prepare(`
      SELECT t.* FROM topics t
      JOIN subjects s ON s.id = t.subject_id
      WHERE s.user_id IS NULL OR s.user_id = ?
      ORDER BY t.order_index ASC, t.id ASC
    `).all(userId);

    // Subtopics
    const subtopics = db.prepare(`
      SELECT st.* FROM subtopics st
      JOIN topics t ON t.id = st.topic_id
      JOIN subjects s ON s.id = t.subject_id
      WHERE s.user_id IS NULL OR s.user_id = ?
      ORDER BY st.order_index ASC, st.id ASC
    `).all(userId);

    // User checklist progress
    const progressList = db.prepare(`
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
app.post('/api/checklist/toggle', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { subtopic_id, completed } = req.body;

    if (!subtopic_id) {
      return res.status(400).json({ error: 'subtopic_id é obrigatório.' });
    }

    const isCompleted = completed ? 1 : 0;
    const now = isCompleted ? new Date().toISOString() : null;

    db.prepare(`
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
app.post('/api/subjects', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { name, code, color, icon, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome da matéria é obrigatório.' });
    }

    const result = db.prepare(`
      INSERT INTO subjects (user_id, name, code, color, icon, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, name, code || '', color || 'teal', icon || 'BookOpen', description || '');

    const created = db.prepare('SELECT * FROM subjects WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Matéria adicionada com sucesso!', subject: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Subject
app.put('/api/subjects/:id', authenticateToken, (req, res) => {
  try {
    const subjectId = parseInt(req.params.id);
    const { name, code, color, icon, description } = req.body;

    db.prepare(`
      UPDATE subjects
      SET name = COALESCE(?, name),
          code = COALESCE(?, code),
          color = COALESCE(?, color),
          icon = COALESCE(?, icon),
          description = COALESCE(?, description)
      WHERE id = ?
    `).run(name || null, code || null, color || null, icon || null, description || null, subjectId);

    const updated = db.prepare('SELECT * FROM subjects WHERE id = ?').get(subjectId);
    res.json({ message: 'Matéria atualizada!', subject: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Subject
app.delete('/api/subjects/:id', authenticateToken, (req, res) => {
  try {
    const subjectId = parseInt(req.params.id);
    db.prepare('DELETE FROM subjects WHERE id = ?').run(subjectId);
    res.json({ message: 'Matéria removida com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Topic
app.post('/api/subjects/:id/topics', authenticateToken, (req, res) => {
  try {
    const subjectId = parseInt(req.params.id);
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome do assunto é obrigatório.' });
    }

    const result = db.prepare(`
      INSERT INTO topics (subject_id, name)
      VALUES (?, ?)
    `).run(subjectId, name);

    const created = db.prepare('SELECT * FROM topics WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Assunto adicionado!', topic: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Topic
app.put('/api/topics/:id', authenticateToken, (req, res) => {
  try {
    const topicId = parseInt(req.params.id);
    const { name } = req.body;

    db.prepare('UPDATE topics SET name = ? WHERE id = ?').run(name, topicId);
    const updated = db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId);
    res.json({ message: 'Assunto atualizado!', topic: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Topic
app.delete('/api/topics/:id', authenticateToken, (req, res) => {
  try {
    const topicId = parseInt(req.params.id);
    db.prepare('DELETE FROM topics WHERE id = ?').run(topicId);
    res.json({ message: 'Assunto removido!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Subtopic
app.post('/api/topics/:id/subtopics', authenticateToken, (req, res) => {
  try {
    const topicId = parseInt(req.params.id);
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome do subassunto é obrigatório.' });
    }

    const result = db.prepare(`
      INSERT INTO subtopics (topic_id, name)
      VALUES (?, ?)
    `).run(topicId, name);

    const created = db.prepare('SELECT * FROM subtopics WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Subassunto adicionado!', subtopic: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Subtopic
app.put('/api/subtopics/:id', authenticateToken, (req, res) => {
  try {
    const subtopicId = parseInt(req.params.id);
    const { name } = req.body;

    db.prepare('UPDATE subtopics SET name = ? WHERE id = ?').run(name, subtopicId);
    const updated = db.prepare('SELECT * FROM subtopics WHERE id = ?').get(subtopicId);
    res.json({ message: 'Subassunto atualizado!', subtopic: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Subtopic
app.delete('/api/subtopics/:id', authenticateToken, (req, res) => {
  try {
    const subtopicId = parseInt(req.params.id);
    db.prepare('DELETE FROM subtopics WHERE id = ?').run(subtopicId);
    res.json({ message: 'Subassunto removido!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Med Planner Backend rodando com sucesso na porta ${PORT}`);
});

