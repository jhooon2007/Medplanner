// Chamada à API com tratamento de erro padronizado (lança Error com a mensagem do servidor).
export async function api<T = any>(
  token: string | null,
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const text = await res.text()
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch (e) {}

  if (!res.ok) {
    throw new Error(data.error || `Erro ${res.status} ao falar com o servidor.`)
  }
  return data as T
}

// Datas do SQLite (CURRENT_TIMESTAMP) vêm em UTC no formato "YYYY-MM-DD HH:MM:SS".
export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : '—'
}
