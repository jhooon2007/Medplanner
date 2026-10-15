import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Progress } from '@/components/ui/Progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { useAuth } from '@/context/AuthContext'
import { ImportantEvent } from '@/types'
import { INITIAL_EVENTS } from '@/data/initialData'
import { Clock, Calendar, CheckCircle2, AlertTriangle, Plus, Edit3, Trash2, ListChecks, ChevronRight, History } from 'lucide-react'
import { cn } from '@/lib/utils'

export const ImportantEvents: React.FC = () => {
  const { token, user } = useAuth()
  const [events, setEvents] = useState<ImportantEvent[]>(() => {
    try {
      const saved = localStorage.getItem('medplanner_events')
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return INITIAL_EVENTS
  })
  const [loading, setLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>('todos')
  const [selectedType, setSelectedType] = useState<string>('todos')
  const [showPastEvents, setShowPastEvents] = useState<boolean>(false)

  // Details Modal
  const [detailsEvent, setDetailsEvent] = useState<ImportantEvent | null>(null)

  // Edit / Add Modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<ImportantEvent | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    module_or_subject: '',
    start_date: '',
    end_date: '',
    type: 'Prova',
    topics: '',
  })

  const fetchEvents = async () => {
    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/events', { headers })
      if (res.ok) {
        const text = await res.text()
        try {
          const data = JSON.parse(text)
          if (data.events && data.events.length > 0) {
            setEvents(data.events)
            localStorage.setItem('medplanner_events', JSON.stringify(data.events))
          }
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Backend events offline, using local data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [token])

  // Current Date comparison
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10) // YYYY-MM-DD

  const calculateEventStatus = (startDateStr: string, endDateStr?: string | null) => {
    const eventStart = new Date(startDateStr + 'T00:00:00')
    const eventEnd = endDateStr ? new Date(endDateStr + 'T23:59:59') : new Date(startDateStr + 'T23:59:59')

    // Semester reference start (Aug 15, 2026)
    const semesterStart = new Date('2026-08-15T00:00:00')

    const diffMs = eventStart.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    let statusText = ''
    let badgeVariant: 'default' | 'blue' | 'destructive' | 'warning' | 'success' | 'secondary' = 'blue'
    let progress = 0
    const isPast = now > eventEnd

    if (isPast) {
      statusText = 'Concluído'
      badgeVariant = 'secondary'
      progress = 100
    } else if (diffDays <= 0) {
      statusText = 'Hoje! Boa prova!'
      badgeVariant = 'destructive'
      progress = 98
    } else if (diffDays === 1) {
      statusText = 'Amanhã!'
      badgeVariant = 'destructive'
      progress = 95
    } else {
      statusText = `Faltam ${diffDays} dias`
      if (diffDays <= 5) badgeVariant = 'warning'
      else if (diffDays <= 14) badgeVariant = 'blue'
      else badgeVariant = 'default'

      const totalSpan = eventStart.getTime() - semesterStart.getTime()
      const elapsed = now.getTime() - semesterStart.getTime()
      if (totalSpan > 0 && elapsed > 0) {
        progress = Math.min(95, Math.max(10, Math.round((elapsed / totalSpan) * 100)))
      } else {
        progress = Math.max(5, Math.min(90, 100 - diffDays))
      }
    }

    return { diffDays, statusText, badgeVariant, progress, isPast }
  }

  const handleOpenAdd = () => {
    setEditingEvent(null)
    setFormData({
      title: '',
      module_or_subject: '',
      start_date: todayStr,
      end_date: '',
      type: 'Prova',
      topics: '',
    })
    setEditModalOpen(true)
  }

  const handleOpenEdit = (e: ImportantEvent, evt?: React.MouseEvent) => {
    if (evt) evt.stopPropagation()
    setEditingEvent(e)
    setFormData({
      title: e.title,
      module_or_subject: e.module_or_subject,
      start_date: e.start_date,
      end_date: e.end_date || '',
      type: e.type,
      topics: (e.topics || []).join('\n'),
    })
    setEditModalOpen(true)
  }

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault()

    const topicsArray = formData.topics
      .split('\n')
      .map(t => t.trim())
      .filter(Boolean)

    const payload = {
      title: formData.title,
      module_or_subject: formData.module_or_subject,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      type: formData.type,
      topics: topicsArray,
    }

    const newEventItem: ImportantEvent = {
      id: editingEvent ? editingEvent.id : Date.now(),
      title: formData.title,
      module_or_subject: formData.module_or_subject,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      type: formData.type,
      topics: topicsArray,
      is_custom: 1,
    }

    setEvents(prev => {
      let updated: ImportantEvent[]
      if (editingEvent) {
        updated = prev.map(ev => ev.id === editingEvent.id ? { ...ev, ...newEventItem } : ev)
      } else {
        updated = [...prev, newEventItem]
      }
      localStorage.setItem('medplanner_events', JSON.stringify(updated))
      return updated
    })
    setEditModalOpen(false)

    if (token) {
      try {
        const url = editingEvent ? `/api/events/${editingEvent.id}` : '/api/events'
        const method = editingEvent ? 'PUT' : 'POST'

        await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })
      } catch (err) {
        console.warn('API save event skipped (saved locally):', err)
      }
    }
  }

  const handleDeleteEvent = async (id: number, evt?: React.MouseEvent) => {
    if (evt) evt.stopPropagation()
    if (!window.confirm('Deseja excluir este evento?')) return

    setEvents(prev => {
      const updated = prev.filter(e => e.id !== id)
      localStorage.setItem('medplanner_events', JSON.stringify(updated))
      return updated
    })

    if (token) {
      try {
        await fetch(`/api/events/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch (err) {
        console.warn('API delete event skipped (deleted locally):', err)
      }
    }
  }

  // Filter events: strictly upcoming & today unless user explicitly toggles past events
  const upcomingAndTodayEvents = events.filter(e => {
    const { isPast } = calculateEventStatus(e.start_date, e.end_date)
    return !isPast
  })

  const pastEvents = events.filter(e => {
    const { isPast } = calculateEventStatus(e.start_date, e.end_date)
    return isPast
  })

  const baseEventsList = showPastEvents ? events : upcomingAndTodayEvents

  const filteredEvents = baseEventsList.filter(e => {
    // Month filter
    if (selectedMonth !== 'todos') {
      const eventMonth = e.start_date.slice(5, 7)
      if (eventMonth !== selectedMonth) return false
    }

    // Type filter
    if (selectedType !== 'todos') {
      if (e.type !== selectedType) return false
    }

    return true
  })

  // Format date readable (Ex: 08/09 a 10/09/2026)
  const formatDates = (startStr: string, endStr?: string | null) => {
    const [y, m, d] = startStr.split('-')
    if (!endStr) return `${d}/${m}/${y}`
    const [, em, ed] = endStr.split('-')
    return `${d}/${m} a ${ed}/${em}/${y}`
  }

  return (
    <div className="space-y-6">
      {/* Header: Clean title without Aba 2 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Eventos Importantes
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Provas, seminários, fóruns e apresentações com contagem regressiva e conteúdos cobrados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {pastEvents.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPastEvents(!showPastEvents)}
              className="text-xs gap-1.5 h-9"
            >
              <History className="h-3.5 w-3.5" />
              {showPastEvents ? 'Ocultar Anteriores' : `Ver Anteriores (${pastEvents.length})`}
            </Button>
          )}

          {user && (
            <Button onClick={handleOpenAdd} className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 h-9">
              <Plus className="h-4 w-4" />
              Novo Evento
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs by Month and Type */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none pb-1 sm:pb-0">
          {[
            { id: 'todos', label: 'Todos os meses' },
            { id: '09', label: 'Setembro' },
            { id: '10', label: 'Outubro' },
            { id: '11', label: 'Novembro' },
            { id: '12', label: 'Dezembro' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedMonth(m.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                selectedMonth === m.id
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-400">Tipo:</span>
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="todos">Todos os tipos</option>
            <option value="Prova">Provas</option>
            <option value="Seminário">Seminários</option>
            <option value="Fórum">Fóruns</option>
            <option value="Apresentação">Apresentações</option>
            <option value="Recuperação">Recuperação</option>
          </select>
        </div>
      </div>

      {/* Events List: 1 EVENT PER ROW (Single Column Row Stack) */}
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">Carregando eventos...</div>
      ) : filteredEvents.length === 0 ? (
        <Card className="border-dashed p-8 text-center bg-slate-50/50 dark:bg-slate-900/30">
          <Clock className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Nenhum evento futuro encontrado para este filtro.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Todos os prazos futuros estão em dia!
          </p>
        </Card>
      ) : (
        <div className="flex flex-col space-y-3">
          {filteredEvents.map(event => {
            const { statusText, badgeVariant, progress, diffDays, isPast } = calculateEventStatus(
              event.start_date,
              event.end_date
            )

            const isImminent = !isPast && diffDays >= 0 && diffDays <= 3

            return (
              <Card
                key={event.id}
                onClick={() => setDetailsEvent(event)}
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:shadow-md hover:border-blue-500/50 group border-slate-200/90 dark:border-slate-800 overflow-hidden",
                  isImminent && "ring-2 ring-rose-500/30 border-rose-500/40 bg-gradient-to-r from-rose-50/30 via-transparent to-transparent dark:from-rose-950/20"
                )}
              >
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Section: Date Badge & Title/Module */}
                  <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                    {/* Date Block */}
                    <div className="h-14 min-w-[3.5rem] px-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {new Date(event.start_date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-mono leading-none mt-0.5 whitespace-nowrap">
                        {event.end_date
                          ? `${event.start_date.split('-')[2]}-${event.end_date.split('-')[2]}`
                          : event.start_date.split('-')[2]}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="blue" className="text-[11px] py-0 px-2 font-medium">
                          {event.module_or_subject}
                        </Badge>
                        <Badge variant="secondary" className="text-[11px] py-0 px-2">
                          {event.type}
                        </Badge>
                      </div>

                      <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                        {event.title}
                      </h3>

                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <ListChecks className="h-3.5 w-3.5 text-blue-600" />
                        <span>{event.topics?.length || 0} tópico(s) cobrado(s)</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Section: Countdown, Progress Bar, and Action Buttons */}
                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                    <div className="w-36 hidden sm:block space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Proximidade</span>
                        <span>{progress}%</span>
                      </div>
                      <Progress
                        value={progress}
                        colorClassName={
                          isImminent
                            ? "bg-rose-500"
                            : progress >= 80
                            ? "bg-amber-500"
                            : "bg-blue-600"
                        }
                        className="h-1.5"
                      />
                    </div>

                    <Badge
                      variant={badgeVariant}
                      className={cn(
                        "text-xs font-bold px-3 py-1 font-mono shrink-0",
                        isImminent && "animate-pulse"
                      )}
                    >
                      {statusText}
                    </Badge>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={e => {
                        e.stopPropagation()
                        setDetailsEvent(event)
                      }}
                      className="text-xs gap-1.5 h-8 px-3 shrink-0"
                    >
                      Ver Assuntos
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    </Button>

                    {user && (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={e => handleOpenEdit(event, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Remarcar data / Editar evento"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={e => handleDeleteEvent(event.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Excluir evento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Event Details Dialog (Topics list that will appear in the exam) */}
      <Dialog open={Boolean(detailsEvent)} onOpenChange={open => !open && setDetailsEvent(null)}>
        <DialogContent className="max-w-lg">
          {detailsEvent && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6 mb-1">
                  <Badge variant="blue">{detailsEvent.module_or_subject}</Badge>
                  <Badge variant="secondary">{detailsEvent.type}</Badge>
                </div>
                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {detailsEvent.title}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Data: {formatDates(detailsEvent.start_date, detailsEvent.end_date)}</span>
                </DialogDescription>
              </DialogHeader>

              {/* Topics Included */}
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                      Conteúdo Cobrado nesta Avaliação
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {detailsEvent.topics?.length || 0} tópico(s)
                  </span>
                </div>

                {detailsEvent.topics && detailsEvent.topics.length > 0 ? (
                  <ul className="space-y-2 pt-1 max-h-60 overflow-y-auto pr-1">
                    {detailsEvent.topics.map((topic, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-300"
                      >
                        <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{topic}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic py-3 text-center">
                    Nenhum tópico detalhado cadastrado para esta avaliação.
                  </p>
                )}
              </div>

              <DialogFooter className="mt-6 flex justify-between items-center sm:justify-between">
                {user ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const ev = detailsEvent
                      setDetailsEvent(null)
                      handleOpenEdit(ev)
                    }}
                    className="gap-1.5 text-xs"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Remarcar Data ou Conteúdo
                  </Button>
                ) : <div />}

                <Button size="sm" onClick={() => setDetailsEvent(null)} className="bg-blue-600 hover:bg-blue-700">
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit / Add Event Modal (Student Autonomy for Date Rescheduling) */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? 'Remarcar / Editar Evento' : 'Novo Evento Importante'}
            </DialogTitle>
            <DialogDescription>
              {editingEvent
                ? 'Altere a data ou os assuntos caso a faculdade tenha sofrido alterações no calendário.'
                : 'Cadastre uma nova prova, seminário ou entrega de trabalho.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEvent} className="space-y-3.5 mt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Título do Evento
              </label>
              <Input
                required
                placeholder="Ex: 2ª Avaliação Teórica de Fisiologia"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Matéria / Módulo
                </label>
                <Input
                  required
                  placeholder="Ex: Fisiologia Humana"
                  value={formData.module_or_subject}
                  onChange={e => setFormData({ ...formData, module_or_subject: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tipo
                </label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  className="mt-1 flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="Prova">Prova</option>
                  <option value="Seminário">Seminário</option>
                  <option value="Fórum">Fórum</option>
                  <option value="Apresentação">Apresentação</option>
                  <option value="Recuperação">Recuperação</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Data de Início
                </label>
                <Input
                  type="date"
                  required
                  value={formData.start_date}
                  onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Data de Término (Opcional)
                </label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Assuntos que cairão na avaliação
                </label>
                <span className="text-[11px] text-slate-400">1 por linha</span>
              </div>
              <textarea
                rows={4}
                placeholder="Ex:&#10;Mecânica ventilatória&#10;Trocas gasosas alvéolo-capilares&#10;Controle da respiração"
                value={formData.topics}
                onChange={e => setFormData({ ...formData, topics: e.target.value })}
                className="mt-1 flex w-full rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingEvent ? 'Salvar Alterações' : 'Criar Evento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
