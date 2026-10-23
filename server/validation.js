// Validação de entrada das rotas. Um ValidationError vira resposta 400 com a mensagem para o usuário.

class ValidationError extends Error {}

const fail = (message) => { throw new ValidationError(message); };

// Texto obrigatório (ou opcional) com limite de tamanho; devolve o valor sem espaços nas pontas.
function text(value, label, { max = 200, required = true, min = 1 } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) fail(`${label} é obrigatório.`);
    return null;
  }
  if (typeof value !== 'string') fail(`${label} precisa ser um texto.`);
  const trimmed = value.trim();
  if (required && trimmed.length < min) {
    fail(min > 1 ? `${label} precisa ter pelo menos ${min} caracteres.` : `${label} é obrigatório.`);
  }
  if (trimmed.length > max) fail(`${label} pode ter no máximo ${max} caracteres.`);
  return trimmed || null;
}

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Data no formato AAAA-MM-DD (o que os campos de data do navegador enviam)
function date(value, label, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) fail(`${label} é obrigatória.`);
    return null;
  }
  if (!isDate(value)) fail(`${label} inválida. Use o formato AAAA-MM-DD.`);
  return value;
}

function time(value, label) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    fail(`${label} inválido. Use o formato HH:MM.`);
  }
  return value;
}

function email(value) {
  const v = text(value, 'E-mail', { max: 254 });
  const normalized = v.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) fail('E-mail inválido.');
  return normalized;
}

function password(value, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) fail('A senha é obrigatória.');
    return null;
  }
  if (typeof value !== 'string') fail('Senha inválida.');
  if (value.length < 6) fail('A senha deve ter pelo menos 6 caracteres.');
  if (value.length > 128) fail('A senha pode ter no máximo 128 caracteres.');
  return value;
}

function integer(value, label, { min, max }) {
  const n = typeof value === 'number' ? value : parseInt(value, 10);
  if (!Number.isInteger(n) || n < min || n > max) fail(`${label} deve ser um número entre ${min} e ${max}.`);
  return n;
}

function semester(value, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) fail('Período acadêmico é obrigatório.');
    return null;
  }
  return integer(value, 'Período acadêmico', { min: 1, max: 12 });
}

function oneOf(value, allowed, label, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (!allowed.includes(value)) fail(`${label} inválido.`);
  return value;
}

// Lista de tópicos de prova: só textos (objetos quebrariam a tela de eventos)
function topicList(value) {
  if (value === undefined || value === null || value === '') return [];
  const list = Array.isArray(value) ? value : [value];
  if (list.length > 100) fail('No máximo 100 tópicos por evento.');
  return list.map(t => text(t, 'Cada tópico', { max: 300 })).filter(Boolean);
}

module.exports = {
  ValidationError, text, date, time, email, password, integer, semester, oneOf, topicList, isDate,
};
