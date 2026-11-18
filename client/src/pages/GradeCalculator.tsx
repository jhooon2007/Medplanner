import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { GradeItem } from '@/types'
import { Calculator, Award, AlertCircle, CheckCircle2, Save, Sparkles, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { recoverLegacyScores, recoverLegacyDisciplines } from '@/lib/legacyGrades'

export const GradeCalculator: React.FC = () => {
  const { token, user } = useAuth()
  const [activeModule, setActiveModule] = useState<'CHS_II' | 'IMC_II' | 'INTEGRADOR_II' | 'SFC_II' | 'CUSTOM_SEMESTER'>('CHS_II')
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Custom disciplines for future/other semesters
  const [customDisciplines, setCustomDisciplines] = useState<Array<{
    id: string
    name: string
    n1: number | ''
    n2: number | ''
    n3: number | ''
  }>>(() => {
    try {
      const saved = localStorage.getItem('medplanner_custom_calc_v2')
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return recoverLegacyDisciplines()
  })

  useEffect(() => {
    try {
      localStorage.setItem('medplanner_custom_calc_v2', JSON.stringify(customDisciplines))
    } catch (e) {}
  }, [customDisciplines])

  // Grade state map with LocalStorage persistence
  // Chaves de todas as notas editáveis. Começam vazias: o aluno preenche só o que já tirou.
  const SCORE_KEYS = [
    'ANA_N1_PROVA', 'ANA_N1_PARTICIPACAO', 'ANA_N2_TEORICA', 'ANA_N2_PRATICA', 'ANA_N2_PARTICIPACAO', 'ANA_N2_SEMINARIO',
    'BIOQ_N1', 'BIOQ_N2', 'BIOQ_N3', 'BIOQ_N4',
    'FISIO_A1', 'FISIO_A2', 'FISIO_A3',
    'HISTO_P1', 'HISTO_P2', 'HISTO_P3', 'HISTO_P4', 'HISTO_EXTRA',
    'INTEG_FORUM_1', 'INTEG_FORUM_2', 'INTEG_CASO_CLINICO',
    'INTEG_FORUM_1_IND', 'INTEG_FORUM_1_GRP', 'INTEG_FORUM_2_IND', 'INTEG_FORUM_2_GRP',
    ...[1, 2, 3, 4, 5, 6].map(i => `IMC_RP_${i}`),
    'IMC_HC_1', 'IMC_HC_2',
    ...[1, 2, 3, 4, 5, 6].flatMap(i => [`IMC_TBL_${i}_IND`, `IMC_TBL_${i}_GRP`]),
    ...[1, 2, 3, 4, 5, 6].map(i => `IMC_CC_${i}`),
    'IMC_PROVA_FINAL',
    'SFC_N1_RAS', 'SFC_N1_TEORICA', 'SFC_N1_PROJETO', 'SFC_N2_RELATORIO', 'SFC_N2_PRATICA_UBS', 'SFC_N2_DIARIO_1', 'SFC_N2_DIARIO_2', 'SFC_N2_DIARIO_3', 'SFC_N2_DIARIO_4', 'SFC_N2_DIARIO_5', 'SFC_N2_APRESENTACAO',
  ]
  const emptyScores = (): Record<string, number | ''> =>
    Object.fromEntries(SCORE_KEYS.map(k => [k, ''])) as Record<string, number | ''>

  // Notas digitadas nas versões antigas (que o navegador ainda guarda) são recuperadas uma única vez
  const [legacyScores] = useState<Record<string, number>>(() => {
    try {
      return localStorage.getItem('medplanner_grades_v2') ? {} : recoverLegacyScores()
    } catch (e) {
      return {}
    }
  })
  const [pendingLegacySync, setPendingLegacySync] = useState(() => Object.keys(legacyScores).length > 0)
  const [serverLoaded, setServerLoaded] = useState(false)

  const [scores, setScores] = useState<Record<string, number | ''>>(() => {
    try {
      const saved = localStorage.getItem('medplanner_grades_v2')
      if (saved) {
        return { ...emptyScores(), ...JSON.parse(saved) }
      }
    } catch (e) {}
    return { ...emptyScores(), ...legacyScores }
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
      } finally {
        setServerLoaded(true)
      }
    }

    loadGrades()
  }, [token])

  // Depois de carregar o servidor, envia as notas recuperadas do navegador para o banco (uma vez)
  useEffect(() => {
    if (serverLoaded && pendingLegacySync) {
      setPendingLegacySync(false)
      handleSaveGrades()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverLoaded, pendingLegacySync])

  // Auto-sync scores with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('medplanner_grades_v2', JSON.stringify(scores))
    } catch (e) {}
  }, [scores])

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

  // Só mostramos médias quando o aluno já lançou alguma nota daquele grupo
  const hasAny = (prefixes: string[]) =>
    SCORE_KEYS.some(k => prefixes.some(p => k.startsWith(p)) && scores[k] !== '' && scores[k] !== undefined)
  const show = (value: number, prefixes: string[], digits = 2) => hasAny(prefixes) ? value.toFixed(digits) : '—'
  const CHS_PREFIXES = ['ANA_', 'BIOQ_', 'FISIO_', 'HISTO_', 'INTEG_']
  const M1_PREFIXES = ['IMC_RP_', 'IMC_HC_']
  const M2_PREFIXES = ['IMC_TBL_', 'IMC_CC_']
  const SFC_PREFIXES = ['SFC_']
  // Itens que não existem mais: continuam guardados, mas ficam fora do cálculo
  const RETIRED_KEYS = [
    'IMC_RP_5', 'IMC_RP_6',
    ...[5, 6].flatMap(i => [`IMC_TBL_${i}_IND`, `IMC_TBL_${i}_GRP`]),
    'IMC_CC_5', 'IMC_CC_6',
  ]
  const retiredLabel = (k: string) => {
    const m = k.match(/^IMC_(RP|CC|TBL)_(\d)(?:_(IND|GRP))?$/)
    if (!m) return k
    return m[1] === 'TBL' ? `TBL ${m[2]} ${m[3] === 'IND' ? 'indiv.' : 'grupo'}` : `${m[1] === 'CC' ? 'CRC' : 'RP'} ${m[2]}`
  }
  const THEMES = ['Dispneia', 'Tosse, Exp. & Cian.', 'Icterícia', 'Dispepsia', 'Diarreia', 'Alt. Urinárias']
  const hasVal = (k: string) => scores[k] !== '' && scores[k] !== undefined

  // CHS II
  const anaN1 = getVal('ANA_N1_PROVA') + getVal('ANA_N1_PARTICIPACAO')
  
  // N2 Anatomia: Teórica (0-10) e Prática (prova 8 + participação 1 + seminário 1 = 10), média simples entre as duas
  const anaN2Pratica = getVal('ANA_N2_PRATICA') + getVal('ANA_N2_PARTICIPACAO') + getVal('ANA_N2_SEMINARIO')
  const anaN2 = (getVal('ANA_N2_TEORICA') + anaN2Pratica) / 2
  const mediaAnatomia = (anaN1 + anaN2) / 2
  // Bioquímica (planilha oficial): N1 vale 1/3; os outros 2/3 são a média de N2, N3 e Teatro Metabólico (BIOQ_N4)
  const bioqRapha = (getVal('BIOQ_N2') + getVal('BIOQ_N3') + getVal('BIOQ_N4')) / 3
  const mediaBioquimica = getVal('BIOQ_N1') / 3 + bioqRapha * 2 / 3
  const mediaFisiologia = (getVal('FISIO_A1') * 3.5 + getVal('FISIO_A2') * 4.0 + getVal('FISIO_A3') * 2.5) / 10
  const histoSomaProvas = (getVal('HISTO_P1') + getVal('HISTO_P2') + getVal('HISTO_P3') + getVal('HISTO_P4')) / 4
  const mediaHistologia = histoSomaProvas + getVal('HISTO_EXTRA')

  // Fórum = 70% individual + 30% grupo. Quem já tinha lançado a média direta do fórum (campo antigo)
  // mantém o valor: ele só é usado enquanto individual/grupo estiverem vazios.
  const forumMedia = (n: 1 | 2) => {
    const hasNew = scores[`INTEG_FORUM_${n}_IND`] !== '' || scores[`INTEG_FORUM_${n}_GRP`] !== ''
    return hasNew
      ? getVal(`INTEG_FORUM_${n}_IND`) * 0.7 + getVal(`INTEG_FORUM_${n}_GRP`) * 0.3
      : getVal(`INTEG_FORUM_${n}`)
  }
  const mediaIntegrador = (getVal('INTEG_CASO_CLINICO') + forumMedia(1) + forumMedia(2)) / 3

  // Nota final CHS II: Média geométrica das 5 disciplinas (Anatomia, Bioquímica, Fisiologia, Histologia e Módulo Integrador)
  const prodCHS = mediaAnatomia *
                  mediaBioquimica *
                  mediaFisiologia *
                  mediaHistologia *
                  mediaIntegrador
  const notaFinalCHS = Math.pow(prodCHS, 1 / 5)

  // SFC II: notas na escala da planilha (0 a 20/40); no banco ficam guardadas em 0 a 10 (nota × 10 ÷ máximo)
  const SFC_MAX: Record<string, number> = {SFC_N1_RAS: 20, SFC_N1_TEORICA: 40, SFC_N1_PROJETO: 40, SFC_N2_RELATORIO: 20, SFC_N2_PRATICA_UBS: 20, SFC_N2_DIARIO_1: 20, SFC_N2_DIARIO_2: 20, SFC_N2_DIARIO_3: 20, SFC_N2_DIARIO_4: 20, SFC_N2_DIARIO_5: 20, SFC_N2_APRESENTACAO: 40}
  const sfcNative = (k: string) => getVal(k) * SFC_MAX[k] / 10
  const sfcN1 = (sfcNative('SFC_N1_RAS') + sfcNative('SFC_N1_TEORICA') + sfcNative('SFC_N1_PROJETO')) / 10
  const sfcDiarios = [1, 2, 3, 4, 5].reduce((a, i) => a + sfcNative(`SFC_N2_DIARIO_${i}`), 0) / 5
  const sfcN2 = (sfcNative('SFC_N2_RELATORIO') + sfcNative('SFC_N2_PRATICA_UBS') + sfcDiarios + sfcNative('SFC_N2_APRESENTACAO')) / 10
  const mediaSFC = (sfcN1 + sfcN2) / 2
  const sfcInput = (k: string) => (
    <Input type="number" step="0.1" min="0" max={SFC_MAX[k]} placeholder="Nota"
      value={scores[k] === '' || scores[k] === undefined ? '' : Math.round(Number(scores[k]) * SFC_MAX[k] * 10) / 100}
      onChange={e => handleScoreChange(k, e.target.value === '' ? '' : String(Number(e.target.value) * 10 / SFC_MAX[k]))}
      className="h-8 text-xs" />
  )
  // Notas que a planilha lança de 0 a 100 (Roleplays, HC, Caso Integrador): guardadas em 0 a 10, exibidas em 0 a 100
  const s100 = (k: string) => ({
    max: 100,
    value: scores[k] === '' || scores[k] === undefined ? '' : Math.round(Number(scores[k]) * 1000) / 100,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      handleScoreChange(k, e.target.value === '' ? '' : String(Number(e.target.value) / 10)),
  })

  // IMC II
  // Neste semestre: 4 Roleplays + 2 idas ao HC (6 notas), 4 TBLs e 4 CRCs. As notas dos itens retirados ficam guardadas, fora da conta.
  const rpList = [1, 2, 3, 4].map(i => getVal(`IMC_RP_${i}`))
  const hcList = [1, 2].map(i => getVal(`IMC_HC_${i}`))
  const prodM1 = [...rpList, ...hcList].reduce((acc, v) => acc * v, 1)
  const mediaM1 = Math.pow(prodM1, 1 / 6)

  const tblScores = [1, 2, 3, 4].map(i => {
    const ind = getVal(`IMC_TBL_${i}_IND`)
    const grp = getVal(`IMC_TBL_${i}_GRP`)
    return (ind * 0.7) + (grp * 0.3)
  })
  const ccScores = [1, 2, 3, 4].map(i => getVal(`IMC_CC_${i}`))
  const prodM2 = [...tblScores, ...ccScores].reduce((acc, v) => acc * v, 1)
  const mediaM2 = Math.pow(prodM2, 1 / 8)

  const provaFinalIMC = scores['IMC_PROVA_FINAL'] !== '' ? Number(scores['IMC_PROVA_FINAL']) : null
  const mediaFinalIMC = provaFinalIMC !== null
    ? (mediaM1 * 0.25) + (mediaM2 * 0.25) + (provaFinalIMC * 0.50)
    : (mediaM1 * 0.25) + (mediaM2 * 0.25)

  const notaNecessariaPF = Math.max(0, (6.0 - (mediaM1 * 0.25 + mediaM2 * 0.25)) / 0.50)

  const forumInputs = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {([1, 2] as const).map(n => (
        <div key={n} className="p-2 bg-white/60 dark:bg-slate-900/40 rounded-xl space-y-1.5">
          <div className="flex justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            <span>Fórum {n}</span>
            <span className="text-blue-600 font-mono">{show(forumMedia(n), [`INTEG_FORUM_${n}`], 1)}</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(['IND', 'GRP'] as const).map(t => (
              <div key={t}>
                <label className="text-[10px] text-slate-400">{t === 'IND' ? 'Individual (70%)' : 'Grupo (30%)'}</label>
                <Input type="number" step="0.1" min="0" max="10" placeholder="Nota"
                  value={scores[`INTEG_FORUM_${n}_${t}`]}
                  onChange={e => handleScoreChange(`INTEG_FORUM_${n}_${t}`, e.target.value)}
                  className="h-8 text-xs" />
              </div>
            ))}
          </div>
          {hasVal(`INTEG_FORUM_${n}`) && (
            <div>
              <label className="text-[10px] text-amber-600">Média do Fórum {n} lançada antes (vale só se individual/grupo estiverem vazios)</label>
              <Input type="number" step="0.1" min="0" max="10"
                value={scores[`INTEG_FORUM_${n}`]}
                onChange={e => handleScoreChange(`INTEG_FORUM_${n}`, e.target.value)}
                className="h-8 text-xs" />
            </div>
          )}
        </div>
      ))}
    </div>
  )

  const handleSaveGrades = async () => {
    if (!token) return
    const outOfRange = Object.values(scores).some(v => v !== '' && v !== undefined && (Number(v) < 0 || Number(v) > 10))
    if (outOfRange) {
      setSaveError('Há uma nota fora do intervalo de 0 a 10. Corrija antes de salvar.')
      return
    }
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
        else if (key.startsWith('SFC_')) { moduleName = 'SFC_II'; disc = 'Saúde, Família e Comunidade' }

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
        setSaveError(null)
        setSavedSuccess(true)
        setTimeout(() => setSavedSuccess(false), 3000)
      } else {
        const data = await res.json().catch(() => ({}))
        setSaveError(data.error || 'Não foi possível salvar as notas.')
      }
    } catch (err) {
      setSaveError('Sem conexão com o servidor. As notas ficaram salvas só neste aparelho.')
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

      {saveError && (
        <div role="alert" className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {saveError}
        </div>
      )}

      {/* Module Selector Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-x-auto">
        {[
          { id: 'CHS_II', label: 'Corpo Humano Saudável II (CHS II)' },
          { id: 'IMC_II', label: 'Introdução ao Método Clínico II (IMC II)' },
          { id: 'INTEGRADOR_II', label: 'Módulo Integrador II' },
          { id: 'SFC_II', label: 'Saúde, Família e Comunidade II (SFC II)' },
          { id: 'CUSTOM_SEMESTER', label: 'Outros Semestres' },
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
                  Nota Final Calculada: {show(notaFinalCHS, CHS_PREFIXES)}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
                  <strong>Fórmula UFG:</strong> Raiz 5ª do produto das 5 médias (Anatomia × Bioquímica × Fisiologia × Histologia × Módulo Integrador): Anatomia ({show(mediaAnatomia, ['ANA_'])}), Bioquímica ({show(mediaBioquimica, ['BIOQ_'])}), Fisiologia ({show(mediaFisiologia, ['FISIO_'])}), Histologia ({show(mediaHistologia, ['HISTO_'])}) e Módulo Integrador ({show(mediaIntegrador, ['INTEG_'])}).
                </p>
              </div>

              <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0">
                <div className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center font-bold text-xl",
                  notaFinalCHS >= 6.0
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                  !hasAny(CHS_PREFIXES) && "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                )}>
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">Situação Acadêmica</div>
                  <div className={cn(
                    "text-base font-bold",
                    !hasAny(CHS_PREFIXES) ? "text-slate-500 dark:text-slate-400"
                      : notaFinalCHS >= 6.0 ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"
                  )}>
                    {!hasAny(CHS_PREFIXES) ? 'Aguardando suas notas' : notaFinalCHS >= 6.0 ? 'Aprovado' : 'Atenção / Recuperação'}
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
                    Média: {show(mediaAnatomia, ['ANA_'])}
                  </Badge>
                </div>
                <CardDescription>
                  Média = (N1 + N2) / 2 • N1 = Prova Teórico-Prática (0 a 9) + Participação (0 a 1) • N2 = (Teórica (0 a 10) + Prática (0 a 8) + Participação (0 a 1) + Seminário (0 a 1)) / 2
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N1 Prova (Teór-Prát, máx 9)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="9"
                      placeholder="Insira sua nota"
                      value={scores['ANA_N1_PROVA']}
                      onChange={e => handleScoreChange('ANA_N1_PROVA', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N1 Participação (máx 1)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      placeholder="Insira sua nota"
                      value={scores['ANA_N1_PARTICIPACAO']}
                      onChange={e => handleScoreChange('ANA_N1_PARTICIPACAO', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div className="col-span-2 text-[11px] text-slate-400 text-right">
                    Subtotal N1: <span className="font-semibold text-slate-700 dark:text-slate-300">{show(anaN1, ['ANA_N1_'], 1)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N2 Teórica</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      placeholder="Nota"
                      value={scores['ANA_N2_TEORICA']}
                      onChange={e => handleScoreChange('ANA_N2_TEORICA', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N2 Prática (prova, máx 8)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="8"
                      placeholder="Nota"
                      value={scores['ANA_N2_PRATICA']}
                      onChange={e => handleScoreChange('ANA_N2_PRATICA', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N2 Part. (máx 1)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      placeholder="Nota"
                      value={scores['ANA_N2_PARTICIPACAO']}
                      onChange={e => handleScoreChange('ANA_N2_PARTICIPACAO', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Seminário (máx 1)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      placeholder="Nota"
                      value={scores['ANA_N2_SEMINARIO']}
                      onChange={e => handleScoreChange('ANA_N2_SEMINARIO', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-4 text-[11px] text-slate-400 text-right">
                    Subtotal N2: <span className="font-semibold text-slate-700 dark:text-slate-300">{show(anaN2, ['ANA_N2_'], 1)}</span>
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
                    Média: {show(mediaBioquimica, ['BIOQ_'])}
                  </Badge>
                </div>
                <CardDescription>
                  Média = N1 × 1/3 + [(N2 + N3 + Teatro Metabólico) / 3] × 2/3
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N1</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      placeholder="Insira sua nota"
                      value={scores['BIOQ_N1']}
                      onChange={e => handleScoreChange('BIOQ_N1', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N2</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      placeholder="Insira sua nota"
                      value={scores['BIOQ_N2']}
                      onChange={e => handleScoreChange('BIOQ_N2', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N3</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      placeholder="Insira sua nota"
                      value={scores['BIOQ_N3']}
                      onChange={e => handleScoreChange('BIOQ_N3', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Teatro Metabólico</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      placeholder="Insira sua nota"
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
                    Média: {show(mediaFisiologia, ['FISIO_'])}
                  </Badge>
                </div>
                <CardDescription>
                  Média = (N1 × 3,5 + N2 × 4,0 + N3 × 2,5) / 10
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N1</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      placeholder="Insira sua nota"
                      value={scores['FISIO_A1']}
                      onChange={e => handleScoreChange('FISIO_A1', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Peso 3,5</span>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N2</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      placeholder="Insira sua nota"
                      value={scores['FISIO_A2']}
                      onChange={e => handleScoreChange('FISIO_A2', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Peso 4,0</span>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">N3</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      placeholder="Insira sua nota"
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
                    Média: {show(mediaHistologia, ['HISTO_'])}
                  </Badge>
                </div>
                <CardDescription>
                  Média = (Teórica N1 + Prática N1 + Teórica N2 + Prática N2) / 4 + Roteiro (0 a 0,5)
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
                      placeholder="Insira sua nota"
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
                      placeholder="Insira sua nota"
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
                      placeholder="Insira sua nota"
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
                      placeholder="Insira sua nota"
                      value={scores['HISTO_P4']}
                      onChange={e => handleScoreChange('HISTO_P4', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Roteiro (0 a 0,5)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="0.5"
                      placeholder="Insira sua nota"
                      value={scores['HISTO_EXTRA']}
                      onChange={e => handleScoreChange('HISTO_EXTRA', e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Módulo Integrador (5ª disciplina da Média Geométrica) */}
            <Card className="md:col-span-2 border-indigo-200/60 dark:border-indigo-900/40">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-indigo-600 dark:text-indigo-400">
                    Módulo Integrador II (5ª componente da Média Geométrica)
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-bold font-mono">
                    Média: {show(mediaIntegrador, ['INTEG_'])}
                  </Badge>
                </div>
                <CardDescription>
                  Média = (Caso Integrador ÷ 10 + Fórum 1 + Fórum 2) / 3 • Fórum = 70% individual + 30% grupo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <div className="sm:col-span-3">{forumInputs()}</div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Caso Clínico Integrador</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0 a 100" {...s100('INTEG_CASO_CLINICO')}
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
                  M1: {show(mediaM1, M1_PREFIXES)} • M2: {show(mediaM2, M2_PREFIXES)} • MF: {provaFinalIMC !== null ? mediaFinalIMC.toFixed(2) : 'Aguardando Prova Final'}
                </h2>
                <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-blue-200/60 dark:border-blue-900/40 text-xs sm:text-sm text-blue-800 dark:text-blue-300 font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-blue-500" />
                  {hasAny([...M1_PREFIXES, ...M2_PREFIXES]) ? (
                    <span>
                      <strong>Projeção para Aprovação (Média 6,0):</strong> Você precisa tirar no mínimo <strong>{notaNecessariaPF.toFixed(2)}</strong> na Prova Final.
                    </span>
                  ) : (
                    <span>Insira suas notas de M1 e M2 para ver a nota necessária na Prova Final.</span>
                  )}
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
                  placeholder="Insira sua nota"
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
                    M1 = {show(mediaM1, M1_PREFIXES)}
                  </Badge>
                </div>
                <CardDescription>
                  M1 = raiz 6ª do produto de 4 Roleplays e 2 idas ao HC (cada nota ÷ 10, pois são lançadas de 0 a 100)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                    4 Notas de Roleplay:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i}>
                        <label className="text-[11px] text-slate-400">RP {i} · {THEMES[i - 1]}</label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="0 a 100" {...s100(`IMC_RP_${i}`)}
                          className="h-8 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                    2 idas ao HC (Paciente Real):
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400">1ª ida ao HC</label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="0 a 100" {...s100('IMC_HC_1')}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">2ª ida ao HC</label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="0 a 100" {...s100('IMC_HC_2')}
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
                    M2 = {show(mediaM2, M2_PREFIXES)}
                  </Badge>
                </div>
                <CardDescription>
                  M2 = raiz 8ª do produto de 4 Médias de TBL (70% indiv + 30% grupo) e 4 CRCs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                    4 Avaliações TBL (Individual 70% + Grupo 30%):
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[1, 2, 3, 4].map(i => {
                      const ind = getVal(`IMC_TBL_${i}_IND`)
                      const grp = getVal(`IMC_TBL_${i}_GRP`)
                      const finalTbl = (ind * 0.7) + (grp * 0.3)
                      return (
                        <div key={i} className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                          <div className="flex justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            <span>TBL {i} · {THEMES[i - 1]}</span>
                            <span className="text-blue-600 font-mono">{show(finalTbl, [`IMC_TBL_${i}_`], 1)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="Nota"
                              value={scores[`IMC_TBL_${i}_IND`]}
                              onChange={e => handleScoreChange(`IMC_TBL_${i}_IND`, e.target.value)}
                              className="h-7 text-[11px]"
                            />
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="Nota"
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
                    4 Notas de CRC:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i}>
                        <label className="text-[11px] text-slate-400">CRC {i} · {THEMES[i - 1]}</label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          placeholder="Insira sua nota"
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

            {(RETIRED_KEYS.some(hasVal)) && (
              <Card className="md:col-span-2 border-amber-200 dark:border-amber-900/50">
                <CardHeader>
                  <CardTitle className="text-sm text-amber-700 dark:text-amber-400">Notas antigas guardadas (fora do cálculo)</CardTitle>
                  <CardDescription>
                    Neste semestre valem 4 Roleplays, 4 TBLs e 4 CRCs. Estas notas que você lançou antes continuam salvas, mas não entram na média.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {RETIRED_KEYS.filter(hasVal).map(k => (
                      <div key={k}>
                        <label className="text-[11px] text-slate-400">{retiredLabel(k)}</label>
                        <Input type="number" step="0.1" min="0" max="10" value={scores[k]}
                          onChange={e => handleScoreChange(k, e.target.value)} className="h-8 text-xs" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
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
                Média: {show(mediaIntegrador, ['INTEG_'])}
              </Badge>
            </div>
            <CardDescription>
              Média = (Caso Integrador (0 a 100, ÷ 10) + Fórum 1 + Fórum 2) / 3, sendo cada Fórum = 70% individual + 30% grupo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <div className="sm:col-span-3">{forumInputs()}</div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Caso Clínico Integrador
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0 a 100" {...s100('INTEG_CASO_CLINICO')}
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-blue-800 dark:text-blue-300">
              <p className="font-semibold mb-1">Impacto no Módulo CHS II:</p>
              <p>
                A média do Módulo Integrador é o 5º fator do produto de CHS II: Nota Final = raiz 5ª de (Anatomia × Bioquímica × Fisiologia × Histologia × Integrador).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SFC II */}
      {activeModule === 'SFC_II' && (
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-blue-600 dark:text-blue-400">Saúde, Família e Comunidade II</CardTitle>
              <Badge variant="blue" className="text-xs font-bold font-mono">Média: {show(mediaSFC, SFC_PREFIXES)}</Badge>
            </div>
            <CardDescription>
              Média = (N1 + N2) / 2 • N1 = (RAS + Teórica + Projeto) / 10 • N2 = (Relatório + Prática UBS + média dos 5 Diários de Campo + Apresentação Final) / 10
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"><span>N1</span><span className="font-mono">{show(sfcN1, ['SFC_N1_'])}</span></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] text-slate-500">Atividade RAS (0 a 20)</label>
                {sfcInput('SFC_N1_RAS')}
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Avaliação Teórica (0 a 40)</label>
                {sfcInput('SFC_N1_TEORICA')}
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Projeto de Intervenção na Comunidade (0 a 40)</label>
                {sfcInput('SFC_N1_PROJETO')}
              </div>
              </div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"><span>N2</span><span className="font-mono">{show(sfcN2, ['SFC_N2_'])}</span></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-slate-500">Relatório Individual (visita) (0 a 20)</label>
                {sfcInput('SFC_N2_RELATORIO')}
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Aval. da Prática na UBS (0 a 20)</label>
                {sfcInput('SFC_N2_PRATICA_UBS')}
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Apresentação Final UBS (0 a 40)</label>
                {sfcInput('SFC_N2_APRESENTACAO')}
              </div>
              </div>
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 pt-1">Diários de Campo (média: {show(sfcDiarios, ['SFC_N2_DIARIO_'])})</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-500">Diário 1 (0 a 20)</label>
                  {sfcInput('SFC_N2_DIARIO_1')}
                </div>
                <div>
                  <label className="text-[11px] text-slate-500">Diário 2 (0 a 20)</label>
                  {sfcInput('SFC_N2_DIARIO_2')}
                </div>
                <div>
                  <label className="text-[11px] text-slate-500">Diário 3 (0 a 20)</label>
                  {sfcInput('SFC_N2_DIARIO_3')}
                </div>
                <div>
                  <label className="text-[11px] text-slate-500">Diário 4 (0 a 20)</label>
                  {sfcInput('SFC_N2_DIARIO_4')}
                </div>
                <div>
                  <label className="text-[11px] text-slate-500">Diário 5 (0 a 20)</label>
                  {sfcInput('SFC_N2_DIARIO_5')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outros Semestres: Calculadora Universal */}
      {activeModule === 'CUSTOM_SEMESTER' && (
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border-indigo-500/30 overflow-hidden">
            <div className="p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <Badge variant="blue" className="mb-2">Calculadora Flexível</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Cálculo de Notas de Outros Semestres
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl mt-1 leading-relaxed">
                  Adicione as disciplinas dos seus próximos períodos (3º, 4º, etc.), lance suas notas (N1, N2, N3) e acompanhe sua aprovação em tempo real.
                </p>
              </div>

              <Button
                onClick={() => {
                  const newSub = {
                    id: String(Date.now()),
                    name: 'Nova Disciplina',
                    n1: '' as const,
                    n2: '' as const,
                    n3: '' as const,
                  }
                  setCustomDisciplines(prev => [...prev, newSub])
                }}
                className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 h-9"
              >
                + Adicionar Disciplina
              </Button>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {customDisciplines.map((d, index) => {
              const val1 = d.n1 === '' ? 0 : Number(d.n1)
              const val2 = d.n2 === '' ? 0 : Number(d.n2)
              const hasN3 = d.n3 !== '' && d.n3 !== undefined
              const val3 = hasN3 ? Number(d.n3) : 0
              const media = hasN3 ? (val1 + val2 + val3) / 3 : (val1 + val2) / 2
              const hasAnyGrade = d.n1 !== '' || d.n2 !== '' || hasN3
              const isApproved = hasAnyGrade && media >= 6.0

              return (
                <Card key={d.id} className="p-5 space-y-4 border-slate-200/90 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <Input
                      value={d.name}
                      onChange={e => {
                        const val = e.target.value
                        setCustomDisciplines(prev => prev.map((item, i) => i === index ? { ...item, name: val } : item))
                      }}
                      className="font-bold text-sm h-8"
                      placeholder="Nome da Disciplina"
                    />
                    <Badge variant={isApproved ? 'blue' : 'warning'} className="font-mono text-xs shrink-0">
                      Média: {hasAnyGrade ? media.toFixed(2) : '—'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    <div>
                      <label className="text-xs font-medium text-slate-500">N1</label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        placeholder="Insira sua nota"
                        value={d.n1}
                        onChange={e => {
                          const val = e.target.value === '' ? '' : parseFloat(e.target.value)
                          setCustomDisciplines(prev => prev.map((item, i) => i === index ? { ...item, n1: val } : item))
                        }}
                        className="mt-1 h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500">N2</label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        placeholder="Insira sua nota"
                        value={d.n2}
                        onChange={e => {
                          const val = e.target.value === '' ? '' : parseFloat(e.target.value)
                          setCustomDisciplines(prev => prev.map((item, i) => i === index ? { ...item, n2: val } : item))
                        }}
                        className="mt-1 h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500">N3 (Opt)</label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        placeholder="Opcional"
                        value={d.n3}
                        onChange={e => {
                          const val = e.target.value === '' ? '' : parseFloat(e.target.value)
                          setCustomDisciplines(prev => prev.map((item, i) => i === index ? { ...item, n3: val } : item))
                        }}
                        className="mt-1 h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className={cn("font-semibold", isApproved ? "text-emerald-600" : "text-amber-600")}>
                      {!hasAnyGrade ? 'Insira suas notas' : isApproved ? 'Aprovado (>= 6,0)' : 'Abaixo da média'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomDisciplines(prev => prev.filter((_, i) => i !== index))}
                      className="text-xs text-rose-500 hover:text-rose-700 cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
