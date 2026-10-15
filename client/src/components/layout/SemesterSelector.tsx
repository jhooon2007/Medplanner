import React, { useState } from 'react'
import { useSemester } from '@/context/SemesterContext'
import { GraduationCap, ChevronDown, Plus, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

export const SemesterSelector: React.FC = () => {
  const { semesters, currentSemester, currentSemesterObj, setCurrentSemester, addSemester } = useSemester()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [newSemName, setNewSemName] = useState('')
  const [newSemPeriod, setNewSemPeriod] = useState('')

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSemName.trim()) return
    addSemester(newSemName, newSemPeriod)
    setNewSemName('')
    setNewSemPeriod('')
    setModalOpen(false)
    setDropdownOpen(false)
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all cursor-pointer shadow-sm"
        >
          <GraduationCap className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>{currentSemesterObj.name}</span>
          <ChevronDown className={cn("h-3 w-3 transition-transform text-blue-500", dropdownOpen && "rotate-180")} />
        </button>

        {dropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setDropdownOpen(false)}
            />
            <div className="absolute left-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2 space-y-1 max-h-80 overflow-y-auto">
              <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Selecionar Semestre
              </div>

              {semesters.map(s => {
                const isSelected = s.number === currentSemester
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setCurrentSemester(s.number)
                      setDropdownOpen(false)
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer",
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span>{s.name}</span>
                        {s.number === 2 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            Padrão
                          </span>
                        )}
                      </div>
                      {s.year_period && (
                        <div className="text-[10px] text-slate-400">{s.year_period}</div>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                  </button>
                )
              })}

              <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    setModalOpen(true)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Adicionar Novo Semestre</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal Add Semester */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Semestre</DialogTitle>
            <DialogDescription>
              Cadastre um novo período acadêmico para organizar matérias e provas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-3.5 mt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nome do Semestre
              </label>
              <Input
                required
                placeholder="Ex: 3º Semestre"
                value={newSemName}
                onChange={e => setNewSemName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Ciclo / Ano (Opcional)
              </label>
              <Input
                placeholder="Ex: Ciclo Clínico • 2027.1"
                value={newSemPeriod}
                onChange={e => setNewSemPeriod(e.target.value)}
                className="mt-1"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Criar Semestre
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
