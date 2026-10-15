# 🩺 Med Planner by João

Plataforma Web totalmente responsiva e moderna de planejamento acadêmico para o curso de Medicina (Semestre 2026.2 - UFG), inspirada na linguagem visual e de animações do **[shadcn/ui](https://ui.shadcn.com/)**.

---

## 🚀 Como Iniciar o Projeto

### Pré-requisitos
* Node.js v20+ instalado (testado com Node v24)
* Navegador moderno

### Iniciar o Ambiente de Desenvolvimento
No terminal, dentro da pasta do projeto (`C:\Users\Jhon\.gemini\antigravity\scratch\med-planner`):

```bash
# Inicia tanto o Backend (porta 5000) quanto o Frontend Vite (porta 5173) simultaneamente:
npm run dev
```

Abra no navegador:
* **Local (PC):** [http://localhost:5173/](http://localhost:5173/)
* **Na rede local (Celular/Tablet):** acesse pelo IP da sua rede (ex: `http://192.168.1.19:5173/`)

---

## 🔑 Credenciais Pré-configuradas

O sistema já vem com banco de dados SQLite (`server/medplanner.db`) populado com todas as cargas do Semestre 2026.2 e contas de acesso rápido:

| Tipo | E-mail | Senha | Função |
| :--- | :--- | :--- | :--- |
| **Aluno (João)** | `joao@medplanner.com` | `aluno123` | Acesso completo às 4 abas e edição de estudos |
| **Administrador** | `admin@medplanner.com` | `admin123` | Dashboard Admin exclusivo, métricas e gestão de usuários |

*(Na tela de login, você pode clicar nos botões de "Acesso Rápido" para entrar com 1 clique).*

---

## 📱 Estrutura e Funcionalidades

### 1. Sistema de Acesso e Perfis (Admin x Aluno)
* **Login Seguro & Cadastro de Primeiro Acesso:** Coleta nome, e-mail, senha, telefone e upload de foto de perfil com preview e armazenamento local.
* **Painel do Administrador (Dashboard Admin):**
  * Indicadores em tempo real: Total de Alunos, Eventos 2026.2, Disciplinas e Tópicos.
  * Tabela completa de estudantes com foto, contato, nível de acesso e contagem de tópicos concluídos.
  * Ferramentas para editar dados cadastrais, alterar papéis (`student` ou `admin`), redefinir senhas e excluir usuários.

### 2. Aba 1 — Agenda Semanal
* Grade de horários com seletor de dias da semana (Segunda a Sábado).
* Cards com horários de aula, sala/laboratório, professor/preceptor e badges de tipo (`Teórica`, `Prática`, `TBL`, `Seminário`).
* Modal interativo para adicionar, editar ou excluir aulas.

### 3. Aba 2 — Eventos Importantes & Prazos
* Foco exclusivo em provas, seminários, TBLs e fóruns do semestre 2026.2.
* **Contagem Regressiva Inteligente:** "Faltam X dias", "Amanhã!" ou "Hoje! Boa prova!".
* **Barra de Progresso Dinâmica:** Preenchimento visual suave conforme a data da avaliação se aproxima.
* **Pop-up de Conteúdo Programático:** Clique no card para abrir o modal com a lista exata dos tópicos cobrados na prova.
* **Autonomia do Aluno:** Botão para remarcar datas e editar assuntos caso haja greves ou ajustes no calendário da faculdade.

### 4. Aba 3 — Cálculo de Notas (Regras Oficiais UFG)
* **Corpo Humano Saudável II (CHS II):**
  * Anatomia: N1 (Prova + Participação) e N2 (Prova + Participação + Seminário).
  * Bioquímica: 4 avaliações (N1, N2, N3 e N4).
  * Fisiologia: 1ª Avaliação (peso 3,5), 2ª Avaliação (peso 4,0), 3ª Avaliação (peso 2,5).
  * Histologia: Média de 4 provas + até 0,5 ponto extra de atividades práticas.
  * Média Geométrica das 4 disciplinas × Média Aritmética do Módulo Integrador.
* **Introdução ao Método Clínico II (IMC II):**
  * `M1`: Média geométrica de 6 notas Role Play e 2 notas HC.
  * `M2`: Média geométrica de 6 TBLs (70% indiv + 30% grupo) e 6 Casos Clínicos.
  * `Média Final (MF)` = `(M1 × 0,25) + (M2 × 0,25) + (Prova Final × 0,50)`.
  * **Projeção de Aprovação:** Calcula em tempo real quanto você precisa tirar na Prova Final para passar com média >= 6,0.
* **Módulo Integrador II:**
  * Média aritmética dos Fóruns Integradores 1 e 2 e Prova Presencial do Caso Clínico.
* Botão para **salvar notas** no banco de dados SQLite individual do aluno.

### 5. Aba 4 — Matérias do Semestre & Checklist Interativo
* Cards de disciplinas com progresso percentual individual e anel de conclusão.
* Barra de progresso geral do Semestre 2026.2 (111 tópicos mapeados).
* Checklist hierárquico com acordeão por assunto e subassuntos detalhados.
* Efeito de **confetes comemorativos** ao concluir tópicos e salvar o progresso automaticamente no banco de dados.
* **CRUD Completo do Aluno:** Permite criar novas matérias, novos assuntos e novos subassuntos, além de editar e excluir qualquer item.

---

## 🎨 Design e UI
* **Base shadcn/ui:** Design tokens com CSS variables, suporte total a **Modo Escuro / Modo Claro**, tipografia Inter e cantos arredondados modernos (`rounded-2xl`).
* **Responsividade Extrema:**
  * No Desktop: Sidebar lateral elegante com navegação rápida.
  * No Mobile: Bottom Navigation Bar ergonômica com badges e toques otimizados.

