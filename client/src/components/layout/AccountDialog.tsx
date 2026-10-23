import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { Trash2 } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// "Minha conta": dados básicos e exclusão da conta pelo próprio aluno (LGPD)
export const AccountDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { user, token, logout } = useAuth()
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return null
  const isAdmin = user.role === 'admin'

  const close = () => {
    setConfirmText('')
    setError(null)
    onOpenChange(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await api(token, '/api/auth/me', { method: 'DELETE', body: { confirm: confirmText.trim() } })
      try {
        Object.keys(localStorage).filter(k => k.startsWith('medplanner_') && k !== 'medplanner_theme')
          .forEach(k => localStorage.removeItem(k))
      } catch (e) {}
      close()
      logout()
      window.alert('Sua conta e todos os seus dados foram excluídos.')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  // Portal: o cabeçalho tem backdrop-blur, que prende elementos `fixed` dentro dele e cortaria a janela
  return createPortal(
    <Dialog open={open} onOpenChange={o => (o ? onOpenChange(true) : close())}>
      <DialogContent onClose={close}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar src={user.photo_url} fallback={user.name} size="lg" />
            <div className="min-w-0">
              <DialogTitle className="truncate">{user.name}</DialogTitle>
              <DialogDescription className="truncate">{user.email}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isAdmin ? (
          <p className="text-sm text-slate-500">
            Contas de administrador não podem ser excluídas por aqui. Peça a outro administrador, pelo painel.
          </p>
        ) : (
          <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 p-4 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">Excluir minha conta</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Apaga para sempre sua conta, notas, eventos, aulas, matérias e progresso. Não dá para desfazer.
              </p>
            </div>
            <div>
              <label htmlFor="confirm-delete" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Digite <strong>EXCLUIR</strong> para confirmar
              </label>
              <Input id="confirm-delete" value={confirmText} autoComplete="off" className="mt-1"
                onChange={e => setConfirmText(e.target.value)} />
            </div>
            {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
            <Button variant="destructive" className="w-full gap-2"
              disabled={confirmText.trim() !== 'EXCLUIR' || deleting} onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Excluindo...' : 'Excluir minha conta para sempre'}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>,
    document.body
  )
}
