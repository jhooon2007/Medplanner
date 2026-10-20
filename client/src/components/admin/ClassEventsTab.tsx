import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { useAuth } from '@/context/AuthContext'
import { ImportantEvent } from '@/types'
import { api, formatDate } from '@/lib/api'
import { Calendar, Plus, Edit, Trash2 } from 'lucide-react'

const TYPES = ['Prova', 'Seminário', 'Fórum', 'Apresentação', 'Recuperação']

const emptyForm = { title: '', module_or_subject: '', start_date: '', end_date: '', type: 'Prova', topics: '' }

interface Props {
  notify: (msg: string, isErr?: boolean) => void
}

export const ClassEventsTab: React.FC<Props> = ({ notify }) => {
  const { token } = useAuth()
  const [events, setEvents] = useState<ImportantEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ImportantEvent | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const data = await api<{ events: ImportantEvent[] }>(token, '/api/admin/events')
      setEvents(data.events)
    } catch (err: any) {
      notify(err.message, true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (ev: ImportantEvent) => {
    setEditing(ev)
    setForm({
      title: ev.title,
      module_or_subject: ev.module_or_subject,
      start_date: ev.start_date,
      end_date: ev.end_date || '',
      type: ev.type,
      topics: (ev.topics || []).join('\n'),
    })
    setDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        ...form,
        end_date: form.end_date || null,
        topics: form.topics.split('\n').map(t => t.trim()).filter(Boolean),
      }
      if (editing) {
        await api(token, `/api/admin/events/${editing.id}`, { method: 'PUT', body })
        notify('Evento atualizado para todos os alunos!')
      } else {
        await api(token, '/api/admin/events', { method: 'POST', body })
        notify('Evento criado para todos os alunos!')
      }
      setDialogOpen(false)
      await load()
    } catch (err: any) {
      notify(err.message, true)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (ev: ImportantEvent) => {
    if (!window.confirm(`Remover "${ev.title}" do calendário de TODOS os alunos?`)) return
    try {
      await api(token, `/api/admin/events/${ev.id}`, { method: 'DELETE' })
      notify('Evento removido para todos os alunos.')
      await load()
    } catch (err: any) {
      notify(err.message, true)
    }
  }

  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Provas e Eventos da Turma
            </CardTitle>
            <CardDescription>
              Alterações aqui valem para todos os alunos. Eventos que os alunos adicionaram por conta própria não são afetados.
            </CardDescription>
          </div>
          <Button onClick={openCreate} size="sm" className="h-9 gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Novo evento da turma
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Carregando eventos...</p>
        ) : events.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Nenhum evento da turma cadastrado.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {events.map(ev => (
              <div key={ev.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">{ev.title}</span>
                    <Badge variant="blue" className="text-[10px]">{ev.type}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    {ev.module_or_subject} • {formatDate(ev.start_date)}
                    {ev.end_date && ev.end_date !== ev.start_date ? ` até ${formatDate(ev.end_date)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEdit(ev)} className="gap-1.5 text-xs">
                    <Edit className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(ev)} aria-label="Excluir evento"
                    className="text-rose-600 hover:text-rose-700">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar evento da turma' : 'Novo evento da turma'}</DialogTitle>
            <DialogDescription>A mudança aparece para todos os alunos assim que for salva.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Título</label>
              <Input required value={form.title} className="mt-1"
                onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Matéria / Módulo</label>
              <Input required value={form.module_or_subject} className="mt-1"
                onChange={e => setForm({ ...form, module_or_subject: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Data</label>
                <Input required type="date" value={form.start_date} className="mt-1"
                  onChange={e => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Fim (opcional)</label>
                <Input type="date" value={form.end_date} className="mt-1"
                  onChange={e => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tipo</label>
                <select value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                  className="mt-1 flex h-10 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Conteúdo cobrado (um tópico por linha)</label>
              <textarea rows={4} value={form.topics}
                onChange={e => setForm({ ...form, topics: e.target.value })}
                className="mt-1 flex w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar para todos'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
