import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Progress } from '@/components/ui/Progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { useAuth } from '@/context/AuthContext'
import { useSemester } from '@/context/SemesterContext'
import { Subject, Topic, Subtopic } from '@/types'
import { INITIAL_SUBJECTS } from '@/data/initialData'
import confetti from 'canvas-confetti'
import {
  BookOpen, CheckSquare, ChevronRight, ChevronDown, Plus, Edit2, Trash2,
  Activity, Dna, HeartPulse, Microscope, Stethoscope
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const SemesterSubjects: React.FC = () => {
  const { token, user } = useAuth()
  const { semesters, currentSemester, currentSemesterObj, setCurrentSemester } = useSemester()
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    try {
      const saved = localStorage.getItem('medplanner_subjects')
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return INITIAL_SUBJECTS
  })
  const [loading, setLoading] = useState(false)

  // Selected subject view
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(1)
  const [expandedTopics, setExpandedTopics] = useState<Record<number, boolean>>({ 101: true })

  // Modals for Student Autonomy CRUD
  const [subjectModalOpen, setSubjectModalOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    code: '',
    color: 'blue',
    description: '',
    semester: currentSemester,
  })

  const [topicModalOpen, setTopicModalOpen] = useState(false)
  const [editingTopic, setEditingTopic] = useState<{ id?: number; subject_id: number; name: string } | null>(null)
  const [topicName, setTopicName] = useState('')

  const [subtopicModalOpen, setSubtopicModalOpen] = useState(false)
  const [editingSubtopic, setEditingSubtopic] = useState<{ id?: number; topic_id: number; name: string } | null>(null)
  const [subtopicName, setSubtopicName] = useState('')

  const fetchSubjects = async () => {
    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/subjects', { headers })
      if (res.ok) {
        const text = await res.text()
        try {
          const data = JSON.parse(text)
          if (data.subjects && data.subjects.length > 0) {
            setSubjects(data.subjects)
            localStorage.setItem('medplanner_subjects', JSON.stringify(data.subjects))
            if (!selectedSubjectId) {
              setSelectedSubjectId(data.subjects[0].id)
            }
          }
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Backend subjects offline, using local data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubjects()
  }, [token])

  const handleToggleSubtopic = async (subtopicId: number, currentCompleted: boolean) => {
    if (!token) return

    const newCompleted = !currentCompleted

    // Optimistic UI update & localStorage save
    setSubjects(prev => {
      const updated = prev.map(subj => {
        let subjTotal = 0
        let subjCompleted = 0

        const newTopics = subj.topics.map(t => {
          const newSubtopics = t.subtopics.map(st => {
            subjTotal++
            if (st.id === subtopicId) {
              if (newCompleted) subjCompleted++
              return { ...st, completed: newCompleted }
            }
            if (st.completed) subjCompleted++
            return st
          })
          return { ...t, subtopics: newSubtopics }
        })

        const percentage = subjTotal > 0 ? Math.round((subjCompleted / subjTotal) * 100) : 0
        return {
          ...subj,
          topics: newTopics,
          totalSubtopics: subjTotal,
          completedSubtopics: subjCompleted,
          percentage,
        }
      })
      localStorage.setItem('medplanner_subjects', JSON.stringify(updated))
      return updated
    })

    if (newCompleted) {
      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#2563eb', '#3b82f6', '#60a5fa', '#6366f1']
      })
    }

    try {
      await fetch('/api/checklist/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ subtopic_id: subtopicId, completed: newCompleted })
      })
    } catch (err) {
      console.error('Failed to toggle checklist:', err)
      fetchSubjects()
    }
  }

  const toggleTopicExpand = (topicId: number) => {
    setExpandedTopics(prev => ({
      ...prev,
      [topicId]: !prev[topicId]
    }))
  }

  // Filter subjects for the active semester
  const filteredSubjects = subjects.filter(s => (s.semester ?? 2) === currentSemester)

  let totalSemesterSubtopics = 0
  let completedSemesterSubtopics = 0
  filteredSubjects.forEach(s => {
    totalSemesterSubtopics += s.totalSubtopics || 0
    completedSemesterSubtopics += s.completedSubtopics || 0
  })
  const semesterPercentage = totalSemesterSubtopics > 0
    ? Math.round((completedSemesterSubtopics / totalSemesterSubtopics) * 100)
    : 0

  // SUBJECT CRUD
  const handleOpenAddSubject = () => {
    setEditingSubject(null)
    setSubjectForm({
      name: '',
      code: '',
      color: 'blue',
      description: '',
      semester: currentSemester,
    })
    setSubjectModalOpen(true)
  }

  const handleOpenEditSubject = (s: Subject, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setEditingSubject(s)
    setSubjectForm({
      name: s.name,
      code: s.code || '',
      color: s.color || 'blue',
      description: s.description || '',
      semester: (s.semester ?? currentSemester) as number,
    })
    setSubjectModalOpen(true)
  }

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault()

    const newSubj: Subject = {
      id: editingSubject ? editingSubject.id : Date.now(),
      name: subjectForm.name,
      code: subjectForm.code || '',
      color: subjectForm.color || 'blue',
      description: subjectForm.description || '',
      semester: subjectForm.semester ?? currentSemester,
      topics: editingSubject ? editingSubject.topics : [],
      totalSubtopics: editingSubject ? editingSubject.totalSubtopics : 0,
      completedSubtopics: editingSubject ? editingSubject.completedSubtopics : 0,
      percentage: editingSubject ? editingSubject.percentage : 0,
    }

    setSubjects(prev => {
      let updated: Subject[]
      if (editingSubject) {
        updated = prev.map(s => s.id === editingSubject.id ? { ...s, ...newSubj } : s)
      } else {
        updated = [...prev, newSubj]
      }
      localStorage.setItem('medplanner_subjects', JSON.stringify(updated))
      return updated
    })
    setSelectedSubjectId(newSubj.id)
    setSubjectModalOpen(false)

    if (token) {
      try {
        const url = editingSubject ? `/api/subjects/${editingSubject.id}` : '/api/subjects'
        const method = editingSubject ? 'PUT' : 'POST'
        await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(subjectForm)
        })
      } catch (err) {}
    }
  }

  const handleDeleteSubject = async (subjectId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!window.confirm('Excluir esta matéria e todos os seus tópicos?')) return

    setSubjects(prev => {
      const updated = prev.filter(s => s.id !== subjectId)
      localStorage.setItem('medplanner_subjects', JSON.stringify(updated))
      return updated
    })
    if (selectedSubjectId === subjectId) setSelectedSubjectId(null)

    if (token) {
      try {
        await fetch(`/api/subjects/${subjectId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        })
      } catch (err) {}
    }
  }

  // TOPIC CRUD
  const handleOpenAddTopic = (subjectId: number) => {
    setEditingTopic({ subject_id: subjectId, name: '' })
    setTopicName('')
    setTopicModalOpen(true)
  }

  const handleOpenEditTopic = (t: Topic, subjectId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setEditingTopic({ id: t.id, subject_id: subjectId, name: t.name })
    setTopicName(t.name)
    setTopicModalOpen(true)
  }

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !editingTopic) return

    try {
      const url = editingTopic.id
        ? `/api/topics/${editingTopic.id}`
        : `/api/subjects/${editingTopic.subject_id}/topics`
      const method = editingTopic.id ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: topicName })
      })

      if (res.ok) {
        setTopicModalOpen(false)
        fetchSubjects()
      }
    } catch (err) {
      console.error('Error saving topic:', err)
    }
  }

  const handleDeleteTopic = async (topicId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!token || !window.confirm('Excluir este assunto?')) return

    try {
      const res = await fetch(`/api/topics/${topicId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        fetchSubjects()
      }
    } catch (err) {
      console.error('Error deleting topic:', err)
    }
  }

  // SUBTOPIC CRUD
  const handleOpenAddSubtopic = (topicId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setEditingSubtopic({ topic_id: topicId, name: '' })
    setSubtopicName('')
    setSubtopicModalOpen(true)
  }

  const handleOpenEditSubtopic = (st: Subtopic, topicId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setEditingSubtopic({ id: st.id, topic_id: topicId, name: st.name })
    setSubtopicName(st.name)
    setSubtopicModalOpen(true)
  }

  const handleSaveSubtopic = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !editingSubtopic) return

    try {
      const url = editingSubtopic.id
        ? `/api/subtopics/${editingSubtopic.id}`
        : `/api/topics/${editingSubtopic.topic_id}/subtopics`
      const method = editingSubtopic.id ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: subtopicName })
      })

      if (res.ok) {
        setSubtopicModalOpen(false)
        fetchSubjects()
      }
    } catch (err) {
      console.error('Error saving subtopic:', err)
    }
  }

  const handleDeleteSubtopic = async (subtopicId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!token || !window.confirm('Excluir este subassunto?')) return

    try {
      const res = await fetch(`/api/subtopics/${subtopicId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        fetchSubjects()
      }
    } catch (err) {
      console.error('Error deleting subtopic:', err)
    }
  }

  const activeSubject = filteredSubjects.find(s => s.id === selectedSubjectId) || filteredSubjects[0]

  const getSubjectIcon = (name: string) => {
    if (name.includes('Anatomia')) return <Activity className="h-5 w-5 text-blue-600" />
    if (name.includes('Bioquímica')) return <Dna className="h-5 w-5 text-indigo-500" />
    if (name.includes('Fisiologia')) return <HeartPulse className="h-5 w-5 text-rose-500" />
    if (name.includes('Histologia')) return <Microscope className="h-5 w-5 text-sky-500" />
    if (name.includes('Clínico') || name.includes('IMC')) return <Stethoscope className="h-5 w-5 text-amber-500" />
    return <BookOpen className="h-5 w-5 text-blue-500" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Matérias do Semestre
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Checklist interativo de matérias, assuntos e tópicos com autonomia total de edição.
          </p>
        </div>

        {user && (
          <Button onClick={handleOpenAddSubject} className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 h-9">
            <Plus className="h-4 w-4" />
            Nova Matéria
          </Button>
        )}
      </div>

      {/* Semester Switcher Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {semesters.map(sem => {
          const isSelected = sem.number === currentSemester
          const count = subjects.filter(s => (s.semester ?? 2) === sem.number).length
          return (
            <button
              key={sem.id}
              onClick={() => {
                setCurrentSemester(sem.number)
                setSelectedSubjectId(null)
              }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
                isSelected
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 scale-[1.02]"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <span>{sem.name}</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                isSelected ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Overall Progress Banner */}
      <Card className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-transparent border-blue-500/20 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <CheckSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Progresso Geral • {currentSemesterObj.name}
              </div>
              <div className="text-xs text-slate-500">
                {completedSemesterSubtopics} de {totalSemesterSubtopics} tópicos concluídos
              </div>
            </div>
          </div>
          <div className="text-xl font-extrabold text-blue-700 dark:text-blue-300 font-mono">
            {semesterPercentage}% Concluído
          </div>
        </div>
        <Progress value={semesterPercentage} colorClassName="bg-blue-600" />
      </Card>

      {/* Layout Grid: Left Subject Cards, Right Interactive Checklist */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Subjects Cards (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Disciplinas ({filteredSubjects.length})
            </span>
          </div>

          {filteredSubjects.length === 0 ? (
            <Card className="border-dashed p-6 text-center bg-slate-50/50 dark:bg-slate-900/30">
              <BookOpen className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
                Nenhuma matéria cadastrada no {currentSemesterObj.name}.
              </p>
              <p className="text-xs text-slate-400 mt-1 mb-3">
                Adicione as matérias deste período para montar seu plano de estudos.
              </p>
              {user && (
                <Button size="sm" onClick={handleOpenAddSubject} className="bg-blue-600 hover:bg-blue-700 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Cadastrar Matéria
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-2.5">
              {filteredSubjects.map(s => {
                const isSelected = activeSubject?.id === s.id

              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedSubjectId(s.id)}
                  className={cn(
                    "p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none group relative",
                    isSelected
                      ? "border-blue-500 bg-white dark:bg-slate-900 shadow-md ring-2 ring-blue-500/20"
                      : "border-slate-200/80 bg-white/70 dark:border-slate-800 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-900"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        {getSubjectIcon(s.name)}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug">
                          {s.name}
                        </h3>
                        {s.code && (
                          <span className="text-[11px] text-slate-400 font-medium">
                            {s.code}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge variant={s.percentage === 100 ? 'success' : isSelected ? 'blue' : 'secondary'} className="text-[11px] font-mono">
                        {s.percentage}%
                      </Badge>

                      {user && (
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => handleOpenEditSubject(s, e)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded"
                            title="Editar Matéria"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={e => handleDeleteSubject(s.id, e)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Excluir Matéria"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {s.completedSubtopics || 0} de {s.totalSubtopics || 0} tópicos
                    </span>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {s.topics?.length || 0} módulos
                    </span>
                  </div>
                  <Progress value={s.percentage || 0} colorClassName="bg-blue-600" className="mt-1.5 h-1.5" />
                </div>
              )
            })}
          </div>
        )}
      </div>

        {/* Right Column: Interactive Checklist Tree (7 cols) */}
        <div className="lg:col-span-7">
          {activeSubject ? (
            <Card className="border-slate-200 dark:border-slate-800 shadow-md">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                        {activeSubject.name}
                      </CardTitle>
                      <Badge variant="blue">{activeSubject.percentage}% Completo</Badge>
                    </div>
                    {activeSubject.description && (
                      <CardDescription className="mt-1 text-xs sm:text-sm">
                        {activeSubject.description}
                      </CardDescription>
                    )}
                  </div>

                  {user && (
                    <Button
                      size="sm"
                      onClick={() => handleOpenAddTopic(activeSubject.id)}
                      className="gap-1.5 text-xs shrink-0 bg-blue-600 hover:bg-blue-700 h-8"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Novo Assunto
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-6 space-y-4">
                {activeSubject.topics?.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">
                    Nenhum assunto cadastrado nesta matéria ainda.
                  </div>
                ) : (
                  activeSubject.topics.map((topic) => {
                    const isExpanded = expandedTopics[topic.id] ?? true
                    const topicTotal = topic.subtopics?.length || 0
                    const topicCompleted = topic.subtopics?.filter(st => st.completed).length || 0

                    return (
                      <div
                        key={topic.id}
                        className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden transition-all duration-200 shadow-xs"
                      >
                        <div
                          onClick={() => toggleTopicExpand(topic.id)}
                          className={cn(
                            "flex items-center justify-between p-3.5 sm:p-4 cursor-pointer select-none transition-colors",
                            isExpanded ? "bg-slate-50/70 dark:bg-slate-800/40" : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              className="text-slate-400 hover:text-slate-600 p-0.5"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-blue-600" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <span className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-200">
                              {topic.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                              {topicCompleted}/{topicTotal}
                            </span>

                            {user && (
                              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={e => handleOpenAddSubtopic(topic.id, e)}
                                  className="p-1 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60"
                                  title="Adicionar Subassunto"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={e => handleOpenEditTopic(topic, activeSubject.id, e)}
                                  className="p-1 rounded text-slate-400 hover:text-blue-600"
                                  title="Renomear Assunto"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={e => handleDeleteTopic(topic.id, e)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600"
                                  title="Excluir Assunto"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Subtopics Checklist Items */}
                        {isExpanded && (
                          <div className="p-3 sm:p-4 pt-1 space-y-1.5 border-t border-slate-100 dark:border-slate-800">
                            {topic.subtopics?.length === 0 ? (
                              <div className="text-xs text-slate-400 italic py-2 pl-6">
                                Nenhum subassunto neste tópico. Clique no '+' para adicionar.
                              </div>
                            ) : (
                              topic.subtopics.map(st => (
                                <div
                                  key={st.id}
                                  onClick={() => handleToggleSubtopic(st.id, st.completed)}
                                  className={cn(
                                    "flex items-center justify-between p-2.5 sm:p-3 rounded-xl cursor-pointer transition-all duration-150 group select-none",
                                    st.completed
                                      ? "bg-blue-50/50 dark:bg-blue-950/20 text-slate-400 dark:text-slate-500 line-through"
                                      : "hover:bg-slate-100/70 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="shrink-0">
                                      {st.completed ? (
                                        <div className="h-5 w-5 rounded-md bg-blue-600 text-white flex items-center justify-center shadow-xs">
                                          <CheckSquare className="h-3.5 w-3.5" />
                                        </div>
                                      ) : (
                                        <div className="h-5 w-5 rounded-md border-2 border-slate-300 dark:border-slate-700 group-hover:border-blue-500 transition-colors" />
                                      )}
                                    </div>
                                    <span className="text-xs sm:text-sm font-medium leading-relaxed">
                                      {st.name}
                                    </span>
                                  </div>

                                  {user && (
                                    <div
                                      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <button
                                        onClick={e => handleOpenEditSubtopic(st, topic.id, e)}
                                        className="p-1 text-slate-400 hover:text-blue-600"
                                        title="Editar Subassunto"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={e => handleDeleteSubtopic(st.id, e)}
                                        className="p-1 text-slate-400 hover:text-rose-600"
                                        title="Excluir Subassunto"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-12 text-slate-400">
              Selecione uma matéria à esquerda.
            </div>
          )}
        </div>
      </div>

      {/* Modals for Subject, Topic, Subtopic */}
      <Dialog open={subjectModalOpen} onOpenChange={setSubjectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSubject ? 'Editar Matéria' : 'Nova Matéria'}</DialogTitle>
            <DialogDescription>Adicione ou altere o nome e dados da disciplina.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSubject} className="space-y-3.5 mt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome da Matéria</label>
              <Input
                required
                placeholder="Ex: Farmacologia Médica"
                value={subjectForm.name}
                onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Código (Opcional)</label>
              <Input
                placeholder="Ex: MED-FARMA"
                value={subjectForm.code}
                onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Semestre / Período</label>
              <select
                value={subjectForm.semester}
                onChange={e => setSubjectForm({ ...subjectForm, semester: parseInt(e.target.value, 10) })}
                className="mt-1 flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                {semesters.map(sem => (
                  <option key={sem.id} value={sem.number}>
                    {sem.name} {sem.year_period ? `(${sem.year_period})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Descrição / Ementa</label>
              <Input
                placeholder="Ex: Estudo dos mecanismos de ação dos fármacos"
                value={subjectForm.description}
                onChange={e => setSubjectForm({ ...subjectForm, description: e.target.value })}
                className="mt-1"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSubjectModalOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">{editingSubject ? 'Salvar' : 'Criar Matéria'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={topicModalOpen} onOpenChange={setTopicModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTopic?.id ? 'Editar Assunto' : 'Novo Assunto'}</DialogTitle>
            <DialogDescription>Digite o nome do assunto/bloco que será estudado.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveTopic} className="space-y-3.5 mt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome do Assunto</label>
              <Input
                required
                placeholder="Ex: Sistema Nervoso Central"
                value={topicName}
                onChange={e => setTopicName(e.target.value)}
                className="mt-1"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTopicModalOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={subtopicModalOpen} onOpenChange={setSubtopicModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSubtopic?.id ? 'Editar Subassunto' : 'Novo Subassunto'}</DialogTitle>
            <DialogDescription>Cadastre o tópico específico para seu checklist diário.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSubtopic} className="space-y-3.5 mt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome do Subassunto</label>
              <Input
                required
                placeholder="Ex: Bulbo, ponte e mesencéfalo"
                value={subtopicName}
                onChange={e => setSubtopicName(e.target.value)}
                className="mt-1"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSubtopicModalOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Salvar Subassunto</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
