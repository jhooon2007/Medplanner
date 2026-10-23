const { createClient } = require('@libsql/client');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Banco persistente: Turso (libSQL) em produção, arquivo SQLite local em desenvolvimento.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const tursoUrl = process.env.TURSO_DATABASE_URL;

if (isServerless && !tursoUrl) {
  throw new Error('TURSO_DATABASE_URL não configurada. Em produção (Vercel) o banco precisa ser persistente.');
}

const client = createClient({
  url: tursoUrl || 'file:' + path.resolve(__dirname, 'medplanner.db'),
  authToken: process.env.TURSO_AUTH_TOKEN,
});

function toPlain(columns, row) {
  const out = {};
  columns.forEach((col, i) => { out[col] = row[i]; });
  return out;
}

// Mesma forma de uso do better-sqlite3 (prepare/get/all/run), porém assíncrona.
function wrap(executor) {
  return {
    prepare(sql) {
      return {
        async get(...args) {
          const r = await executor.execute({ sql, args });
          return r.rows.length ? toPlain(r.columns, r.rows[0]) : undefined;
        },
        async all(...args) {
          const r = await executor.execute({ sql, args });
          return r.rows.map(row => toPlain(r.columns, row));
        },
        async run(...args) {
          const r = await executor.execute({ sql, args });
          return {
            changes: r.rowsAffected,
            lastInsertRowid: r.lastInsertRowid !== undefined ? Number(r.lastInsertRowid) : undefined,
          };
        },
      };
    },
  };
}

const db = wrap(client);

db.exec = async (sql) => { await client.executeMultiple(sql); };

// fn recebe um "db" ligado à transação; commit automático, rollback em erro.
db.transaction = async (fn) => {
  const tx = await client.transaction('write');
  try {
    const result = await fn(wrap(tx));
    await tx.commit();
    return result;
  } catch (err) {
    await tx.rollback();
    throw err;
  } finally {
    tx.close();
  }
};

