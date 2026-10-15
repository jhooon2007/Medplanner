import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { GradeItem } from '@/types'
import { Calculator, Award, AlertCircle, CheckCircle2, Save, Sparkles, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export const GradeCalculator: React.FC = () => {
  const { token, user } = useAuth()
  const [activeModule, setActiveModule] = useState<'CHS_II' | 'IMC_II' | 'INTEGRADOR_II'>('CHS_II')
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Grade state map with LocalStorage persistence
  const [scores, setScores] = useState<Record<string, number | ''>>(() => {
    try {
      const saved = localStorage.getItem('medplanner_grades')
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return {
      // CHS II: Anatomia
      'ANA_N1_PROVA': 8.0,
      'ANA_N1_PARTICIPACAO': 1.0,
      'ANA_N2_PROVA': 7.5,
      'ANA_N2_PARTICIPACAO': 1.0,
      'ANA_N2_SEMINARIO': 1.5,

      // CHS II: Bioquímica
      'BIOQ_N1': 7.5,
      'BIOQ_N2': 8.0,
      'BIOQ_N3': 7.0,
      'BIOQ_N4': 8.5,

    // CHS II: Fisiologia
    'FISIO_A1': 7.5,
    'FISIO_A2': 8.0,
    'FISIO_A3': 7.0,

    // CHS II: Histologia
    'HISTO_P1': 8.0,
    'HISTO_P2': 7.5,
    'HISTO_P3': 8.5,
    'HISTO_P4': 8.0,
    'HISTO_EXTRA': 0.5,

    // CHS II & Integrador
    'INTEG_FORUM_1': 9.0,
    'INTEG_FORUM_2': 8.5,
    'INTEG_CASO_CLINICO': 8.0,

    // IMC II: M1 (6 Role Play + 2 HC)
    'IMC_RP_1': 8.5,
    'IMC_RP_2': 9.0,
    'IMC_RP_3': 8.0,
    'IMC_RP_4': 8.5,
    'IMC_RP_5': 9.0,
    'IMC_RP_6': 8.5,
    'IMC_HC_1': 8.0,
    'IMC_HC_2': 8.5,

    // IMC II: M2 (6 TBLs: indiv + grupo, e 6 Casos Clínicos)
    'IMC_TBL_1_IND': 8.0, 'IMC_TBL_1_GRP': 9.0,
    'IMC_TBL_2_IND': 7.5, 'IMC_TBL_2_GRP': 8.5,
    'IMC_TBL_3_IND': 8.0, 'IMC_TBL_3_GRP': 9.0,
    'IMC_TBL_4_IND': 8.5, 'IMC_TBL_4_GRP': 9.5,
    'IMC_TBL_5_IND': 7.0, 'IMC_TBL_5_GRP': 8.5,
    'IMC_TBL_6_IND': 8.0, 'IMC_TBL_6_GRP': 9.0,

    'IMC_CC_1': 8.5,
    'IMC_CC_2': 8.0,
    'IMC_CC_3': 9.0,
    'IMC_CC_4': 8.5,
    'IMC_CC_5': 8.0,
    'IMC_CC_6': 8.5,

    // IMC II Prova Final
    'IMC_PROVA_FINAL': '',
  }
})

  // Load existing grades from DB
  useEffect(() => {
    if (!token) return

    const loadGrades = async () => {
      try {
        const res = await fetch('/api/grades', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          if (data.grades && data.grades.length > 0) {
            setScores(prev => {
              const updated = { ...prev }
              data.grades.forEach((g: GradeItem) => {
                if (g.score !== null && g.score !== undefined) {
                  updated[g.item_key] = g.score
                }
              })
              return updated
            })
          }
        }
      } catch (err) {
        console.error('Error loading grades:', err)
      }
    }

    loadGrades()
  }, [token])

  const handleScoreChange = (key: string, val: string) => {
    const num = val === '' ? '' : parseFloat(val)
    setScores(prev => ({ ...prev, [key]: num }))
    setSavedSuccess(false)
  }

  const getVal = (key: string, defaultVal = 0): number => {
    const v = scores[key]
    if (v === '' || v === undefined || isNaN(v as number)) return defaultVal
    return Number(v)
  }

  // CHS II
  const anaN1 = Math.min(10, getVal('ANA_N1_PROVA') + getVal('ANA_N1_PARTICIPACAO'))
  const anaN2 = Math.min(10, getVal('ANA_N2_PROVA') + getVal('ANA_N2_PARTICIPACAO') + getVal('ANA_N2_SEMINARIO'))
  const mediaAnatomia = (anaN1 + anaN2) / 2
  const mediaBioquimica = (getVal('BIOQ_N1') + getVal('BIOQ_N2') + getVal('BIOQ_N3') + getVal('BIOQ_N4')) / 4
  const mediaFisiologia = (getVal('FISIO_A1') * 3.5 + getVal('FISIO_A2') * 4.0 + getVal('FISIO_A3') * 2.5) / 10
  const histoSomaProvas = (getVal('HISTO_P1') + getVal('HISTO_P2') + getVal('HISTO_P3') + getVal('HISTO_P4')) / 4
  const mediaHistologia = Math.min(10, histoSomaProvas + Math.min(0.5, getVal('HISTO_EXTRA')))

  const prodCHS = Math.max(0.001, mediaAnatomia) *
                  Math.max(0.001, mediaBioquimica) *
                  Math.max(0.001, mediaFisiologia) *
                  Math.max(0.001, mediaHistologia)
  const mediaGeometricaCHS = Math.pow(prodCHS, 1 / 4)
  const mediaIntegrador = (getVal('INTEG_FORUM_1') + getVal('INTEG_FORUM_2') + getVal('INTEG_CASO_CLINICO')) / 3
  const notaFinalCHS = (mediaGeometricaCHS * (mediaIntegrador / 10))

  // IMC II
  const rpList = [1, 2, 3, 4, 5, 6].map(i => Math.max(0.001, getVal(`IMC_RP_${i}`)))
  const hcList = [1, 2].map(i => Math.max(0.001, getVal(`IMC_HC_${i}`)))
  const prodM1 = [...rpList, ...hcList].reduce((acc, v) => acc * v, 1)
  const mediaM1 = Math.pow(prodM1, 1 / 8)

  const tblScores = [1, 2, 3, 4, 5, 6].map(i => {
    const ind = getVal(`IMC_TBL_${i}_IND`)
    const grp = getVal(`IMC_TBL_${i}_GRP`)
    return Math.max(0.001, (ind * 0.7) + (grp * 0.3))
  })
  const ccScores = [1, 2, 3, 4, 5, 6].map(i => Math.max(0.001, getVal(`IMC_CC_${i}`)))
  const prodM2 = [...tblScores, ...ccScores].reduce((acc, v) => acc * v, 1)
  const mediaM2 = Math.pow(prodM2, 1 / 12)

  const provaFinalIMC = scores['IMC_PROVA_FINAL'] !== '' ? Number(scores['IMC_PROVA_FINAL']) : null
  const mediaFinalIMC = provaFinalIMC !== null
    ? (mediaM1 * 0.25) + (mediaM2 * 0.25) + (provaFinalIMC * 0.50)
    : (mediaM1 * 0.25) + (mediaM2 * 0.25)

  const notaNecessariaPF = Math.max(0, (6.0 - (mediaM1 * 0.25 + mediaM2 * 0.25)) / 0.50)

  const handleSaveGrades = async () => {
    if (!token) return
    setSaving(true)
    try {
      const gradesList = Object.entries(scores).map(([key, val]) => {
        let moduleName = 'CHS_II'
        let disc: string | undefined = undefined

        if (key.startsWith('ANA_')) { moduleName = 'CHS_II'; disc = 'Anatomia' }
        else if (key.startsWith('BIOQ_')) { moduleName = 'CHS_II'; disc = 'Bioquímica' }
        else if (key.startsWith('FISIO_')) { moduleName = 'CHS_II'; disc = 'Fisiologia' }
        else if (key.startsWith('HISTO_')) { moduleName = 'CHS_II'; disc = 'Histologia' }
        else if (key.startsWith('INTEG_')) { moduleName = 'INTEGRADOR_II'; disc = 'Integrador' }
        else if (key.startsWith('IMC_')) { moduleName = 'IMC_II'; disc = 'Método Clínico' }

        return {
          module: moduleName,
          discipline: disc,
          item_key: key,
          item_name: key,
          score: val === '' ? null : Number(val),
        }
      })

      const res = await fetch('/api/grades/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ gradesList })
      })

      if (res.ok) {
        setSavedSuccess(true)
        setTimeout(() => setSavedSuccess(false), 3000)
      }
    } catch (err) {
      console.error('Error saving grades:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header: Clean title without Aba 3 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Cálculo de Notas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Algoritmos oficiais da UFG (médias geométricas e ponderadas) com projeção de aprovação.
          </p>
        </div>

        {user && (
          <Button
            onClick={handleSaveGrades}
            disabled={saving}
            className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 h-9"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {savedSuccess ? 'Salvo com Sucesso!' : 'Salvar Minhas Notas'}
          </Button>
        )}
      </div>

      {/* Module Selector Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        {[
          { id: 'CHS_II', label: 'Corpo Humano Saudável II (CHS II)' },
          { id: 'IMC_II', label: 'Introdução ao Método Clínico II (IMC II)' },
          { id: 'INTEGRADOR_II', label: 'Módulo Integrador II' },
        ].map(mod => (
          <button
            key={mod.id}
            onClick={() => setActiveModule(mod.id as any)}
            className={cn(
              "flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer text-center",
              activeModule === mod.id
                ? "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            {mod.label}
          </button>
        ))}
      </div>

      {/* CHS II */}
      {activeModule === 'CHS_II' && (
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent border-blue-500/30 overflow-hidden">
            <div className="p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="blue">Resultado CHS II</Badge>
                  <span className="text-xs text-slate-500 font-medium">Média mínima: 6,0</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Nota Final Calculada: {notaFinalCHS.toFixed(2)}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
                  <strong>Fórmula UFG:</strong> Média Geométrica das 4 disciplinas ({mediaGeometricaCHS.toFixed(2)}) × Média Aritmética do Integrador ({(mediaIntegrador / 10).toFixed(3)}).
                </p>
              </div>

              <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0">
                <div className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center font-bold text-xl",
                  notaFinalCHS >= 6.0
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                )}>
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">Situação Acadêmica</div>
                  <div className={cn(
                    "text-base font-bold",
                    notaFinalCHS >= 6.0 ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"
                  )}>
                    {notaFinalCHS >= 6.0 ? 'Aprovado' : 'Atenção / Recuperação'}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Anatomia */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-blue-600 dark:text-blue-400">
                    Anatomia Humana
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-bold font-mono">
                    Média: {mediaAnatomia.toFixed(2)}
                  </Badge>
                </div>
                <CardDescription>
                  Média = (N1 + N2) / 2 • N1 (Prova + Part) e N2 (Prova + Part + Sem)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N1 Prova</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scores['ANA_N1_PROVA']}
                      onChange={e => handleScoreChange('ANA_N1_PROVA', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N1 Participação</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scores['ANA_N1_PARTICIPACAO']}
                      onChange={e => handleScoreChange('ANA_N1_PARTICIPACAO', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div className="col-span-2 text-[11px] text-slate-400 text-right">
                    Subtotal N1: <span className="font-semibold text-slate-700 dark:text-slate-300">{anaN1.toFixed(1)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N2 Prova</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scores['ANA_N2_PROVA']}
                      onChange={e => handleScoreChange('ANA_N2_PROVA', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N2 Part.</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scores['ANA_N2_PARTICIPACAO']}
                      onChange={e => handleScoreChange('ANA_N2_PARTICIPACAO', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Seminário</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scores['ANA_N2_SEMINARIO']}
                      onChange={e => handleScoreChange('ANA_N2_SEMINARIO', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div className="col-span-3 text-[11px] text-slate-400 text-right">
                    Subtotal N2: <span className="font-semibold text-slate-700 dark:text-slate-300">{anaN2.toFixed(1)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bioquímica */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-indigo-600 dark:text-indigo-400">
                    Bioquímica Médica
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-bold font-mono">
                    Média: {mediaBioquimica.toFixed(2)}
                  </Badge>
                </div>
                <CardDescription>
                  Média aritmética de 4 avaliações (N1, N2, N3 e N4)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N1 (Glicólise)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scores['BIOQ_N1']}
                      onChange={e => handleScoreChange('BIOQ_N1', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N2 (Lipídeos)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scores['BIOQ_N2']}
                      onChange={e => handleScoreChange('BIOQ_N2', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N3 (Integração)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scores['BIOQ_N3']}
                      onChange={e => handleScoreChange('BIOQ_N3', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N4 (Teatro)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scores['BIOQ_N4']}
                      onChange={e => handleScoreChange('BIOQ_N4', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fisiologia */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-sky-600 dark:text-sky-400">
                    Fisiologia Humana
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-bold font-mono">
                    Média: {mediaFisiologia.toFixed(2)}
                  </Badge>
                </div>
                <CardDescription>
                  1ª Avaliação (peso 3,5) • 2ª Avaliação (peso 4,0) • 3ª Avaliação (peso 2,5)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">A1 (Cardio)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scores['FISIO_A1']}
                      onChange={e => handleScoreChange('FISIO_A1', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Peso 3,5</span>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">A2 (Resp.)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scores['FISIO_A2']}
                      onChange={e => handleScoreChange('FISIO_A2', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Peso 4,0</span>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">A3 (Digest/Renal)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scores['FISIO_A3']}
                      onChange={e => handleScoreChange('FISIO_A3', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Peso 2,5</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Histologia */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-blue-600 dark:text-blue-400">
                    Histologia e Embriologia
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-bold font-mono">
                    Média: {mediaHistologia.toFixed(2)}
                  </Badge>
                </div>
                <CardDescription>
                  Média aritmética de 4 provas + até 0,5 ponto extra de práticas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">1ª Teórica</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scores['HISTO_P1']}
                      onChange={e => handleScoreChange('HISTO_P1', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">1ª Prática</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scores['HISTO_P2']}
                      onChange={e => handleScoreChange('HISTO_P2', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">2ª Teórica</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scores['HISTO_P3']}
                      onChange={e => handleScoreChange('HISTO_P3', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">2ª Prática</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scores['HISTO_P4']}
                      onChange={e => handleScoreChange('HISTO_P4', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Ponto Extra Prático</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="0.5"
                      placeholder="Max 0.5"
                      value={scores['HISTO_EXTRA']}
                      onChange={e => handleScoreChange('HISTO_EXTRA', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* IMC II */}
      {activeModule === 'IMC_II' && (
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-blue-500/10 via-sky-500/5 to-transparent border-blue-500/30 overflow-hidden">
            <div className="p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="blue">Média Final IMC II</Badge>
                  <span className="text-xs text-slate-500 font-medium">Fórmula: (M1 × 0,25) + (M2 × 0,25) + (Prova Final × 0,5)</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  M1: {mediaM1.toFixed(2)} • M2: {mediaM2.toFixed(2)} • MF: {provaFinalIMC !== null ? mediaFinalIMC.toFixed(2) : 'Aguardando Prova Final'}
                </h2>
                <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-blue-200/60 dark:border-blue-900/40 text-xs sm:text-sm text-blue-800 dark:text-blue-300 font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-blue-500" />
                  <span>
                    <strong>Projeção para Aprovação (Média 6,0):</strong> Você precisa tirar no mínimo <strong>{notaNecessariaPF.toFixed(2)}</strong> na Prova Final.
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0 w-full md:w-56 text-center">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Sua Nota na Prova Final
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  placeholder="Ex: 7.5"
                  value={scores['IMC_PROVA_FINAL']}
                  onChange={e => handleScoreChange('IMC_PROVA_FINAL', e.target.value)}
                  className="mt-2 text-center text-lg font-bold"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Peso: 50%</span>
              </div>
            </div>
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            {/* M1 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-blue-600 dark:text-blue-400">
                    M1: Role Play & História Clínica
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-bold font-mono">
                    M1 = {mediaM1.toFixed(2)}
                  </Badge>
                </div>
                <CardDescription>
                  Média geométrica de 6 notas Role Play e 2 notas HC
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                    6 Notas de Role Play:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i}>
                        <label className="text-[11px] text-slate-400">RP {i}</label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={scores[`IMC_RP_${i}`]}
                          onChange={e => handleScoreChange(`IMC_RP_${i}`, e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                    2 Notas de História Clínica (HC):
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400">HC 1</label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={scores['IMC_HC_1']}
                        onChange={e => handleScoreChange('IMC_HC_1', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">HC 2</label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={scores['IMC_HC_2']}
                        onChange={e => handleScoreChange('IMC_HC_2', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* M2 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-indigo-600 dark:text-indigo-400">
                    M2: TBLs & Casos Clínicos
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-bold font-mono">
                    M2 = {mediaM2.toFixed(2)}
                  </Badge>
                </div>
                <CardDescription>
                  Média geométrica de 6 TBLs (70% indiv + 30% grupo) e 6 Casos Clínicos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                    6 Avaliações TBL (Individual 70% + Grupo 30%):
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[1, 2, 3, 4, 5, 6].map(i => {
                      const ind = getVal(`IMC_TBL_${i}_IND`)
                      const grp = getVal(`IMC_TBL_${i}_GRP`)
                      const finalTbl = (ind * 0.7) + (grp * 0.3)
                      return (
                        <div key={i} className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                          <div className="flex justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            <span>TBL {i}</span>
                            <span className="text-blue-600 font-mono">{finalTbl.toFixed(1)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="Indiv"
                              value={scores[`IMC_TBL_${i}_IND`]}
                              onChange={e => handleScoreChange(`IMC_TBL_${i}_IND`, e.target.value)}
                              className="h-7 text-[11px]"
                            />
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="Grupo"
                              value={scores[`IMC_TBL_${i}_GRP`]}
                              onChange={e => handleScoreChange(`IMC_TBL_${i}_GRP`, e.target.value)}
                              className="h-7 text-[11px]"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                    6 Notas dos Casos Clínicos:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i}>
                        <label className="text-[11px] text-slate-400">CC {i}</label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={scores[`IMC_CC_${i}`]}
                          onChange={e => handleScoreChange(`IMC_CC_${i}`, e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* INTEGRADOR II */}
      {activeModule === 'INTEGRADOR_II' && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-blue-600 dark:text-blue-400">
                Módulo Integrador II
              </CardTitle>
              <Badge variant="blue" className="text-xs font-bold font-mono">
                Média: {mediaIntegrador.toFixed(2)}
              </Badge>
            </div>
            <CardDescription>
              Média aritmética das notas dos Fóruns Integradores e do Caso Clínico Integrador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Fórum Integrador 1
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={scores['INTEG_FORUM_1']}
                  onChange={e => handleScoreChange('INTEG_FORUM_1', e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Fórum Integrador 2
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={scores['INTEG_FORUM_2']}
                  onChange={e => handleScoreChange('INTEG_FORUM_2', e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Caso Clínico Integrador
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={scores['INTEG_CASO_CLINICO']}
                  onChange={e => handleScoreChange('INTEG_CASO_CLINICO', e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-blue-800 dark:text-blue-300">
              <p className="font-semibold mb-1">Impacto no Módulo CHS II:</p>
              <p>
                A nota obtida no Módulo Integrador entra como multiplicador da Média Geométrica das 4 disciplinas básicas (Anatomia, Bioquímica, Fisiologia e Histologia), compondo a Nota Final de CHS II.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
