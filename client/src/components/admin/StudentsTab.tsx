import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { Progress } from '@/components/ui/Progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { useAuth } from '@/context/AuthContext'
import { User } from '@/types'
import { api, formatDate, formatDateTime } from '@/lib/api'
import { Search, UserPlus, Edit, Trash2, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  users: User[]
  loading: boolean
  reload: () => Promise<void>
  notify: (msg: string, isErr?: boolean) => void
}

const emptyForm = {
  name: '', email: '', phone: '', birth_date: '', current_semester: 1,
  role: 'student' as 'student' | 'admin', password: '',
}

interface Details {
  user: User
  grades: Array<{ module: string; item_key: string; score: number }>
  progress: Array<{ subject_id: number; subject_name: string; total: number; completed: number }>
  events: Array<{ id: number; title: string; module_or_subject: string; start_date: string; type: string }>
}

export const StudentsTab: React.FC<Props> = ({ users, loading, reload, notify }) => {
  const { token, user: currentUser } = useAuth()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'admin'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [details, setDetails] = useState<Details | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  useEffect(() => { if (!formOpen) setSaving(false) }, [formOpen])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return users.filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (!term) return true
      return u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term) || (u.phone || '').includes(term)
    })
  }, [users, search, roleFilter])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (u: User) => {
    setEditing(u)
    setForm({
      name: u.name, email: u.email, phone: u.phone || '', birth_date: u.birth_date || '',
      current_semester: u.current_semester || 1, role: u.role, password: '',
    })
    setFormOpen(true)
  }

  const openDetails = async (u: User) => {
    setDetails({ user: u, grades: [], progress: [], events: [] })
    setDetailsLoading(true)
    try {
      setDetails(await api<Details>(token, `/api/admin/users/${u.id}/details`))
    } catch (err: any) {
      notify(err.message, true)
      setDetails(null)
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await api(token, `/api/admin/users/${editing.id}`, { method: 'PUT', body: form })
        notify('Dados do usuário atualizados!')
      } else {
        await api(token, '/api/admin/users', { method: 'POST', body: form })
        notify('Usuário cadastrado com sucesso!')
      }
      setFormOpen(false)
      await reload()
    } catch (err: any) {
      notify(err.message, true)
      setSaving(false)
    }
  }

  const handleDelete = async (u: User) => {
    if (!window.confirm(`Excluir ${u.name}? Todas as notas, eventos e progresso dessa conta serão apagados.`)) return
    try {
      await api(token, `/api/admin/users/${u.id}`, { method: 'DELETE' })
      notify('Usuário removido.')
      await reload()
    } catch (err: any) {
      notify(err.message, true)
    }
  }

  const filterBtn = (id: typeof roleFilter, label: string, count: number) => (
    <button
      onClick={() => setRoleFilter(id)}
      className={cn(
        'px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer',
        roleFilter === id ? 'bg-white dark:bg-slate-700 shadow-sm font-bold text-blue-600' : 'text-slate-500'
      )}
    >
      {label} ({count})
    </button>
  )

  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Alunos e Usuários</CardTitle>
            <CardDescription>
              Todos que criaram conta no app, com período, último acesso e uso. Os dados vêm direto do banco.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs">
              {filterBtn('all', 'Todos', users.length)}
              {filterBtn('student', 'Alunos', users.filter(u => u.role === 'student').length)}
              {filterBtn('admin', 'Admins', users.filter(u => u.role === 'admin').length)}
            </div>
            <div className="relative w-full sm:w-60">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Buscar por nome, e-mail..." value={search}
                onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-xs" />
            </div>
            <Button onClick={openCreate} size="sm" className="h-8 text-xs gap-1">
              <UserPlus className="h-3.5 w-3.5" />
              Novo
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Carregando alunos...</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {users.length === 0 ? 'Ainda não há usuários cadastrados.' : 'Nenhum usuário encontrado com esse filtro.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Contato</th>
                  <th className="px-4 py-3">Cadastro</th>
                  <th className="px-4 py-3">Último acesso</th>
                  <th className="px-4 py-3 text-center">Notas</th>
                  <th className="px-4 py-3 text-center">Tópicos</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar src={u.photo_url} fallback={u.name} size="sm" />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                            {u.name}
                            {u.role === 'admin' && <Badge variant="blue" className="text-[10px]">Admin</Badge>}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate font-mono">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {u.current_semester
                        ? `${u.current_semester}º semestre`
                        : <Badge variant="warning" className="text-[10px]">Não informado</Badge>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{u.phone || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDateTime(u.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDateTime(u.last_login_at)}</td>
                    <td className="px-4 py-3 text-center font-mono">{u.grades_filled_count || 0}</td>
                    <td className="px-4 py-3 text-center font-mono">{u.completed_subtopics_count || 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => openDetails(u)} aria-label="Ver detalhes">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(u)} aria-label="Editar usuário">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        {u.id !== currentUser?.id && (
                          <Button variant="outline" size="sm" onClick={() => handleDelete(u)} aria-label="Excluir usuário"
                            className="text-rose-600 hover:text-rose-700">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Criar / editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent onClose={() => setFormOpen(false)}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar usuário' : 'Cadastrar novo usuário'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Deixe a senha em branco para mantê-la.' : 'A conta já nasce com o questionário inicial concluído.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome</label>
              <Input required value={form.name} className="mt-1" onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">E-mail</label>
              <Input required type="email" value={form.email} className="mt-1" onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Telefone</label>
                <Input value={form.phone} className="mt-1" onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nascimento</label>
                <Input type="date" value={form.birth_date} className="mt-1" onChange={e => setForm({ ...form, birth_date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Período</label>
                <select value={form.current_semester}
                  onChange={e => setForm({ ...form, current_semester: parseInt(e.target.value, 10) })}
                  className="mt-1 flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}º semestre</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Perfil</label>
                <select value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value as 'student' | 'admin' })}
                  disabled={editing?.id === currentUser?.id}
                  className="mt-1 flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  <option value="student">Aluno</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {editing ? 'Nova senha (opcional)' : 'Senha'}
              </label>
              <Input type="password" minLength={6} required={!editing} value={form.password} className="mt-1"
                placeholder="Mínimo de 6 caracteres"
                onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detalhes do aluno */}
      <Dialog open={Boolean(details)} onOpenChange={open => { if (!open) setDetails(null) }}>
        <DialogContent className="max-w-2xl" onClose={() => setDetails(null)}>
          {details && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar src={details.user.photo_url} fallback={details.user.name} size="lg" />
                  <div className="min-w-0">
                    <DialogTitle className="truncate">{details.user.name}</DialogTitle>
                    <DialogDescription className="truncate">{details.user.email}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-5">
                <Info label="Período" value={details.user.current_semester ? `${details.user.current_semester}º semestre` : '—'} />
                <Info label="Telefone" value={details.user.phone || '—'} />
                <Info label="Nascimento" value={formatDate(details.user.birth_date)} />
                <Info label="Último acesso" value={formatDateTime(details.user.last_login_at)} />
              </div>

              {detailsLoading ? (
                <p className="text-sm text-slate-500 py-6 text-center">Carregando...</p>
              ) : (
                <div className="space-y-5">
                  <section>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Progresso por matéria</h4>
                    <div className="space-y-2.5">
                      {details.progress.map(p => {
                        const pct = p.total ? Math.round((p.completed / p.total) * 100) : 0
                        return (
                          <div key={p.subject_id}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium text-slate-700 dark:text-slate-200">{p.subject_name}</span>
                              <span className="font-mono text-slate-500">{p.completed}/{p.total} ({pct}%)</span>
                            </div>
                            <Progress value={pct} />
                          </div>
                        )
                      })}
                      {details.progress.length === 0 && <p className="text-xs text-slate-500">Sem matérias.</p>}
                    </div>
                  </section>

                  <section>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Notas lançadas ({details.grades.length})
                    </h4>
                    {details.grades.length === 0 ? (
                      <p className="text-xs text-slate-500">O aluno ainda não lançou nenhuma nota.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {details.grades.map(g => (
                          <Badge key={`${g.module}-${g.item_key}`} variant="secondary" className="text-[10px] font-mono">
                            {g.item_key}: {g.score}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </section>

                  <section>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Eventos criados pelo aluno ({details.events.length})
                    </h4>
                    {details.events.length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhum evento próprio.</p>
                    ) : (
                      <ul className="text-xs space-y-1 text-slate-700 dark:text-slate-300">
                        {details.events.map(ev => (
                          <li key={ev.id}>{formatDate(ev.start_date)} — {ev.title} <span className="text-slate-400">({ev.module_or_subject})</span></li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{label}</div>
    <div className="text-slate-800 dark:text-slate-100 font-medium truncate">{value}</div>
  </div>
)