async function initDatabase() {
  console.log('Initializing Database schemas...');

  // 1. Users
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT,
      photo_url TEXT,
      role TEXT NOT NULL DEFAULT 'student',
      birth_date TEXT,
      current_semester INTEGER,
      onboarding_completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration for onboarding fields
  try {
    const existingCols = (await db.prepare('PRAGMA table_info(users)').all()).map(c => c.name);
    if (!existingCols.includes('birth_date')) {
      await db.exec(`ALTER TABLE users ADD COLUMN birth_date TEXT;`);
    }
    if (!existingCols.includes('current_semester')) {
      await db.exec(`ALTER TABLE users ADD COLUMN current_semester INTEGER;`);
    }
    if (!existingCols.includes('onboarding_completed')) {
      await db.exec(`ALTER TABLE users ADD COLUMN onboarding_completed INTEGER DEFAULT 0;`);
    }
  } catch (e) {
    console.warn('Migration warning:', e.message);
  }

  try {
    const cols = (await db.prepare('PRAGMA table_info(users)').all()).map(c => c.name);
    if (!cols.includes('last_login_at')) {
      await db.exec(`ALTER TABLE users ADD COLUMN last_login_at DATETIME;`);
    }
    // Incrementado ao trocar a senha: invalida as sessões abertas com a senha antiga
    if (!cols.includes('token_version')) {
      await db.exec(`ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;`);
    }
  } catch (e) {
    console.warn('Migration warning:', e.message);
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- Fotos de perfil ficam no banco (o disco da Vercel é somente leitura/efêmero)
    CREATE TABLE IF NOT EXISTS user_photos (
      user_id INTEGER PRIMARY KEY,
      mime TEXT NOT NULL,
      data TEXT NOT NULL, -- base64
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Avisos gerais publicados pelo administrador para todos os alunos
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'info', -- info | warning | urgent
      active INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT,                    -- YYYY-MM-DD (opcional)
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Aulas da grade padrão que o aluno escondeu (ou substituiu por uma cópia própria)
    CREATE TABLE IF NOT EXISTS hidden_classes (
      user_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, class_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    );
  `);

  // Fotos passam a ser servidas por uma chave aleatória (o id do aluno não revela a foto)
  try {
    const photoCols = (await db.prepare('PRAGMA table_info(user_photos)').all()).map(c => c.name);
    if (!photoCols.includes('photo_key')) {
      await db.exec(`ALTER TABLE user_photos ADD COLUMN photo_key TEXT;`);
      const rows = await db.prepare('SELECT user_id FROM user_photos').all();
      for (const row of rows) {
        const key = crypto.randomBytes(24).toString('hex');
        await db.prepare('UPDATE user_photos SET photo_key = ? WHERE user_id = ?').run(key, row.user_id);
        await db.prepare('UPDATE users SET photo_url = ? WHERE id = ?').run(`/api/photos/${key}`, row.user_id);
      }
    }
  } catch (e) {
    console.warn('Migration warning:', e.message);
  }

  // 2. Classes (Aba 1 - Weekly Schedule)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      day_of_week INTEGER NOT NULL, -- 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      room TEXT,
      teacher TEXT,
      type TEXT DEFAULT 'Teórica',
      color TEXT DEFAULT 'teal',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 3. Events (Aba 2 - Important Events & Deadlines)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER, -- NULL means default template event available to all students
      title TEXT NOT NULL,
      module_or_subject TEXT NOT NULL,
      start_date TEXT NOT NULL, -- YYYY-MM-DD
      end_date TEXT,            -- YYYY-MM-DD
      type TEXT DEFAULT 'Prova',
      topics TEXT NOT NULL DEFAULT '[]', -- JSON string of topics covered
      is_custom INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 4. Grades (Aba 3 - Grade Calculations)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      module TEXT NOT NULL, -- 'CHS_II' | 'IMC_II' | 'INTEGRADOR_II'
      discipline TEXT,      -- 'Anatomia' | 'Bioquímica' | 'Fisiologia' | 'Histologia' | etc.
      item_key TEXT NOT NULL, -- 'N1_PROVA', 'N1_PARTICIPACAO', 'ROLEPLAY_1', 'TBL_1_INDIV', etc.
      item_name TEXT NOT NULL,
      score REAL,
      weight REAL DEFAULT 1.0,
      extra_data TEXT, -- JSON for extra components if needed
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, module, item_key)
    );
  `);

  // 5. Subjects, Topics, Subtopics (Aba 4 - Semester Subjects & Checklist)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER, -- NULL for template subjects, user_id for custom ones
      name TEXT NOT NULL,
      code TEXT,
      icon TEXT DEFAULT 'BookOpen',
      color TEXT DEFAULT 'teal',
      description TEXT,
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subtopics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checklist_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subtopic_id INTEGER NOT NULL,
      completed INTEGER DEFAULT 0,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (subtopic_id) REFERENCES subtopics(id) ON DELETE CASCADE,
      UNIQUE(user_id, subtopic_id)
    );
  `);

  await seedInitialData();
}

async function seedInitialData() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@medplanner.com').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  // Remove contas de teste antigas (alunos @medplanner.com)
  try {
    await db.prepare(`DELETE FROM users WHERE email LIKE '%@medplanner.com' AND role != 'admin'`).run();
  } catch (e) {}

  const existingAdmin = await db.prepare(`SELECT id, password FROM users WHERE email = ?`).get(adminEmail);
  const anyAdmin = await db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get();

  if (!existingAdmin) {
    if (anyAdmin) {
      // Já existe um admin (ex.: ele trocou o próprio e-mail no app): não criamos uma conta duplicada.
    } else if (!adminPassword) {
      // Sem senha definida não criamos admin: evita uma credencial padrão conhecida.
      console.warn('ADMIN_PASSWORD não definida: conta de administrador NÃO foi criada.');
    } else {
      await db.prepare(`
        INSERT INTO users (name, email, password, phone, role, birth_date, current_semester, onboarding_completed)
        VALUES (?, ?, ?, ?, ?, '1998-05-20', 4, 1)
      `).run('Administrador UFG', adminEmail, bcrypt.hashSync(adminPassword, 10), '(62) 98888-0000', 'admin');
      console.log(`Admin account initialized (${adminEmail}).`);
    }
  } else {
    // A senha só é sobrescrita pelo ambiente quando pedido explicitamente: assim uma troca feita
    // no app não é desfeita a cada reinício do servidor.
    const forceReset = process.env.ADMIN_RESET_PASSWORD === 'true';
    if (forceReset && adminPassword && !bcrypt.compareSync(adminPassword, existingAdmin.password)) {
      await db.prepare(`UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?`)
        .run(bcrypt.hashSync(adminPassword, 10), existingAdmin.id);
      console.log('Senha do administrador redefinida a partir de ADMIN_PASSWORD.');
    }
    await db.prepare(`UPDATE users SET role = 'admin', onboarding_completed = 1 WHERE id = ?`).run(existingAdmin.id);
  }

  // Cada carga inicial roda uma única vez (registrada em `meta`), mesmo que o admin apague os itens depois.
  const seededOnce = async (key) => {
    const done = await db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
    if (done) return true;
    await db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run(key, new Date().toISOString());
    return false;
  };

  // Pre-seed Subjects if empty
  const subjectCount = (await db.prepare(`SELECT count(*) as count FROM subjects WHERE user_id IS NULL`).get()).count;
  if (subjectCount === 0 && !(await seededOnce('seed_subjects'))) {
    console.log('Seeding Pre-registered Subjects (Aba 4)...');

    const subjectsData = [
      {
        name: 'Anatomia Humana',
        code: 'MED-ANA',
        color: 'blue',
        icon: 'Activity',
        description: 'Módulo CHS II: Estudo da anatomia dos sistemas cardiovascular, respiratório, digestório, urogenital e sensorial.',
        topics: [
          {
            name: 'Sistema Circulatório',
            subtopics: ['Coração e pericárdio', 'Vascularização coronariana e ciclo anatômico', 'Grandes artérias sistêmicas', 'Sistema venoso e veias cavas', 'Microcirculação e vasos capilares']
          },
          {
            name: 'Sistema Linfático',
            subtopics: ['Timo e baço', 'Linfonodos cervicais, axilares e inguinais', 'Ducto torácico e circulação linfática', 'Tecido linfoide associado a mucosas (MALT)']
          },
          {
            name: 'Sistema Respiratório',
            subtopics: ['Cavidade nasal e seios paranasais', 'Faringe e laringe (cartilagens e cordas vocais)', 'Traqueia e árvore brônquica', 'Pulmões, pleuras e hilos pulmonares', 'Segmentação broncopulmonar']
          },
          {
            name: 'Sistema Digestório',
            subtopics: ['Cavidade oral, glândulas salivares e faringe', 'Esôfago e estômago (vascularização e inervação)', 'Duodeno, jejuno e íleo', 'Ceco, apêndice, cólons e reto', 'Fígado, vias biliares e pâncreas']
          },
          {
            name: 'Sistema Urogenital',
            subtopics: ['Rins (córtex, medula e pedículo renal)', 'Ureteres e relações anatômicas', 'Bexiga urinária e trígono vesical', 'Uretra masculina e feminina']
          },
          {
            name: 'Sistema Genital (masc/fem)',
            subtopics: ['Aparelho genital masculino (testículos, próstata, pênis)', 'Aparelho genital feminino (ovários, tubas, útero e vagina)', 'Genitália externa e assoalho pélvico', 'Períneo e vascularização pudenda']
          },
          {
            name: 'Sistema Sensorial',
            subtopics: ['Olho, globo ocular e músculos extrínsecos', 'Vias ópticas e reflexos pupilares', 'Orelha externa, média e interna', 'Vias auditivas e vestibulares', 'Sentidos químicos (olfato e gustação)']
          }
        ]
      },
      {
        name: 'Bioquímica',
        code: 'MED-BIOQ',
        color: 'purple',
        icon: 'Dna',
        description: 'Módulo CHS II: Bioquímica metabólica, sinalização celular e regulação energética.',
        topics: [
          {
            name: 'Controle da expressão gênica',
            subtopics: ['Estrutura da cromatina e epigenética', 'Fatores de transcrição basais e específicos', 'Processamento do RNA e splicing alternativo', 'Regulação pós-transcricional e microRNAs']
          },
          {
            name: 'Transdução de sinal/apoptose/oncogenes',
            subtopics: ['Receptores acoplados à proteína G e segundos mensageiros', 'Receptores tirosina-quinase e via MAPK', 'Vias de apoptose intrínseca e extrínseca (caspases)', 'Oncogenes e genes supressores de tumor (p53, Rb)']
          },
          {
            name: 'Sinalização (insulina, glucagon, epinefrina)',
            subtopics: ['Mecanismo de ação da insulina e captação de glicose (GLUT4)', 'Sinalização do glucagon e ativação da PKA', 'Epinefrina e resposta ao estresse agudo', 'Regulação metabólica coordenada no fígado e músculo']
          },
          {
            name: 'Metabolismo de Carboidratos',
            subtopics: ['Glicólise aeróbia e anaeróbia', 'Complexo da piruvato desidrogenase', 'Gliconeogênese hepática e renal', 'Metabolismo do glicogênio (síntese e degradação)', 'Via das pentoses fosfato e síntese de NADPH']
          },
          {
            name: 'Metabolismo de Lipídeos',
            subtopics: ['Digestão, absorção e transporte por lipoproteínas (quilomícrons, VLDL, LDL, HDL)', 'Lipólise e ativação de ácidos graxos', 'Beta-oxidação mitocondrial e rendimento energético', 'Cetogênese e utilização de corpos cetônicos', 'Síntese de ácidos graxos, triglicerídeos e colesterol']
          },
          {
            name: 'Fosforilação oxidativa',
            subtopics: ['Complexos I, II, III e IV da cadeia respiratória', 'Gradiente eletroquímico de prótons', 'ATP sintase e mecanismo rotacional', 'Inibidores da cadeia e agentes desacopladores']
          }
        ]
      },
      {
        name: 'Fisiologia Humana',
        code: 'MED-FISIO',
        color: 'rose',
        icon: 'HeartPulse',
        description: 'Módulo CHS II: Fisiologia dos sistemas cardiovascular, respiratório, digestório e renal.',
        topics: [
          {
            name: 'Cardiovascular',
            subtopics: ['Potenciais de ação cardíacos (células marca-passo vs contráteis)', 'Eletrocardiograma (ECG) normal e derivações', 'Mecânica do ciclo cardíaco e curvas de pressão-volume', 'Débito cardíaco, pré-carga, pós-carga e contratilidade', 'Hemodinâmica, resistência vascular periférica e pressão arterial', 'Regulação pelo barorreflexo e sistema renina-angiotensina']
          },
          {
            name: 'Respiratório',
            subtopics: ['Mecânica ventilatória, músculos inspiratórios/expiratórios e complacência', 'Volumes, capacidades pulmonares e espirometria', 'Troca gasosa alvéolo-capilar e difusão de O2 e CO2', 'Transporte de gases no sangue e curva de dissociação da hemoglobina', 'Relação ventilação/perfusão (V/Q)', 'Controle neural e químico da ventilação (quimiorreceptores)']
          },
          {
            name: 'Digestório',
            subtopics: ['Controle neuroendócrino da motilidade gastrointestinal', 'Secreções salivares e gástricas (ácido clorídrico e pepsina)', 'Secreção pancreática exócrina e bile', 'Digestão e mecanismos de absorção intestinal', 'Fisiologia do fígado e circulação êntero-hepática']
          },
          {
            name: 'Renal',
            subtopics: ['Filtração glomerular, taxa de filtração (TFG) e autorregulação', 'Reabsorção e secreção no túbulo proximal', 'Alça de Henle e mecanismo de concentração por contracorrente', 'Túbulo distal, ducto coletor e ação do ADH e aldosterona', 'Regulação do volume extracelular, osmolaridade e balanço ácido-base']
          }
        ]
      },
      {
        name: 'Histologia e Embriologia',
        code: 'MED-HISTO',
        color: 'emerald',
        icon: 'Microscope',
        description: 'Módulo CHS II: Morfologia microscópica dos sistemas e embriogênese humana.',
        topics: [
          {
            name: 'Tecidos dos sistemas',
            subtopics: ['Endotélio, artérias elásticas/musculares, veias e capilares', 'Epitélio respiratório, traqueia, brônquios e barreira alvéolo-capilar', 'Tubo digestório: mucosa, submucosa, muscular e serosa/adventícia', 'Histologia hepática: tríade portal e sinusoides', 'Histologia renal: corpúsculo renal, túbulos e aparelho justaglomerular', 'Aparelhos reprodutores masculino e feminino']
          },
          {
            name: 'Pele/anexos',
            subtopics: ['Camadas da epiderme (córnea, lúcida, granulosa, espinhosa e basal)', 'Derme papilar e reticular, e hipoderme', 'Folículos pilosos, glândulas sebáceas e glândulas sudoríparas', 'Terminações nervosas livres e corpúsculos sensoriais']
          },
          {
            name: 'Desenvolvimento embrionário',
            subtopics: ['1ª semana: fecundação, clivagem e formação do blastocisto', '2ª semana: disco embrionário bilaminar e implantação', '3ª semana: gastrulação, três folhetos germinativos e notocorda', '4ª à 8ª semana: neurulação, dobramento e organogênese primária', 'Placenta, cordão umbilical e membranas fetais']
          }
        ]
      },
      {
        name: 'Introdução ao Método Clínico II',
        code: 'MED-IMC2',
        color: 'amber',
        icon: 'Stethoscope',
        description: 'Módulo IMC II: Semiologia médica aplicada, imagenologia diagnóstica e simulação clínica.',
        topics: [
          {
            name: 'Semiologia',
            subtopics: ['Dispneia (caracterização, classificação NYHA e diagnósticos diferenciais)', 'Tosse (aguda vs crônica, produtiva vs seca, sinais de alarme)', 'Icterícia (pré-hepática, intra-hepática e pós-hepática)', 'Dispepsia e Dor torácica/abdominal', 'Diarreia (osmótica, secretória, inflamatória e motora)', 'Febre (fisiopatologia, padrões térmicos e semiogênese)', 'Edema (classificação de cacifo, patogênese e diagnósticos)']
          },
          {
            name: 'Imagenologia',
            subtopics: ['Radiografia de tórax e abdome: técnica e leitura sistemática', 'Ultrassonografia: princípios físicos, ecogenicidade e protocolo FAST', 'Tomografia Computadorizada (TC): densidades em Hounsfield e indicações', 'Ressonância Magnética (RM): sequências T1, T2 e contrastes', 'Medicina Nuclear: princípios de radiofármacos e cintilografia']
          },
          {
            name: 'Prática (Role Play e HC)',
            subtopics: ['Relação médico-paciente e empatia na anamnese', 'Construção da História Clínica completa (ID, QP, HDA, IS, AP, AF, AS)', 'Simulações Role Play de atendimento e feedback', 'Raciocínio clínico diagnóstico e tomada de decisão']
          }
        ]
      }
    ];

    await db.transaction(async (tx) => {
      const insertSubject = tx.prepare(`
        INSERT INTO subjects (user_id, name, code, color, icon, description, order_index)
        VALUES (NULL, ?, ?, ?, ?, ?, ?)
      `);
      const insertTopic = tx.prepare(`
        INSERT INTO topics (subject_id, name, order_index)
        VALUES (?, ?, ?)
      `);
      const insertSubtopic = tx.prepare(`
        INSERT INTO subtopics (topic_id, name, order_index)
        VALUES (?, ?, ?)
      `);

      for (const [sIdx, sub] of subjectsData.entries()) {
        const subRes = await insertSubject.run(sub.name, sub.code, sub.color, sub.icon, sub.description, sIdx);
        for (const [tIdx, top] of sub.topics.entries()) {
          const topRes = await insertTopic.run(subRes.lastInsertRowid, top.name, tIdx);
          for (const [stIdx, st] of top.subtopics.entries()) {
            await insertSubtopic.run(topRes.lastInsertRowid, st, stIdx);
          }
        }
      }
    });
    console.log('Pre-registered Subjects, Topics and Subtopics successfully inserted!');
  }

  // Pre-seed Events (Aba 2) if empty
  const eventCount = (await db.prepare(`SELECT count(*) as count FROM events WHERE user_id IS NULL`).get()).count;
  if (eventCount === 0 && !(await seededOnce('seed_events'))) {
    console.log('Seeding Pre-registered Events 2026.2 (Aba 2)...');

    const eventsData = [
      // Setembro / 2026
      {
        title: 'Avaliação Teórico-Prática N1 de Anatomia',
        module_or_subject: 'Anatomia Humana (CHS II)',
        start_date: '2026-09-08',
        end_date: '2026-09-10',
        type: 'Prova',
        topics: JSON.stringify(['Sistema Circulatório', 'Sistema Linfático', 'Sistema Respiratório'])
      },
      {
        title: 'Avaliação N1 de Bioquímica',
        module_or_subject: 'Bioquímica (CHS II)',
        start_date: '2026-09-15',
        end_date: null,
        type: 'Prova',
        topics: JSON.stringify(['Metabolismo de carboidratos - Glicólise', 'Sinalização hormonal'])
      },
      {
        title: '1ª Avaliação de Fisiologia (Cardiovascular)',
        module_or_subject: 'Fisiologia Humana (CHS II)',
        start_date: '2026-09-18',
        end_date: null,
        type: 'Prova',
        topics: JSON.stringify(['Fisiologia Cardiovascular', 'Ciclo cardíaco', 'Hemodinâmica', 'Eletrofisiologia e ECG'])
      },
      {
        title: 'Fórum Corpo Humano Saudável Integrador 1',
        module_or_subject: 'Módulo Integrador II',
        start_date: '2026-09-19',
        end_date: null,
        type: 'Fórum',
        topics: JSON.stringify(['Integração Básica-Clínica', 'Discussão temática de casos de Anatomia, Fisiologia e Bioquímica'])
      },

      // Outubro / 2026
      {
        title: '1ª Avaliação Teórica de Histologia',
        module_or_subject: 'Histologia e Embriologia (CHS II)',
        start_date: '2026-10-05',
        end_date: null,
        type: 'Prova',
        topics: JSON.stringify(['Tecidos dos sistemas Circulatório e Respiratório'])
      },
      {
        title: '1ª Avaliação Prática de Histologia',
        module_or_subject: 'Histologia e Embriologia (CHS II)',
        start_date: '2026-10-06',
        end_date: '2026-10-08',
        type: 'Prova',
        topics: JSON.stringify(['Lâminas histológicas de Circulatório e Respiratório no laboratório'])
      },
      {
        title: 'Avaliação Teórica de Fisiologia (Respiratório)',
        module_or_subject: 'Fisiologia Humana (CHS II)',
        start_date: '2026-10-13',
        end_date: null,
        type: 'Prova',
        topics: JSON.stringify(['Mecânica ventilatória', 'Trocas gasosas alvéolo-capilares', 'Controle central da respiração'])
      },
      {
        title: 'Fórum Corpo Humano Saudável Integrador 2',
        module_or_subject: 'Módulo Integrador II',
        start_date: '2026-10-17',
        end_date: null,
        type: 'Fórum',
        topics: JSON.stringify(['Integração dos sistemas respiratório e circulatório com abordagem clínica'])
      },
      {
        title: 'Avaliação N2 de Bioquímica',
        module_or_subject: 'Bioquímica (CHS II)',
        start_date: '2026-10-20',
        end_date: null,
        type: 'Prova',
        topics: JSON.stringify(['Metabolismo de lipídeos', 'Beta-oxidação', 'Síntese de colesterol e lipoproteínas'])
      },
      {
        title: 'Apresentação do Caso Clínico Integrador 1',
        module_or_subject: 'Módulo Integrador II',
        start_date: '2026-10-23',
        end_date: null,
        type: 'Apresentação',
        topics: JSON.stringify(['Apresentação oral e discussão de caso clínico multidisciplinar'])
      },
      {
        title: 'Avaliação N2 de Fisiologia',
        module_or_subject: 'Fisiologia Humana (CHS II)',
        start_date: '2026-10-30',
        end_date: null,
        type: 'Prova',
        topics: JSON.stringify(['Fisiologia do Sistema Digestório', 'Fisiologia do Sistema Respiratório'])
      },

      // Novembro / 2026
      {
        title: 'Prova Presencial do Caso Clínico Integrador',
        module_or_subject: 'Módulo Integrador II',
        start_date: '2026-11-06',
        end_date: null,
        type: 'Prova',
        topics: JSON.stringify(['Avaliação escrita sobre os Casos Clínicos Integradores do semestre'])
      },
      {
        title: 'Apresentação de Seminários de Anatomia',
        module_or_subject: 'Anatomia Humana (CHS II)',
        start_date: '2026-11-17',
        end_date: '2026-11-19',
        type: 'Seminário',
        topics: JSON.stringify(['Apresentação dos temas integrados de anatomia para a turma'])
      },
      {
        title: 'Avaliação N3 de Bioquímica',
        module_or_subject: 'Bioquímica (CHS II)',
        start_date: '2026-11-24',
        end_date: null,
        type: 'Prova',
        topics: JSON.stringify(['Regulação e integração do metabolismo', 'Fosforilação oxidativa', 'Estado alimentado e jejum'])
      },
      {
        title: 'Avaliação Teórico-Prática N2 de Anatomia (Sensorial)',
        module_or_subject: 'Anatomia Humana (CHS II)',
        start_date: '2026-11-24',
        end_date: '2026-11-26',
        type: 'Prova',
        topics: JSON.stringify(['Sistema Sensorial', 'Olho', 'Orelha', 'Vias sensoriais e peças práticas'])
      },
      {
        title: '2ª Avaliação Teórica de Histologia',
        module_or_subject: 'Histologia e Embriologia (CHS II)',
        start_date: '2026-11-30',
        end_date: null,
        type: 'Prova',
        topics: JSON.stringify(['Tecidos dos sistemas Digestório, Urinário e Reprodutor'])
      },

      // Dezembro / 2026
      {
        title: 'Avaliação de Fisiologia (Digestório e Renal)',
        module_or_subject: 'Fisiologia Humana (CHS II)',
        start_date: '2026-12-01',
        end_date: null,
        type: 'Prova',
        topics: JSON.stringify(['Fisiologia do Sistema Digestório e Fisiologia Renal'])
      },
      {
        title: '2ª Avaliação Prática de Histologia',
        module_or_subject: 'Histologia e Embriologia (CHS II)',
        start_date: '2026-12-01',
        end_date: '2026-12-03',
        type: 'Prova',
        topics: JSON.stringify(['Identificação de lâminas de Digestório, Renal e Reprodutor'])
      },
      {
        title: 'Avaliação N4 de Bioquímica (Teatro Metabólico)',
        module_or_subject: 'Bioquímica (CHS II)',
        start_date: '2026-12-05',
        end_date: null,
        type: 'Apresentação',
        topics: JSON.stringify(['Teatro Metabólico: integração lúdica e científica das vias metabólicas'])
      },
      {
        title: 'Avaliações de Recuperação do CHS',
        module_or_subject: 'Módulo CHS II',
        start_date: '2026-12-07',
        end_date: '2026-12-10',
        type: 'Recuperação',
        topics: JSON.stringify(['Recuperação final de Anatomia, Bioquímica, Fisiologia e Histologia'])
      },
      {
        title: 'Prova Final de Introdução ao Método Clínico II',
        module_or_subject: 'Introdução ao Método Clínico II',
        start_date: '2026-12-11',
        end_date: null,
        type: 'Prova',
        topics: JSON.stringify(['Prova Final abrangente de Semiologia Médica, Imagenologia e Prática Clínica'])
      }
    ];

    await db.transaction(async (tx) => {
      const insertEvent = tx.prepare(`
        INSERT INTO events (user_id, title, module_or_subject, start_date, end_date, type, topics, is_custom)
        VALUES (NULL, ?, ?, ?, ?, ?, ?, 0)
      `);
      for (const ev of eventsData) {
        await insertEvent.run(ev.title, ev.module_or_subject, ev.start_date, ev.end_date, ev.type, ev.topics);
      }
    });
    console.log('Pre-registered Events 2026.2 successfully inserted!');
  }

  // Eventos adicionados depois do seed inicial (bancos já populados)
  const hasFisioN2 = (await db.prepare(`SELECT count(*) as count FROM events WHERE user_id IS NULL AND title = 'Avaliação N2 de Fisiologia'`).get()).count;
  if (hasFisioN2 === 0 && !(await seededOnce('seed_fisio_n2'))) {
    await db.prepare(`
      INSERT INTO events (user_id, title, module_or_subject, start_date, end_date, type, topics, is_custom)
      VALUES (NULL, ?, ?, ?, NULL, 'Prova', ?, 0)
    `).run(
      'Avaliação N2 de Fisiologia',
      'Fisiologia Humana (CHS II)',
      '2026-10-30',
      JSON.stringify(['Fisiologia do Sistema Digestório', 'Fisiologia do Sistema Respiratório'])
    );
  }

  // Pre-seed Weekly Schedule (Aba 1): substitui as aulas padrão antigas pelo horário real (uma única vez)
  const hasRealSchedule = (await db.prepare(`SELECT count(*) as count FROM classes WHERE user_id IS NULL AND subject_name = 'Semiologia'`).get()).count;
  if (hasRealSchedule === 0 && !(await seededOnce('seed_real_schedule'))) {
    console.log('Seeding Pre-registered Weekly Schedule (Aba 1)...');
    await db.prepare(`DELETE FROM classes WHERE user_id IS NULL`).run();

    const CAA = 'Centro de Aulas Aroeira - CAA - UFG';
    const ICB3 = 'Instituto de Ciências Biológicas III';
    const FM = 'Faculdade de Medicina - FM/UFG';
    const defaultClasses = [
      // Segunda-feira
      { day: 1, start: '08:00', end: '09:40', subject: 'Fisiologia', room: `CAA 107 • ${CAA}`, type: 'Teórica', color: 'emerald' },
      { day: 1, start: '10:00', end: '11:40', subject: 'Histologia', room: `ICB3 Auditório • ${ICB3}`, type: 'Teórica', color: 'emerald' },
      { day: 1, start: '11:40', end: '12:30', subject: 'Anatomia', room: `ICB3 Auditório • ${ICB3}`, type: 'Teórica', color: 'emerald' },
      { day: 1, start: '14:00', end: '17:40', subject: 'SFC', room: '', type: 'Teórica', color: 'amber' },
      // Terça-feira
      { day: 2, start: '08:00', end: '09:40', subject: 'Bioquímica', room: `CAB 107 • ${ICB3}`, type: 'Teórica', color: 'emerald' },
      { day: 2, start: '10:00', end: '11:40', subject: 'Histologia', room: `ICB3 Lab. 204 • ${ICB3}`, type: 'Prática', color: 'emerald' },
      { day: 2, start: '13:10', end: '17:40', subject: 'Anatomia', room: `ICB3 Lab. 2 • ${ICB3}`, type: 'Prática', color: 'emerald' },
      // Quarta-feira
      { day: 3, start: '07:10', end: '09:40', subject: 'Fisiologia', room: 'CAA 107', type: 'Teórica', color: 'emerald' },
      // Quinta-feira
      { day: 4, start: '08:00', end: '09:40', subject: 'Bioquímica', room: `CAB 107 • ${ICB3}`, type: 'Teórica', color: 'emerald' },
      { day: 4, start: '10:00', end: '11:40', subject: 'Histologia', room: `ICB3 Lab. 204 • ${ICB3}`, type: 'Prática', color: 'emerald' },
      // Sexta-feira
      { day: 5, start: '07:10', end: '08:50', subject: 'Imagenologia', room: FM, type: 'Teórica', color: 'amber' },
      { day: 5, start: '08:50', end: '11:40', subject: 'Semiologia', room: FM, type: 'Teórica', color: 'amber' },
      { day: 5, start: '14:00', end: '18:30', subject: 'IMC', room: FM, type: 'Prática', color: 'amber' }
    ];

    await db.transaction(async (tx) => {
      const insertClass = tx.prepare(`
        INSERT INTO classes (user_id, day_of_week, start_time, end_time, subject_name, room, teacher, type, color)
        VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const c of defaultClasses) {
        await insertClass.run(c.day, c.start, c.end, c.subject, c.room, null, c.type, c.color);
      }
    });
    console.log('Pre-registered Schedule successfully inserted!');
  }
}

module.exports = {
  db,
  initDatabase
};

