# 🩺 Med Planner

Plataforma Web moderna e responsiva de planejamento acadêmico para o curso de Medicina, inspirada na linguagem visual e de design do **[shadcn/ui](https://ui.shadcn.com/)**.

---

## 🚀 Como Iniciar o Projeto

### Pré-requisitos
* Node.js v20+ instalado (testado com Node v24)
* Navegador moderno

### Iniciar o Ambiente de Desenvolvimento
No terminal, dentro da pasta do projeto:

```bash
# Inicia tanto o Backend (porta 5000) quanto o Frontend Vite (porta 5173) simultaneamente:
npm run dev
```

Abra no navegador:
* **Local (PC):** [http://localhost:5173/](http://localhost:5173/)
* **Na rede local (Celular/Tablet):** acesse pelo IP da sua rede (ex: `http://192.168.1.X:5173/`)

---

## 🔒 Autenticação e Acesso

A plataforma conta com proteção de rotas e autenticação obrigatória:
* **Login com Google:** O servidor valida o token direto com o Google (o navegador não escolhe o e-mail).
* **Cadastro de Estudante:** Criação de conta individual com e-mail, senha, telefone e foto de perfil.
* **Perfil de Administrador:** Painel com dados reais dos alunos, avisos gerais e provas da turma (ver abaixo). O e-mail e a senha do administrador vêm das variáveis `ADMIN_EMAIL` e `ADMIN_PASSWORD`.

### 🛠️ Painel de Administração
* **Alunos:** lista de todos que criaram conta, com período, telefone, último acesso, notas lançadas e progresso por matéria.
* **Avisos gerais:** publique mensagens que aparecem no topo do app de todos os alunos (ex.: "Não haverá aula na terça"). Dá para ocultar, definir data para sumir e marcar como urgente.
* **Provas da turma:** crie, remarque ou remova provas para todos de uma vez. Eventos que os alunos criaram por conta própria não são alterados.

---

## ⚙️ Configuração

Copie `.env.example` e preencha as variáveis. Em produção (Vercel) o banco precisa ser persistente: use o [Turso](https://turso.tech) (`TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`). Sem isso o app não sobe na Vercel, pois o disco da função é apagado a cada reinício.

```bash
npm test   # testes de integração da API (usam um banco temporário)
```

---

## 📱 Estrutura e Funcionalidades

### 1. Sistema Dinâmico de Semestres (Multi-período)
* **Seletor de Semestre:** Navegue entre o 1º e o 12º período da faculdade (Ciclo Básico, Ciclo Clínico e Internato).
* **Gestão de Períodos:** Cadastre novos semestres e organize as matérias e provas conforme você avança no curso.

### 2. Agenda Semanal
* Grade de horários com seletor de dias da semana (Segunda a Sábado), ordenada de cima para baixo por horário.
* Cards com horários de aula, sala/laboratório e badges de modalidade (`Teórica`, `Prática`, `TBL`, `Seminário`).
* Modal interativo para adicionar, editar ou excluir aulas.

### 3. Eventos Importantes & Prazos
* Foco em provas, seminários, TBLs e entregas de trabalhos.
* **Contagem Regressiva Inteligente:** "Faltam X dias", "Amanhã!" ou "Hoje! Boa prova!".
* **Barra de Progresso Dinâmica:** Preenchimento visual suave conforme a data da avaliação se aproxima.
* **Pop-up de Conteúdo Programático:** Lista exata dos tópicos cobrados na prova.

### 4. Cálculo de Notas & Médias
* Fórmulas oficiais acadêmicas com médias geométricas e ponderadas.
* Projeção em tempo real de aprovação e nota necessária para a prova final.
* Sincronização automática com armazenamento local e banco de dados.

### 5. Matérias & Checklist Interativo
* Cards de disciplinas organizadas por semestre.
* Barra de progresso geral por período selecionado.
* Checklist hierárquico com acordeão por assunto e subassuntos detalhados.
* Efeito comemorativo ao concluir tópicos e salvar o progresso automaticamente.
* Autonomia total para adicionar, editar e excluir matérias e conteúdos programáticos.

---

## 🎨 Design e UI
* **Base shadcn/ui:** Design tokens com CSS variables, suporte total a **Modo Escuro / Modo Claro**, tipografia Inter e cantos arredondados modernos (`rounded-2xl`).
* **Responsividade Extrema:**
  * No Desktop: Sidebar lateral elegante com navegação rápida.
  * No Mobile: Bottom Navigation Bar ergonômica com badges e toques otimizados.
