import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { Upload, Stethoscope, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react'

interface AuthModalProps {
  open: boolean
  onClose?: () => void
}

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose }) => {
  const { login } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isRegister) {
        const formData = new FormData()
        formData.append('name', name)
        formData.append('email', email)
        formData.append('password', password)
        if (phone) formData.append('phone', phone)
        if (photoFile) formData.append('photo', photoFile)

        const res = await fetch('/api/auth/register', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Erro ao realizar cadastro')
        }

        login(data.token, data.user)
        if (onClose) onClose()
      } else {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Erro ao realizar login')
        }

        login(data.token, data.user)
        if (onClose) onClose()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Quick Demo logins
  const handleQuickLogin = async (userEmail: string, userPass: string) => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, password: userPass }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha no login')
      login(data.token, data.user)
      if (onClose) onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose && onClose()}>
      <DialogContent className="max-w-md sm:p-7 border-slate-200/80 shadow-2xl">
        <DialogHeader className="text-center sm:text-center items-center">
          <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mb-2">
            <Stethoscope className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Med Planner by João Victor
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-slate-500">
            {isRegister
              ? 'Complete seu cadastro no primeiro acesso para personalizar seu plano de estudos.'
              : 'Acesse seu planejamento acadêmico, horários e notas da faculdade.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs sm:text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 mt-2">
          {isRegister && (
            <>
              {/* Photo Upload */}
              <div className="flex items-center justify-center gap-4 py-1">
                <div className="relative group cursor-pointer">
                  <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-blue-500/30 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                    ) : (
                      <Upload className="h-6 w-6 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <div className="text-left text-xs text-slate-500">
                  <p className="font-medium text-slate-700 dark:text-slate-300">Foto de Perfil</p>
                  <p>Clique no círculo para escolher uma foto</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome Completo</label>
                <Input
                  required
                  placeholder="Ex: João Victor"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Telefone (WhatsApp)</label>
                <Input
                  placeholder="(62) 99999-9999"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="mt-1"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">E-mail</label>
            <Input
              type="email"
              required
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Senha</label>
            <Input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="mt-1"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full mt-4 h-11 text-sm font-semibold bg-blue-600 hover:bg-blue-700">
            {loading ? 'Processando...' : isRegister ? 'Concluir Cadastro e Entrar' : 'Entrar no Sistema'}
          </Button>

          <div className="flex items-center justify-between text-xs pt-1 text-slate-500">
            <span>{isRegister ? 'Já tem uma conta?' : 'Primeiro acesso na plataforma?'}</span>
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister)
                setError(null)
              }}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold underline underline-offset-2"
            >
              {isRegister ? 'Fazer Login' : 'Cadastre-se aqui'}
            </button>
          </div>
        </form>

        {/* Quick Demo Access Buttons */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-center text-slate-400 mb-2.5 font-medium">Acesso Rápido para Testes:</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickLogin('joao@medplanner.com', 'aluno123')}
              className="text-xs flex items-center justify-center gap-1.5 h-9 border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
            >
              <UserCheck className="h-3.5 w-3.5" />
              Entrar como João Victor (Aluno)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickLogin('admin@medplanner.com', 'admin123')}
              className="text-xs flex items-center justify-center gap-1.5 h-9 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Entrar como Admin
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
