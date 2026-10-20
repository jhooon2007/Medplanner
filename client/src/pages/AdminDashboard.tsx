import React, { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/context/AuthContext'
import { User } from '@/types'
import { api, formatDateTime } from '@/lib/api'
import { StudentsTab } from '@/components/admin/StudentsTab'
import { AnnouncementsTab } from '@/components/admin/AnnouncementsTab'
import { ClassEventsTab } from '@/components/admin/ClassEventsTab'
import {
  ShieldCheck, Users, Calendar, Megaphone, CheckCircle2, AlertTriangle,
  Activity, Server, Download, RefreshCw, UserPlus, UserCheck, ClipboardList
} from 'lucide-react'
import { cn } from '@/lib/utils'

type TabId = 'overview' | 'users' | 'announcements' | 'events' | 'health'

interface Stats {
  totalUsers: number
  totalStudents: number
  totalEvents: number
  totalSubjects: number
  totalSubtopics: number
  newThisWeek: number
  activeThisWeek: number
  pendingOnboarding: number
  activeAnnouncements: number
  bySemester: Array<{ semester: number; count: number }>
}

export const AdminDashboard: React.FC = () => {
  const { token, user: currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const notify = useCallback((msg: string, isErr = false) => {
    if (isErr) {
      setError(msg)
      setTimeout(() => setError(null), 5000)
    } else {
      setSuccess(msg)
      setTimeout(() => setSuccess(null), 3000)
    }
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [usersData, statsData, healthData] = await Promise.all([
        api<{ users: User[] }>(token, '/api/admin/users'),
        api<{ stats: Stats }>(token, '/api/admin/stats'),
        api<any>(token, '/api/admin/health'),
      ])
      setUsers(usersData.users)
      setStats(statsData.stats)
      setHealth(healthData)
      setLoadError(null)
    } catch (err: any) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { reload() }, [reload])

  if (currentUser?.role !== 'admin') {
    return (
      <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20 p-8 text-center max-w-lg mx-auto my-12">
        <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-rose-800 dark:text-rose-300">Acesso Restrito ao Administrador</h2>
        <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-400 mt-2 leading-relaxed">
          Apenas administradores autenticados têm permissão de acesso a este painel.
        </p>
      </Card>
    )
  }

  const handleExportBackup = async () => {
    try {
      const events = await api<{ events: unknown[] }>(token, '/api/admin/events')
      const backup = { exported_at: new Date().toISOString(), exported_by: currentUser.email, stats, users, class_events: events.events }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `medplanner-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      notify('Backup exportado com sucesso!')
    } catch (err: any) {
      notify('Erro ao exportar backup: ' + err.message, true)
    }
  }

  const tabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
    { id: 'overview', label: 'Visão Geral', icon: Activity },
    { id: 'users', label: `Alunos (${stats?.totalUsers ?? users.length})`, icon: Users },
    { id: 'announcements', label: 'Avisos', icon: Megaphone },
    { id: 'events', label: 'Provas da Turma', icon: Calendar },
    { id: 'health', label: 'Sistema', icon: Server },
  ]

  const recentLogins = [...users]
    .filter(u => u.last_login_at)
    .sort((a, b) => (b.last_login_at || '').localeCompare(a.last_login_at || ''))
    .slice(0, 6)

  const maxSemesterCount = Math.max(1, ...(stats?.bySemester.map(s => s.count) || [1]))

  return (
    <div className="space-y-6">
      {success && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold rounded-2xl flex items-center gap-2" role="status">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold rounded-2xl flex items-center gap-2" role="alert">
          <AlertTriangle className="h-4 w-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-6 sm:p-7 rounded-3xl shadow-xl shadow-blue-500/10">
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/20 px-2.5 py-0.5 rounded-full">
            <ShieldCheck className="h-3.5 w-3.5" />
            Painel de Administração
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Controle & Gestão Acadêmica</h1>
          <p className="text-xs sm:text-sm text-blue-100/90 max-w-xl">
            Acompanhe quem usa o app, publique avisos para a turma e atualize provas para todos de uma vez.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button onClick={reload} variant="outline" size="sm"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-9 gap-1.5">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Atualizar
          </Button>
          <Button onClick={handleExportBackup} variant="outline" size="sm"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-9 gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Backup JSON
          </Button>
        </div>
      </div>

      {loadError && (
        <Card className="border-rose-200 dark:border-rose-900/50 p-4 text-sm text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
          <span>Não foi possível carregar os dados do servidor: {loadError}</span>
          <Button size="sm" variant="outline" onClick={reload}>Tentar novamente</Button>
        </Card>
      )}

      <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap',
                activeTab === t.id
                  ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              )}>
              <Icon className="h-4 w-4 shrink-0" />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={Users} color="blue" label="Alunos cadastrados" value={stats?.totalStudents} hint={`${stats?.newThisWeek ?? 0} novos nos últimos 7 dias`} />
            <Kpi icon={UserCheck} color="emerald" label="Ativos na semana" value={stats?.activeThisWeek} hint="Entraram nos últimos 7 dias" />
            <Kpi icon={ClipboardList} color="amber" label="Cadastro incompleto" value={stats?.pendingOnboarding} hint="Ainda não responderam o questionário" />
            <Kpi icon={Megaphone} color="indigo" label="Avisos no ar" value={stats?.activeAnnouncements} hint={`${stats?.totalEvents ?? 0} provas/eventos da turma`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base">Últimos acessos</CardTitle>
                <CardDescription>Quem entrou no app mais recentemente.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {recentLogins.length === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-500">Nenhum acesso registrado ainda.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recentLogins.map(u => (
                      <div key={u.id} className="p-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar src={u.photo_url} fallback={u.name} size="sm" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{u.name}</div>
                            <div className="text-[11px] text-slate-400 truncate font-mono">{u.email}</div>
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-500 whitespace-nowrap">{formatDateTime(u.last_login_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base">Alunos por período</CardTitle>
                <CardDescription>Distribuição conforme o questionário inicial.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                {!stats || stats.bySemester.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-500">Sem dados de período ainda.</p>
                ) : stats.bySemester.map(s => (
                  <div key={s.semester} className="flex items-center gap-3 text-xs">
                    <span className="w-20 text-slate-600 dark:text-slate-300">{s.semester}º semestre</span>
                    <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(s.count / maxSemesterCount) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right font-mono font-semibold">{s.count}</span>
                  </div>
                ))}
                <div className="pt-3 flex gap-2">
                  <Button size="sm" variant="accent" className="text-xs gap-1.5" onClick={() => setActiveTab('announcements')}>
                    <Megaphone className="h-3.5 w-3.5" /> Criar aviso geral
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => setActiveTab('users')}>
                    <UserPlus className="h-3.5 w-3.5" /> Ver alunos
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'users' && <StudentsTab users={users} loading={loading} reload={reload} notify={notify} />}
      {activeTab === 'announcements' && <AnnouncementsTab notify={notify} />}
      {activeTab === 'events' && <ClassEventsTab notify={notify} />}

      {activeTab === 'health' && (
        <Card>
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-lg">Diagnóstico do sistema</CardTitle>
            <CardDescription>Estado do servidor e do banco de dados.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            {!health ? (
              <p className="text-sm text-slate-500">Sem dados de diagnóstico.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success">Servidor {health.status === 'healthy' ? 'saudável' : health.status}</Badge>
                  <Badge variant="blue">{health.database?.type}</Badge>
                  <Badge variant="secondary">Node {health.node_version}</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(health.database?.records || {}).map(([k, v]) => (
                    <div key={k} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{k.replace('_', ' ')}</div>
                      <div className="text-xl font-black font-mono text-slate-900 dark:text-white">{String(v)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const KPI_COLORS: Record<string, string> = {
  blue: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400',
  emerald: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400',
  indigo: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400',
}

const Kpi: React.FC<{ icon: React.ElementType; color: string; label: string; value?: number; hint: string }> = ({ icon: Icon, color, label, value, hint }) => (
  <Card className="p-4 sm:p-5 flex items-center gap-4 border-slate-200 dark:border-slate-800">
    <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center shrink-0', KPI_COLORS[color])}>
      <Icon className="h-6 w-6" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5">{value ?? '—'}</div>
      <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{hint}</div>
    </div>
  </Card>
)
