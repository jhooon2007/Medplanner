process.env.DISABLE_SERVER_LISTEN = '1'; // prevent default app.listen()

const app = require('./index');
const { db } = require('./db');
const http = require('http');

async function runE2ETests() {
  console.log('=== TESTE DE INTEGRACAO END-TO-END DO ONBOARDING & BANCO DE DADOS ===\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[1] Servidor de teste iniciado na porta dinamica ${port}`);

  function makeRequest(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const reqHeaders = { ...headers };
      let payload = null;
      if (body) {
        payload = JSON.stringify(body);
        reqHeaders['Content-Type'] = 'application/json';
        reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = http.request(url, { method, headers: reqHeaders }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, headers: res.headers, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, body: data });
          }
        });
      });

      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  const testEmail = `test.aluno.${Date.now()}@medicina.ufg.br`;
  const testPassword = 'Password123!';
  let userToken = null;
  let userId = null;

  try {
    // 1. Cadastrar novo aluno
    console.log('[2] Cadastrando novo aluno sem dados de onboarding preenchidos...');
    const regRes = await makeRequest('POST', '/api/auth/register', {
      name: 'Estudante Teste UFG',
      email: testEmail,
      password: testPassword
    });

    if (regRes.status !== 201 && regRes.status !== 200) {
      throw new Error(`Falha no registro: HTTP ${regRes.status} - ${JSON.stringify(regRes.body)}`);
    }

    userToken = regRes.body.token;
    userId = regRes.body.user.id;
    console.log(`   -> Aluno registrado com ID ${userId}. Status onboarding: ${regRes.body.user.onboarding_completed}`);
    if (regRes.body.user.onboarding_completed !== 0) {
      throw new Error('Onboarding deveria ser 0 (pendente) no registro inicial');
    }
    console.log('   [OK] Aluno novo entra corretamente com onboarding pendente.');

    // 2. Tentar onboarding com dados invalidos (ex: semestre 99)
    console.log('\n[3] Testando validacao estrita: envio de semestre invalido (99)...');
    const invalidRes = await makeRequest('POST', '/api/auth/onboarding', {
      name: 'Estudante Teste UFG',
      email: testEmail,
      phone: '(62) 98888-1234',
      birth_date: '2004-05-10',
      current_semester: 99
    }, { Authorization: `Bearer ${userToken}` });

    if (invalidRes.status !== 400) {
      throw new Error(`Deveria ter retornado HTTP 400 para semestre invalido, retornou ${invalidRes.status}`);
    }
    console.log(`   [OK] Rejeicao esperada: "${invalidRes.body.error}"`);

    // 3. Tentar onboarding faltando data de nascimento
    console.log('\n[4] Testando validacao estrita: falta da data de nascimento...');
    const missingDateRes = await makeRequest('POST', '/api/auth/onboarding', {
      name: 'Estudante Teste UFG',
      email: testEmail,
      phone: '(62) 98888-1234',
      current_semester: 3
    }, { Authorization: `Bearer ${userToken}` });

    if (missingDateRes.status !== 400) {
      throw new Error(`Deveria ter retornado HTTP 400 para data de nascimento ausente, retornou ${missingDateRes.status}`);
    }
    console.log(`   [OK] Rejeicao esperada: "${missingDateRes.body.error}"`);

    // 4. Enviar Onboarding Completo e Valido
    console.log('\n[5] Enviando questionario obrigatorio de onboarding completo...');
    const validRes = await makeRequest('POST', '/api/auth/onboarding', {
      name: 'Estudante Teste UFG',
      email: testEmail,
      phone: '(62) 98888-1234',
      birth_date: '2004-05-10',
      current_semester: 3 // 3º Semestre -> Ciclo Básico
    }, { Authorization: `Bearer ${userToken}` });

    if (validRes.status !== 200) {
      throw new Error(`Falha ao salvar onboarding: HTTP ${validRes.status} - ${JSON.stringify(validRes.body)}`);
    }

    console.log('   -> Resposta do servidor:', validRes.body);
    if (!validRes.body.user || validRes.body.user.onboarding_completed !== 1) {
      throw new Error('Onboarding deveria estar marcado como concluido (1)');
    }
    console.log('   [OK] Onboarding finalizado com sucesso no backend.');

    // 5. Verificar persistencia no SQLite
    console.log('\n[6] Verificando persistencia direta no banco de dados SQLite...');
    const dbRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    console.log('   -> Registro no SQLite:', {
      id: dbRow.id,
      name: dbRow.name,
      email: dbRow.email,
      phone: dbRow.phone,
      birth_date: dbRow.birth_date,
      current_semester: dbRow.current_semester,
      onboarding_completed: dbRow.onboarding_completed
    });

    if (
      dbRow.name !== 'Estudante Teste UFG' ||
      dbRow.email !== testEmail ||
      dbRow.phone !== '(62) 98888-1234' ||
      dbRow.birth_date !== '2004-05-10' ||
      dbRow.current_semester !== 3 ||
      dbRow.onboarding_completed !== 1
    ) {
      throw new Error('Inconsistencia nos dados persistidos no banco de dados!');
    }
    console.log('   [OK] Dados persistidos e estruturados no SQLite com 100% de integridade.');

    // 6. Testar endpoint /api/auth/me
    console.log('\n[7] Verificando retorno de /api/auth/me com token JWT...');
    const meRes = await makeRequest('GET', '/api/auth/me', null, { Authorization: `Bearer ${userToken}` });
    if (meRes.status !== 200) {
      throw new Error(`Falha no /api/auth/me: HTTP ${meRes.status}`);
    }
    if (
      meRes.body.user.birth_date !== '2004-05-10' ||
      meRes.body.user.current_semester !== 3 ||
      meRes.body.user.onboarding_completed !== 1
    ) {
      throw new Error('Campos de onboarding ausentes no retorno de /api/auth/me');
    }
    console.log('   [OK] /api/auth/me retorna todos os campos de onboarding com sucesso.');

    // 7. Testar no Painel de Admin
    console.log('\n[8] Verificando visibilidade do usuario no Painel de Administrador (/api/admin/users)...');
    const adminLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'admin@medplanner.com',
      password: 'MedPlanner#2026!Admin'
    });
    if (adminLoginRes.status !== 200) {
      throw new Error('Falha ao autenticar administrador');
    }
    const adminToken = adminLoginRes.body.token;

    const adminUsersRes = await makeRequest('GET', '/api/admin/users', null, {
      Authorization: `Bearer ${adminToken}`
    });
    if (adminUsersRes.status !== 200) {
      throw new Error('Falha ao listar usuarios no painel admin');
    }
    const listedUser = adminUsersRes.body.users.find(u => u.id === userId);
    if (!listedUser) {
      throw new Error('Novo usuario nao encontrado na listagem do painel admin');
    }
    console.log('   -> Usuario localizado no Admin:', {
      id: listedUser.id,
      name: listedUser.name,
      birth_date: listedUser.birth_date,
      current_semester: listedUser.current_semester,
      onboarding_completed: listedUser.onboarding_completed
    });
    console.log('   [OK] Painel admin exibe todos os dados estruturados de onboarding do usuario.');

  } finally {
    // Limpeza de seguranca: deletar usuario de teste para manter apenas contas reais
    if (userId) {
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      console.log(`\n[9] Limpeza efetuada: Usuario de teste temporario ${userId} removido. Apenas contas reais no banco.`);
    }
    server.close();
  }

  console.log('\n=== TODOS OS 8 TESTES END-TO-END PASSARAM COM EXATAMENTE ZERO ERROS! ===');
}

runE2ETests().catch(err => {
  console.error('\n[ERRO NO TESTE]:', err);
  process.exit(1);
});
