import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { useAuth } from '@/context/AuthContext'
import { ClassItem } from '@/types'
import { INITIAL_CLASSES } from '@/data/initialData'
import { CalendarDays, Clock, MapPin, User, Plus, Edit2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const WeeklySchedule: React.FC = () => {
  const { token, user } = useAuth()
  const [classes, setClasses] = useState<ClassItem[]>(() => {
    try {
      const saved = localStorage.getItem('medplanner_classes_v2')
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return INITIAL_CLASSES
  })
  const [loading, setLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number>(1) // Default: Segunda-feira

  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null)
  const [formData, setFormData] = useState({
    day_of_week: 1,
    start_time: '08:00',
    end_time: '12:00',
    subject_name: '',
    room: '',
    teacher: '',
    type: 'Teórica',
    color: 'blue',
  })

  const days = [
    { num: 1, name: 'Segunda', short: 'SEG' },
    { num: 2, name: 'Terça', short: 'TER' },
    { num: 3, name: 'Quarta', short: 'QUA' },
    { num: 4, name: 'Quinta', short: 'QUI' },
    { num: 5, name: 'Sexta', short: 'SEX' },
    { num: 6, name: 'Sábado', short: 'SÁB' },
  ]

  const fetchClasses = async () => {
    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/classes', { headers })
      if (res.ok) {
        const text = await res.text()
        try {
          const data = JSON.parse(text)
          if (data.classes && data.classes.length > 0) {
            setClasses(data.classes)
            localStorage.setItem('medplanner_classes_v2', JSON.stringify(data.classes))
          }
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Backend classes offline, using local data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClasses()
  }, [token])

  const handleOpenAdd = () => {
    setEditingClass(null)
    setFormData({
      day_of_week: selectedDay,
      start_time: '08:00',
      end_time: '12:00',
      subject_name: '',
      room: '',
      teacher: '',
      type: 'Teórica',
      color: 'blue',
    })
    setModalOpen(true)
  }

  const handleOpenEdit = (c: ClassItem) => {
    setEditingClass(c)
    setFormData({
      day_of_week: c.day_of_week,
      start_time: c.start_time,
      end_time: c.end_time,
      subject_name: c.subject_name,
      room: c.room || '',
      teacher: c.teacher || '',
      type: c.type || 'Teórica',
      color: c.color || 'blue',
    })
    setModalOpen(true)
  }

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault()

    const newClassItem: ClassItem = {
      id: editingClass ? editingClass.id : Date.now(),
      day_of_week: formData.day_of_week,
      start_time: formData.start_time,
      end_time: formData.end_time,
      subject_name: formData.subject_name,
      room: formData.room,
      teacher: formData.teacher,
      type: formData.type as any,
      color: formData.color,
    }

    setClasses(prev => {
      let updated: ClassItem[]
      if (editingClass) {
        updated = prev.map(c => c.id === editingClass.id ? { ...c, ...newClassItem } : c)
      } else {
        updated = [...prev, newClassItem]
      }
      localStorage.setItem('medplanner_classes_v2', JSON.stringify(updated))
      return updated
    })
    setModalOpen(false)

    if (token) {
      try {
        const url = editingClass ? `/api/classes/${editingClass.id}` : '/api/classes'
        const method = editingClass ? 'PUT' : 'POST'

        await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        })
      } catch (err) {
        console.warn('API save class skipped (saved locally):', err)
      }
    }
  }

  const handleDeleteClass = async (id: number) => {
    if (!window.confirm('Deseja excluir esta aula?')) return

    setClasses(prev => {
      const updated = prev.filter(c => c.id !== id)
      localStorage.setItem('medplanner_classes_v2', JSON.stringify(updated))
      return updated
    })

    if (token) {
      try {
        await fetch(`/api/classes/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch (err) {
        console.warn('API delete class skipped (deleted locally):', err)
      }
    }
  }

  const filteredClasses = classes.filter(c => c.day_of_week === selectedDay).sort((a, b) => a.start_time.localeCompare(b.start_time))

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'Teórica': return 'blue'
      case 'Prática': return 'default'
      case 'TBL': return 'warning'
      case 'Seminário': return 'secondary'
      default: return 'outline'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header: Clean title without Aba numbers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Agenda Semanal
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Grade de horários das aulas da semana com salas, professores e modalidades.
          </p>
        </div>

        {user && (
          <Button onClick={handleOpenAdd} className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            Adicionar Aula
          </Button>
        )}
      </div>

      {/* Day Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {days.map(d => {
          const count = classes.filter(c => c.day_of_week === d.num).length
          const isSelected = selectedDay === d.num

          return (
            <button
              key={d.num}
              onClick={() => setSelectedDay(d.num)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer select-none",
                isSelected
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/25 scale-[1.02]"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <span>{d.name}</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                  isSelected
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Class List for Selected Day */}
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">Carregando horários...</div>
      ) : filteredClasses.length === 0 ? (
        <Card className="border-dashed p-8 text-center bg-slate-50/50 dark:bg-slate-900/30">
          <CalendarDays className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Nenhuma aula cadastrada para {days.find(d => d.num === selectedDay)?.name}.
          </p>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            Aproveite o tempo livre para adiantar o checklist de estudos!
          </p>
          {user && (
            <Button size="sm" variant="outline" onClick={handleOpenAdd}>
              Adicionar aula neste dia
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {filteredClasses.map(item => (
            <Card
              key={item.id}
              className="group hover:border-blue-500/40 hover:shadow-md transition-all duration-200 overflow-hidden"
            >
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="blue" className="flex items-center gap-1 text-xs font-semibold py-1">
                      <Clock className="h-3 w-3" />
                      {item.start_time} - {item.end_time}
                    </Badge>
                    <Badge variant={getTypeBadgeVariant(item.type)} className="text-[11px]">
                      {item.type}
                    </Badge>
                  </div>

                  {user && (
                    <div className="flex items-center gap-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Editar Aula"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClass(item.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Excluir Aula"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100 mb-2 leading-snug">
                  {item.subject_name}
                </h3>

                <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  {item.room && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span>{item.room}</span>
                    </div>
                  )}
                  {item.teacher && (
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{item.teacher}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Class Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingClass ? 'Editar Horário de Aula' : 'Adicionar Nova Aula'}
            </DialogTitle>
            <DialogDescription>
              Configure o horário, matéria e informações da aula da semana.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveClass} className="space-y-3.5 mt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Dia da Semana
              </label>
              <select
                value={formData.day_of_week}
                onChange={e => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                className="mt-1 flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                {days.map(d => (
                  <option key={d.num} value={d.num}>{d.name}-feira</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Início</label>
                <Input
                  type="time"
                  required
                  value={formData.start_time}
                  onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Término</label>
                <Input
                  type="time"
                  required
                  value={formData.end_time}
                  onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nome da Matéria / Atividade
              </label>
              <Input
                required
                placeholder="Ex: Anatomia Humana (Prática)"
                value={formData.subject_name}
                onChange={e => setFormData({ ...formData, subject_name: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Local / Sala</label>
                <Input
                  placeholder="Ex: Lab. Microscopia"
                  value={formData.room}
                  onChange={e => setFormData({ ...formData, room: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Modalidade</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  className="mt-1 flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="Teórica">Teórica</option>
                  <option value="Prática">Prática</option>
                  <option value="TBL">TBL</option>
                  <option value="Seminário">Seminário</option>
                  <option value="Laboratório">Laboratório</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Professor / Preceptor (Opcional)
              </label>
              <Input
                placeholder="Ex: Prof. de Histologia"
                value={formData.teacher}
                onChange={e => setFormData({ ...formData, teacher: e.target.value })}
                className="mt-1"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingClass ? 'Salvar Alterações' : 'Adicionar Aula'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
