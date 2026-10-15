import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { useAuth } from '@/context/AuthContext'
import { User } from '@/types'
import {
  ShieldCheck, Users, Calendar, BookOpen, Edit, Trash2,
  CheckCircle2, AlertTriangle, Search
} from 'lucide-react'

export const AdminDashboard: React.FC = () => {
  const { token, user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<any>({
    totalUsers: 0,
    totalStudents: 0,
    totalEvents: 0,
    totalSubjects: 0,
    totalSubtopics: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Edit User Modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'student' as 'admin' | 'student',
    password: '',
  })

  const fetchAdminData = async () => {
    if (!token) return

    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } }),
      ])

      if (usersRes.ok) {
        const uData = await usersRes.json()
        setUsers(uData.users || [])
      }

      if (statsRes.ok) {
        const sData = await statsRes.json()
        setStats(sData.stats || {})
      }
    } catch (err) {
      console.error('Error fetching admin data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdminData()
  }, [token])

  if (currentUser?.role !== 'admin') {
    return (
      <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20 p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-2" />
        <h2 className="text-lg font-bold text-rose-800 dark:text-rose-300">
          Acesso Restrito
        </h2>
        <p className="text-sm text-rose-600 dark:text-rose-400 mt-1">
          Apenas usuários com privilégios de Administrador podem acessar esta área.
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

      if (res.ok) {
        setEditModalOpen(false)
        fetchAdminData()
      }
    } catch (err) {
      console.error('Error saving user:', err)
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (userId === currentUser.id) {
      alert('Você não pode excluir a sua própria conta de administrador.')
      return
    }

    if (!token || !window.confirm('Tem certeza que deseja excluir permanentemente este usuário?')) return

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        fetchAdminData()
      }
    } catch (err) {
      console.error('Error deleting user:', err)
    }
  }

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Dashboard do Administrador
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestão centralizada de estudantes, dados estruturais da faculdade e métricas do aplicativo.
          </p>
        </div>

        <Badge variant="outline" className="text-xs py-1 px-3 border-blue-500/30 text-blue-700 dark:text-blue-300">
          UFG Medicina • Semestre 2026.2
        </Badge>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 sm:p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Usuários Totais
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {stats.totalUsers}
            </div>
            <div className="text-[11px] text-slate-500">
              {stats.totalStudents} estudante(s) ativos
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Eventos & Provas
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {stats.totalEvents}
            </div>
            <div className="text-[11px] text-slate-500">
              Cadastrados no calendário
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Disciplinas Ativas
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {stats.totalSubjects}
            </div>
            <div className="text-[11px] text-slate-500">
              CHS II, IMC II e Integrador
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Tópicos de Estudo
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {stats.totalSubtopics}
            </div>
            <div className="text-[11px] text-slate-500">
              Cadastrados no checklist
            </div>
          </div>
        </Card>
      </div>

      {/* Users Management Section */}
      <Card>
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Usuários Cadastrados</CardTitle>
              <CardDescription>
                Acompanhe os dados dos estudantes, progresso individual e gerencie papéis de acesso.
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
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
                  <th className="py-3 px-4">Perfil</th>
                  <th className="py-3 px-4">Progresso Checklist</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={u.photo_url}
                            fallback={u.name}
                            size="sm"
                          />
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              {u.name}
                              {u.id === currentUser.id && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">Você</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                        {u.phone || 'Não informado'}
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge variant={u.role === 'admin' ? 'blue' : 'secondary'} className="text-[11px]">
                          {u.role === 'admin' ? 'Administrador' : 'Aluno'}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                            {u.completed_subtopics_count || 0}
                          </span>
                          <span className="text-xs text-slate-400">tópicos concluídos</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEdit(u)}
                            className="h-8 px-2 text-xs gap-1"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Editar
                          </Button>

                          {u.id !== currentUser.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteUser(u.id)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                              title="Excluir Usuário"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Informações do Usuário</DialogTitle>
            <DialogDescription>
              Altere os dados cadastrais, redefina a senha ou altere o nível de acesso.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveUser} className="space-y-3.5 mt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome</label>
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
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Telefone</label>
              <Input
                value={userForm.phone}
                onChange={e => setUserForm({ ...userForm, phone: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nível de Acesso (Role)</label>
              <select
                value={userForm.role}
                onChange={e => setUserForm({ ...userForm, role: e.target.value as any })}
                className="mt-1 flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="student">Aluno (Usuário Comum)</option>
                <option value="admin">Administrador (Admin)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Redefinir Senha (deixe em branco para manter a atual)
              </label>
              <Input
                type="password"
                placeholder="Nova senha (opcional)"
                value={userForm.password}
                onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                className="mt-1"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Salvar Alterações</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
