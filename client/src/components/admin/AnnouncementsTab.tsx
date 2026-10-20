import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { useAuth } from '@/context/AuthContext'
import { Announcement, AnnouncementLevel } from '@/types'
import { api, formatDate, formatDateTime } from '@/lib/api'
import { Megaphone, Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react'

const LEVELS: Record<AnnouncementLevel, { label: string; variant: 'blue' | 'warning' | 'destructive' }> = {
  info: { label: 'Informativo', variant: 'blue' },
  warning: { label: 'Atenção', variant: 'warning' },
  urgent: { label: 'Urgente', variant: 'destructive' },
}

const emptyForm = { title: '', message: '', level: 'info' as AnnouncementLevel, expires_at: '' }

interface Props {
  notify: (msg: string, isErr?: boolean) => void
}

export const AnnouncementsTab: React.FC<Props> = ({ notify }) => {
  const { token } = useAuth()
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const data = await api<{ announcements: Announcement[] }>(token, '/api/admin/announcements')
      setItems(data.announcements)
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

  const openEdit = (a: Announcement) => {
    setEditing(a)
    setForm({ title: a.title, message: a.message, level: a.level, expires_at: a.expires_at || '' })
    setDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body = { ...form, expires_at: form.expires_at || null }
      if (editing) {
        await api(token, `/api/admin/announcements/${editing.id}`, { method: 'PUT', body })
        notify('Aviso atualizado!')
      } else {
        await api(token, '/api/admin/announcements', { method: 'POST', body })
        notify('Aviso publicado para todos os alunos!')
      }
      setDialogOpen(false)
      await load()
    } catch (err: any) {
      notify(err.message, true)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (a: Announcement) => {
    try {
      await api(token, `/api/admin/announcements/${a.id}`, { method: 'PUT', body: { active: !a.active } })
      notify(a.active ? 'Aviso ocultado dos alunos.' : 'Aviso voltou a aparecer para os alunos.')
      await load()
    } catch (err: any) {
      notify(err.message, true)
    }
  }

  const handleDelete = async (a: Announcement) => {
    if (!window.confirm(`Excluir o aviso "${a.title}"?`)) return
    try {
      await api(token, `/api/admin/announcements/${a.id}`, { method: 'DELETE' })
      notify('Aviso removido.')
      await load()
    } catch (err: any) {
      notify(err.message, true)
    }
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const isExpired = (a: Announcement) => Boolean(a.expires_at && a.expires_at < today)

  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-blue-600" />
              Avisos Gerais
            </CardTitle>
            <CardDescription>
              Mensagens que aparecem no topo do app de todos os alunos (ex.: "Não haverá aula na terça-feira").
            </CardDescription>
          </div>
          <Button onClick={openCreate} size="sm" className="h-9 gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Novo aviso
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Carregando avisos...</p>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Nenhum aviso criado ainda. Clique em "Novo aviso" para avisar a turma.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map(a => {
              const expired = isExpired(a)
              const visible = Boolean(a.active) && !expired
              return (
                <div key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 dark:text-white">{a.title}</span>
                      <Badge variant={LEVELS[a.level].variant} className="text-[10px]">{LEVELS[a.level].label}</Badge>
                      <Badge variant={visible ? 'success' : 'secondary'} className="text-[10px]">
                        {expired ? 'Expirado' : a.active ? 'Visível' : 'Oculto'}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{a.message}</p>
                    <p className="text-[11px] text-slate-400">
                      Publicado em {formatDateTime(a.created_at)}
                      {a.expires_at ? ` • some em ${formatDate(a.expires_at)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => toggleActive(a)} className="gap-1.5 text-xs">
                      {a.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {a.active ? 'Ocultar' : 'Mostrar'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(a)} aria-label="Editar aviso">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(a)} aria-label="Excluir aviso"
                      className="text-rose-600 hover:text-rose-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar aviso' : 'Novo aviso geral'}</DialogTitle>
            <DialogDescription>O aviso aparece para todos os alunos assim que for salvo.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Título</label>
              <Input required maxLength={120} value={form.title} className="mt-1"
                placeholder="Ex.: Sem aula na terça-feira"
                onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mensagem</label>
              <textarea required rows={4} maxLength={1000} value={form.message}
                placeholder="Escreva o aviso para a turma..."
                onChange={e => setForm({ ...form, message: e.target.value })}
                className="mt-1 flex w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Importância</label>
                <select value={form.level}
                  onChange={e => setForm({ ...form, level: e.target.value as AnnouncementLevel })}
                  className="mt-1 flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  <option value="info">Informativo</option>
                  <option value="warning">Atenção</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Some em (opcional)</label>
                <Input type="date" value={form.expires_at} className="mt-1"
                  onChange={e => setForm({ ...form, expires_at: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar' : 'Publicar aviso'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
