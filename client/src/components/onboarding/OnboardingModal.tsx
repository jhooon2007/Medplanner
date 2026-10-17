import React, { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSemester } from '@/context/SemesterContext'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { saveRegisteredUserLocally } from '@/lib/userStore'
import {
  CheckCircle2, AlertCircle, GraduationCap,
  Calendar, Phone, User as UserIcon, Mail, ArrowRight, Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const OnboardingModal: React.FC = () => {
  const { user, token, updateProfile } = useAuth()
  const { setCurrentSemester } = useSemester()

  // Track initial presence of fields so we never ask for existing data
  const hasExistingName = Boolean(user?.name && user.name.trim().length >= 2)
  const hasExistingEmail = Boolean(user?.email && user.email.includes('@'))
  const hasExistingPhone = Boolean(user?.phone && user.phone.trim().length >= 8)
  const hasExistingBirthDate = Boolean(user?.birth_date && user.birth_date.trim().length >= 4)
  const hasExistingSemester = Boolean(user?.current_semester && user.current_semester >= 1 && user.current_semester <= 12)

  // Local form state for missing fields
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [birthDate, setBirthDate] = useState(user?.birth_date || '')
  const [selectedSemester, setSelectedSemester] = useState<number>(user?.current_semester || 1)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userEmail = user?.email ? user.email.toLowerCase().trim() : ''
  const storageDoneKey = userEmail ? `medplanner_onboarding_done_${userEmail}` : ''
  const isDoneInLocalStorage =
    localStorage.getItem('medplanner_onboarding_done') === 'true' ||
    (storageDoneKey ? localStorage.getItem(storageDoneKey) === 'true' : false)

  // Absolute check: If user is admin, João Victor (pre-registered), or has completed onboarding: NEVER SHOW!
  if (
    !user ||
    user.role === 'admin' ||
    userEmail === 'jvictor8573@gmail.com' ||
    isDoneInLocalStorage ||
    Boolean(user.onboarding_completed) ||
    (Boolean(user.birth_date) && Boolean(user.current_semester) && Boolean(user.phone))
  ) {
    return null
  }

  // Phone mask helper: (XX) XXXXX-XXXX
  const formatPhone = (val: string) => {
    const numbers = val.replace(/\D/g, '').slice(0, 11)
    if (numbers.length <= 2) return numbers ? `(${numbers}` : ''
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Strict validation of the missing required fields
    const finalName = hasExistingName ? user.name : name.trim()
    const finalEmail = hasExistingEmail ? user.email : email.trim().toLowerCase()
    const finalPhone = hasExistingPhone ? user.phone : phone.trim()
    const finalBirthDate = hasExistingBirthDate ? user.birth_date : birthDate.trim()
    const finalSemester = hasExistingSemester ? (user.current_semester || 1) : selectedSemester

    if (!finalName || finalName.length < 2) {
      setError('Por favor, informe seu nome completo.')
      return
    }
    if (!finalEmail || !finalEmail.includes('@')) {
      setError('Por favor, informe um e-mail válido.')
      return
    }
    if (!finalPhone || finalPhone.replace(/\D/g, '').length < 10) {
      setError('Por favor, informe um telefone válido com DDD (mínimo 10 dígitos).')
      return
    }
    if (!finalBirthDate) {
      setError('Por favor, informe sua data de nascimento.')
      return
    }
    if (!finalSemester || finalSemester < 1 || finalSemester > 12) {
      setError('Selecione seu período acadêmico atual.')
      return
    }

    setLoading(true)

    const payload = {
      name: finalName,
      email: finalEmail,
      phone: finalPhone,
      birth_date: finalBirthDate,
      current_semester: finalSemester,
      onboarding_completed: 1
    }

    try {
      // 1. Send to server if token exists
      let updatedUserObj = {
        ...user,
        ...payload
      }
      let newToken: string | undefined = undefined

      if (token) {
        try {
          const res = await fetch('/api/auth/onboarding', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          })

          if (res.ok) {
            const text = await res.text()
            try {
              const data = JSON.parse(text)
              if (data.user) updatedUserObj = data.user
              if (data.token) newToken = data.token
            } catch (e) {}
          }
        } catch (apiErr) {
          console.warn('API onboarding call fallback to local:', apiErr)
        }
      }

      // 2. Persist in local store
      localStorage.setItem('medplanner_onboarding_done', 'true')
      if (storageDoneKey) {
        localStorage.setItem(storageDoneKey, 'true')
      }
      if (finalEmail) {
        localStorage.setItem(`medplanner_onboarding_done_${finalEmail}`, 'true')
      }
      updatedUserObj.onboarding_completed = 1
      saveRegisteredUserLocally(updatedUserObj)

      // 3. Update global Auth Context
      updateProfile(updatedUserObj, newToken)

      // 4. Update SemesterContext to reflect the student's selected semester
      setCurrentSemester(finalSemester)

    } catch (err: any) {
      setError(err.message || 'Erro ao salvar questionário.')
    } finally {
      setLoading(false)
    }
  }

  const semesterOptions = [
    { num: 1, cycle: 'Básico' },
    { num: 2, cycle: 'Básico' },
    { num: 3, cycle: 'Básico' },
    { num: 4, cycle: 'Básico' },
    { num: 5, cycle: 'Clínico' },
    { num: 6, cycle: 'Clínico' },
    { num: 7, cycle: 'Clínico' },
    { num: 8, cycle: 'Clínico' },
    { num: 9, cycle: 'Internato' },
    { num: 10, cycle: 'Internato' },
    { num: 11, cycle: 'Internato' },
    { num: 12, cycle: 'Internato' },
  ]

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-6 text-white text-center relative overflow-hidden">
          <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-3 shadow-inner">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Bem-vindo ao Med Planner!
          </h2>
          <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-md mx-auto">
            Precisamos de apenas alguns dados acadêmicos obrigatórios para personalizar sua grade curricular e cronograma de provas.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section: Pre-confirmed Fields (Already Known - Never Asked Twice) */}
          {(hasExistingName || hasExistingEmail || hasExistingPhone) && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3.5 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Dados já identificados da sua conta
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {hasExistingName && (
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate"><strong>Nome:</strong> {user.name}</span>
                  </div>
                )}
                {hasExistingEmail && (
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate"><strong>E-mail:</strong> {user.email}</span>
                  </div>
                )}
                {hasExistingPhone && (
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate"><strong>Telefone:</strong> {user.phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dynamic Interactive Fields: Strictly and only asked if missing */}
          <div className="space-y-4">
            {/* 1. Nome Completo (if missing) */}
            {!hasExistingName && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <UserIcon className="h-3.5 w-3.5 text-blue-600" />
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Ana Clara Silva"
                  className="rounded-xl h-10 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  required
                />
              </div>
            )}

            {/* 2. E-mail (if missing) */}
            {!hasExistingEmail && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-blue-600" />
                  E-mail Acadêmico / Pessoal <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aluno@discente.ufg.br"
                  className="rounded-xl h-10 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  required
                />
              </div>
            )}

            {/* 3. Telefone / WhatsApp (if missing) */}
            {!hasExistingPhone && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-blue-600" />
                  Telefone / WhatsApp <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="(62) 99999-9999"
                  maxLength={15}
                  className="rounded-xl h-10 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  required
                />
              </div>
            )}

            {/* 4. Data de Nascimento (if missing) */}
            {!hasExistingBirthDate && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  Data de Nascimento <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="rounded-xl h-10 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  required
                />
              </div>
            )}

            {/* 5. Período Acadêmico Atual (if missing) */}
            {!hasExistingSemester && (
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-blue-600" />
                    Período Acadêmico Atual (Medicina UFG) <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                    {selectedSemester <= 4 ? 'Ciclo Básico' : selectedSemester <= 8 ? 'Ciclo Clínico' : 'Internato'}
                  </span>
                </label>

                {/* 12 Semesters Grid */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {semesterOptions.map((opt) => {
                    const isSelected = selectedSemester === opt.num
                    return (
                      <button
                        type="button"
                        key={opt.num}
                        onClick={() => setSelectedSemester(opt.num)}
                        className={cn(
                          "py-2 px-1.5 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5",
                          isSelected
                            ? "bg-blue-600 border-blue-600 text-white font-bold shadow-md shadow-blue-600/25 scale-[1.02]"
                            : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400"
                        )}
                      >
                        <span className="text-xs font-bold leading-none">{opt.num}º Sem</span>
                        <span className={cn(
                          "text-[9px]",
                          isSelected ? "text-blue-100" : "text-slate-400"
                        )}>
                          {opt.cycle}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2 shadow-lg shadow-blue-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando dados...
                </>
              ) : (
                <>
                  <span>Concluir e Acessar o Med Planner</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 mt-2">
              Seus dados são confidenciais e utilizados exclusivamente para organização da sua rotina acadêmica.
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
