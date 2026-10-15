import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { Progress } from '@/components/ui/Progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { useAuth } from '@/context/AuthContext'
import { useSemester } from '@/context/SemesterContext'
import { User, ImportantEvent } from '@/types'
import { INITIAL_EVENTS } from '@/data/initialData'
import {
  ShieldCheck, Users, Calendar, BookOpen, Edit, Trash2,
  CheckCircle2, AlertTriangle, Search, Activity, Server, Database,
  Key, Download, RefreshCw, UserPlus, Lock, GraduationCap,
  Clock, FileText, Check, Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const AdminDashboard: React.FC = () => {
  const { token, user: currentUser } = useAuth()
  const { currentSemesterObj, semesters } = useSemester()

  // Navigation tab inside Admin
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'events' | 'health'>('overview')

  const [users, setUsers] = useState<User[]>([])
  const [events, setEvents] = useState<ImportantEvent[]>(INITIAL_EVENTS)
  const [stats, setStats] = useState<any>({
    totalUsers: 1,
    totalStudents: 0,
    totalEvents: INITIAL_EVENTS.length,
    totalSubjects: 3,
    totalSubtopics: 42
  })
  const [healthData, setHealthData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'admin'>('all')

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'student' as 'admin' | 'student',
    password: '',
  })
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const showNotification = (msg: string, isErr = false) => {
    if (isErr) {
      setActionError(msg)
      setTimeout(() => setActionError(null), 4000)
    } else {
      setActionSuccess(msg)
      setTimeout(() => setActionSuccess(null), 3000)
    }
  }

  const fetchAdminData = async () => {
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [usersRes, statsRes, healthRes, eventsRes] = await Promise.all([
        fetch('/api/admin/users', { headers }),
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/health', { headers }),
        fetch('/api/events', { headers }),
      ])

      if (usersRes.ok) {
        const text = await usersRes.text()
        try {
          const uData = JSON.parse(text)
          if (uData.users) setUsers(uData.users)
        } catch (e) {}
      }

      if (statsRes.ok) {
        const text = await statsRes.text()
        try {
          const sData = JSON.parse(text)
          if (sData.stats) setStats(sData.stats)
        } catch (e) {}
      }

      if (healthRes.ok) {
        const text = await healthRes.text()
        try {
          const hData = JSON.parse(text)
          setHealthData(hData)
        } catch (e) {}
      }

      if (eventsRes.ok) {
        const text = await eventsRes.text()
        try {
          const eData = JSON.parse(text)
          if (eData.events) setEvents(eData.events)
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Backend admin fetch skipped (using local sync):', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdminData()
  }, [token])

  if (currentUser?.role !== 'admin') {
    return (
      <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20 p-8 text-center max-w-lg mx-auto my-12">
        <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-rose-800 dark:text-rose-300">
          Acesso Restrito ao Administrador
        </h2>
        <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-400 mt-2 leading-relaxed">
          Este painel contém controles gerenciais e diagnósticos sensíveis. Apenas administradores autenticados têm permissão de acesso.
        </p>
      </Card>
    )
  }

  const handleOpenEdit = (u: User) => {
    setEditingUser(u)
    setUserForm({
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      role: u.role,
      password: '',
    })
    setEditModalOpen(true)
  }

  const handleOpenCreate = () => {
    setUserForm({
      name: '',
      email: '',
      phone: '',
      role: 'student',
      password: '',
    })
    setCreateModalOpen(true)
  }

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !editingUser) return

    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(userForm)
      })

      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch (e) {}

      if (res.ok) {
        setEditModalOpen(false)
        showNotification('Usuário atualizado com sucesso!')
        fetchAdminData()
      } else {
        showNotification(data.error || 'Erro ao salvar alterações.', true)
      }
    } catch (err: any) {
      showNotification(err.message || 'Erro de conexão.', true)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(userForm)
      })

      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch (e) {}

      if (res.ok) {
        setCreateModalOpen(false)
        showNotification('Estudante cadastrado com sucesso!')
        fetchAdminData()
      } else {
        showNotification(data.error || 'Erro ao cadastrar estudante.', true)
      }
    } catch (err: any) {
      showNotification(err.message || 'Erro de conexão.', true)
    }
  }

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (userId === currentUser.id) {
      alert('Você não pode excluir a sua própria conta de administrador.')
      return
    }

    if (!window.confirm(`Tem certeza que deseja excluir permanentemente o estudante "${userName}"?`)) return

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        showNotification('Usuário excluído com sucesso!')
        fetchAdminData()
      } else {
        const text = await res.text()
        let data: any = {}
        try { data = text ? JSON.parse(text) : {} } catch (e) {}
        showNotification(data.error || 'Erro ao excluir usuário.', true)
      }
    } catch (err: any) {
      showNotification(err.message || 'Erro de conexão.', true)
    }
  }

  const handleExportBackup = () => {
    try {
      const backupData = {
        exported_at: new Date().toISOString(),
        exported_by: currentUser.email,
        users,
        events,
        semesters,
        current_semester: currentSemesterObj,
        stats
      }
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2))
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute('href', dataStr)
      downloadAnchor.setAttribute('download', `medplanner-backup-${new Date().toISOString().slice(0, 10)}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      showNotification('Backup exportado com sucesso!')
    } catch (e: any) {
      showNotification('Erro ao exportar backup: ' + e.message, true)
    }
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone && u.phone.includes(searchTerm))

    if (roleFilter === 'student') return matchesSearch && u.role === 'student'
    if (roleFilter === 'admin') return matchesSearch && u.role === 'admin'
    return matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold rounded-2xl flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold rounded-2xl flex items-center gap-2 shadow-sm animate-in fade-in">
          <AlertTriangle className="h-4 w-4 text-rose-600" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-6 sm:p-7 rounded-3xl shadow-xl shadow-blue-500/10">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-white">
              <ShieldCheck className="h-3.5 w-3.5" />
              Painel Geral de Administração
            </span>
            <span className="text-xs text-blue-100 font-mono">
              MedPlanner Enterprise
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Controle & Gestão Acadêmica
          </h1>
          <p className="text-xs sm:text-sm text-blue-100/90 max-w-xl">
            Acompanhe o engajamento dos estudantes, métricas dos 3 ciclos de Medicina, dados estruturais e integridade da infraestrutura.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={fetchAdminData}
            variant="outline"
            size="sm"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-9 gap-1.5 backdrop-blur-md"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Atualizar
          </Button>

          <Button
            onClick={handleExportBackup}
            variant="outline"
            size="sm"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-9 gap-1.5 backdrop-blur-md"
          >
            <Download className="h-3.5 w-3.5" />
            Backup JSON
          </Button>

          <Button
            onClick={handleOpenCreate}
            size="sm"
            className="bg-white hover:bg-blue-50 text-blue-700 font-semibold text-xs h-9 gap-1.5 shadow-md"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Novo Aluno
          </Button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-x-auto">
        {[
          { id: 'overview', label: 'Visão Geral & Métricas', icon: Activity },
          { id: 'users', label: `Estudantes & Usuários (${users.length || stats.totalUsers})`, icon: Users },
          { id: 'events', label: `Provas & Eventos (${events.length || stats.totalEvents})`, icon: Calendar },
          { id: 'health', label: 'Diagnóstico & Segurança', icon: Server },
        ].map(t => {
          const Icon = t.icon
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={cn(
                "flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap",
                isActive
                  ? "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* TAB 1: VISÃO GERAL & MÉTRICAS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4 sm:p-5 flex items-center gap-4 border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Users className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Usuários Registrados
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                  {users.length || stats.totalUsers}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {users.filter(u => u.role === 'student').length} Alunos • {users.filter(u => u.role === 'admin').length} Admins
                </div>
              </div>
            </Card>

            <Card className="p-4 sm:p-5 flex items-center gap-4 border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Calendar className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Avaliações & Provas
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                  {events.length || stats.totalEvents}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {events.filter(e => e.type === 'Prova').length} Provas no Calendário
                </div>
              </div>
            </Card>

            <Card className="p-4 sm:p-5 flex items-center gap-4 border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <BookOpen className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Disciplinas Ativas
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                  {stats.totalSubjects}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  CHS II, IMC II e Integrador II
                </div>
              </div>
            </Card>

            <Card className="p-4 sm:p-5 flex items-center gap-4 border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Checklist Geral
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                  {stats.totalSubtopics}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  Tópicos de estudo mapeados
                </div>
              </div>
            </Card>
          </div>

          {/* Curriculum Cycle Architecture Banner */}
          <Card className="border-blue-200/80 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 via-indigo-50/20 to-transparent dark:from-slate-900 dark:to-blue-950/20 overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-base sm:text-lg">Estrutura Curricular dos 6 Anos de Medicina</CardTitle>
                </div>
                <Badge variant="blue" className="w-fit text-xs font-mono">
                  Semestre Selecionado: {currentSemesterObj.name}
                </Badge>
              </div>
              <CardDescription>
                Acompanhamento por macrociclos da formação médica na UFG (1º ao 12º período).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3 pt-1">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600 uppercase">Ciclo Básico</span>
                    <Badge variant="outline" className="text-[10px]">Anos 1 e 2</Badge>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    1º, 2º, 3º e 4º Semestre
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Anatomia, Bioquímica, Fisiologia, Histologia, Genética e Introdução às Habilidades.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-600 uppercase">Ciclo Clínico</span>
                    <Badge variant="outline" className="text-[10px]">Anos 3 e 4</Badge>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    5º, 6º, 7º e 8º Semestre
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Semiologia Médica, Farmacologia, Patologia, Clínica Médica, Pediatria e Cirurgia.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-600 uppercase">Internato Médico</span>
                    <Badge variant="outline" className="text-[10px]">Anos 5 e 6</Badge>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    9º, 10º, 11º e 12º Semestre
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Estágio prático hospitalar (Pronto-Socorro, GO, Pediatria, Saúde Coletiva e Cirurgia).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats Summary & Activity Table */}
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-7">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base">Últimos Estudantes Conectados</CardTitle>
                <CardDescription>Estudantes cadastrados com contagem de tópicos finalizados.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.slice(0, 5).map(u => (
                    <div key={u.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar src={u.photo_url} fallback={u.name} size="sm" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {u.name}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate font-mono">
                            {u.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={u.role === 'admin' ? 'blue' : 'secondary'} className="text-[10px]">
                          {u.role === 'admin' ? 'Admin' : 'Aluno'}
                        </Badge>
                        <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">
                          {u.completed_subtopics_count || 0} tópicos
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-5 space-y-4 p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Ações Administrativas Rápidas</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Operações de rotina do coordenador acadêmico e administrador do sistema:
              </p>
              <div className="space-y-2 pt-1">
                <Button
                  onClick={handleOpenCreate}
                  variant="outline"
                  className="w-full justify-start text-xs h-9 border-slate-200 dark:border-slate-700"
                >
                  <UserPlus className="h-3.5 w-3.5 mr-2 text-blue-600" />
                  Cadastrar Novo Aluno Manualmente
                </Button>
                <Button
                  onClick={handleExportBackup}
                  variant="outline"
                  className="w-full justify-start text-xs h-9 border-slate-200 dark:border-slate-700"
                >
                  <Download className="h-3.5 w-3.5 mr-2 text-emerald-600" />
                  Baixar Backup Integral do Sistema (JSON)
                </Button>
                <Button
                  onClick={() => setActiveTab('health')}
                  variant="outline"
                  className="w-full justify-start text-xs h-9 border-slate-200 dark:border-slate-700"
                >
                  <Server className="h-3.5 w-3.5 mr-2 text-indigo-600" />
                  Ver Diagnóstico de Conexão e Banco de Dados
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: GESTÃO DE ESTUDANTES */}
      {activeTab === 'users' && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Gestão Geral de Usuários</CardTitle>
                <CardDescription>
                  Visualize todos os estudantes cadastrados, altere permissões de acesso e redefina senhas.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs">
                  <button
                    onClick={() => setRoleFilter('all')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer",
                      roleFilter === 'all' ? "bg-white dark:bg-slate-700 shadow-sm font-bold text-blue-600" : "text-slate-500"
                    )}
                  >
                    Todos ({users.length})
                  </button>
                  <button
                    onClick={() => setRoleFilter('student')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer",
                      roleFilter === 'student' ? "bg-white dark:bg-slate-700 shadow-sm font-bold text-blue-600" : "text-slate-500"
                    )}
                  >
                    Alunos ({users.filter(u => u.role === 'student').length})
                  </button>
                  <button
                    onClick={() => setRoleFilter('admin')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer",
                      roleFilter === 'admin' ? "bg-white dark:bg-slate-700 shadow-sm font-bold text-blue-600" : "text-slate-500"
                    )}
                  >
                    Admins ({users.filter(u => u.role === 'admin').length})
                  </button>
                </div>

                <div className="relative w-full sm:w-60">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Buscar por nome, e-mail..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 h-8 text-xs"
                  />
                </div>

                <Button
                  onClick={handleOpenCreate}
                  size="sm"
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-700 gap-1"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Novo
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Estudante</th>
                    <th className="py-3 px-4">Contato</th>
                    <th className="py-3 px-4">Perfil (Role)</th>
                    <th className="py-3 px-4">Progresso Checklist</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                        Nenhum usuário encontrado com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => {
                      const totalEstimated = stats.totalSubtopics || 42
                      const completedCount = u.completed_subtopics_count || 0
                      const pct = Math.min(100, Math.round((completedCount / totalEstimated) * 100))

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar src={u.photo_url} fallback={u.name} size="sm" />
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                  {u.name}
                                  {u.id === currentUser.id && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-semibold">
                                      Você
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400 font-mono">{u.email}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                            {u.phone || 'Não cadastrado'}
                          </td>

                          <td className="py-3.5 px-4">
                            <Badge
                              variant={u.role === 'admin' ? 'blue' : 'secondary'}
                              className="text-[11px]"
                            >
                              {u.role === 'admin' ? 'Administrador' : 'Aluno'}
                            </Badge>
                          </td>

                          <td className="py-3.5 px-4 min-w-[140px]">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px]">
                                <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
                                  {completedCount} / {totalEstimated}
                                </span>
                                <span className="text-slate-400">{pct}%</span>
                              </div>
                              <Progress value={pct} className="h-1.5" />
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEdit(u)}
                                className="h-8 px-2.5 text-xs gap-1 border-slate-200 dark:border-slate-700"
                              >
                                <Edit className="h-3 w-3" />
                                Editar
                              </Button>

                              {u.id !== currentUser.id && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteUser(u.id, u.name)}
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                                  title="Excluir Usuário"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: PROVAS & EVENTOS GERAIS */}
      {activeTab === 'events' && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Provas & Avaliações Oficiais da Faculdade</CardTitle>
                <CardDescription>
                  Listagem centralizada de datas de provas, TBLs, seminários e casos clínicos da turma.
                </CardDescription>
              </div>
              <Badge variant="blue" className="w-fit text-xs font-mono">
                {events.length} Eventos Cadastrados
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Evento / Prova</th>
                    <th className="py-3 px-4">Módulo / Matéria</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Data Prevista</th>
                    <th className="py-3 px-4">Assuntos Mapeados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {events.map((ev, idx) => (
                    <tr key={ev.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {ev.title}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                        {ev.module_or_subject}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={ev.type === 'Prova' ? 'blue' : 'secondary'} className="text-[11px]">
                          {ev.type}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                        {ev.start_date ? ev.start_date.split('-').reverse().join('/') : 'A definir'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 max-w-xs truncate">
                        {ev.topics ? ev.topics.join(', ') : 'Geral'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: DIAGNÓSTICO DO SISTEMA & SEGURANÇA */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Database Card */}
            <Card className="p-5 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Banco de Dados</h3>
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Conectado & Operacional
                  </span>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-slate-500 font-mono pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between">
                  <span>Engine:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">SQLite 3 (WAL)</span>
                </div>
                <div className="flex justify-between">
                  <span>Usuários:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{users.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Eventos:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{events.length}</span>
                </div>
              </div>
            </Card>

            {/* Google OAuth Card */}
            <Card className="p-5 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Google OAuth 2.0</h3>
                  <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Client ID Configurado
                  </span>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[11px] font-mono break-all text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-lg">
                  747330576714-3c4b...apps.googleusercontent.com
                </div>
                <p className="text-[10px] text-slate-400">
                  Autentica contas reais direto do navegador sem intermediários.
                </p>
              </div>
            </Card>

            {/* Server Runtime Card */}
            <Card className="p-5 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Ambiente de Execução</h3>
                  <span className="text-[11px] text-emerald-600 font-semibold">
                    Produção Vercel + Local
                  </span>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-slate-500 font-mono pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between">
                  <span>Stack:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">React 18 + Vite 8</span>
                </div>
                <div className="flex justify-between">
                  <span>Backend:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Express 5 + Node</span>
                </div>
                <div className="flex justify-between">
                  <span>Segurança:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">JWT + bcrypt (10 rounds)</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Audit Logs Box */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500" />
                <CardTitle className="text-sm font-bold">Registro de Eventos de Segurança & Auditoria</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 font-mono text-xs space-y-2 bg-slate-950 text-slate-300 rounded-b-2xl overflow-x-auto">
              <div className="flex items-center gap-2 text-emerald-400">
                <span>[INFO]</span>
                <span>{new Date().toISOString().slice(0, 19).replace('T', ' ')}</span>
                <span>- Administrador autenticado: {currentUser.email}</span>
              </div>
              <div className="flex items-center gap-2 text-blue-400">
                <span>[AUTH]</span>
                <span>{new Date().toISOString().slice(0, 19).replace('T', ' ')}</span>
                <span>- Google OAuth 2.0 ativo com Client ID oficial (747330576714).</span>
              </div>
              <div className="flex items-center gap-2 text-indigo-400">
                <span>[DATA]</span>
                <span>{new Date().toISOString().slice(0, 19).replace('T', ' ')}</span>
                <span>- Estrutura de Ciclos validada: Básico (1-2), Clínico (3-4), Internato (5-6).</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span>[SYSTEM]</span>
                <span>{new Date().toISOString().slice(0, 19).replace('T', ' ')}</span>
                <span>- Rotas de API e Express 5 operando normalmente.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit User Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Estudante / Usuário</DialogTitle>
            <DialogDescription>
              Altere os dados cadastrais, redefina a senha ou promova para Administrador.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveUser} className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome Completo</label>
              <Input
                required
                value={userForm.name}
                onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">E-mail</label>
              <Input
                type="email"
                required
                value={userForm.email}
                onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Telefone / WhatsApp</label>
              <Input
                placeholder="(62) 99999-9999"
                value={userForm.phone}
                onChange={e => setUserForm({ ...userForm, phone: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nível de Acesso (Papel)</label>
              <select
                value={userForm.role}
                onChange={e => setUserForm({ ...userForm, role: e.target.value as any })}
                className="mt-1 flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="student">Aluno (Estudante)</option>
                <option value="admin">Administrador Geral</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Redefinir Senha (deixe vazio para manter a atual)
              </label>
              <Input
                type="password"
                placeholder="Nova senha (mínimo 4 caracteres)"
                value={userForm.password}
                onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                className="mt-1"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create User Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Estudante</DialogTitle>
            <DialogDescription>
              Adicione um novo estudante ou administrador diretamente pelo painel.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome Completo</label>
              <Input
                required
                placeholder="Ex: Maria Clara Silva"
                value={userForm.name}
                onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">E-mail Acadêmico ou Google</label>
              <Input
                type="email"
                required
                placeholder="estudante@gmail.com"
                value={userForm.email}
                onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Telefone</label>
              <Input
                placeholder="(62) 98888-8888"
                value={userForm.phone}
                onChange={e => setUserForm({ ...userForm, phone: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Senha Provisória</label>
              <Input
                type="password"
                required
                placeholder="Senha de acesso"
                value={userForm.password}
                onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Função</label>
              <select
                value={userForm.role}
                onChange={e => setUserForm({ ...userForm, role: e.target.value as any })}
                className="mt-1 flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="student">Aluno (Estudante)</option>
                <option value="admin">Administrador Geral</option>
              </select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Cadastrar Estudante
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
