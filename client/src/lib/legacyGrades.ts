// Versões antigas da calculadora vinham com notas de exemplo e guardavam tudo no navegador do aluno.
// Aqui recuperamos o que ele realmente digitou: tudo que for diferente do exemplo antigo.

const LEGACY_DEFAULTS: Record<string, number> = {
  ANA_N1_PROVA: 8.0, ANA_N1_PARTICIPACAO: 1.0, ANA_N2_TEORICA: 8.0, ANA_N2_PRATICA: 6.5,
  ANA_N2_PARTICIPACAO: 1.0, ANA_N2_SEMINARIO: 1.0,
  BIOQ_N1: 7.5, BIOQ_N2: 8.0, BIOQ_N3: 7.0, BIOQ_N4: 8.5,
  FISIO_A1: 7.5, FISIO_A2: 8.0, FISIO_A3: 7.0,
  HISTO_P1: 8.0, HISTO_P2: 7.5, HISTO_P3: 8.5, HISTO_P4: 8.0, HISTO_EXTRA: 0.5,
  INTEG_FORUM_1: 9.0, INTEG_FORUM_2: 8.5, INTEG_CASO_CLINICO: 8.0,
  IMC_RP_1: 8.5, IMC_RP_2: 9.0, IMC_RP_3: 8.0, IMC_RP_4: 8.5, IMC_RP_5: 9.0, IMC_RP_6: 8.5,
  IMC_HC_1: 8.0, IMC_HC_2: 8.5,
  IMC_TBL_1_IND: 8.0, IMC_TBL_1_GRP: 9.0, IMC_TBL_2_IND: 7.5, IMC_TBL_2_GRP: 8.5,
  IMC_TBL_3_IND: 8.0, IMC_TBL_3_GRP: 9.0, IMC_TBL_4_IND: 8.5, IMC_TBL_4_GRP: 9.5,
  IMC_TBL_5_IND: 7.0, IMC_TBL_5_GRP: 8.5, IMC_TBL_6_IND: 8.0, IMC_TBL_6_GRP: 9.0,
  IMC_CC_1: 8.5, IMC_CC_2: 8.0, IMC_CC_3: 9.0, IMC_CC_4: 8.5, IMC_CC_5: 8.0, IMC_CC_6: 8.5,
}

const LEGACY_SAMPLE_DISCIPLINES: Record<string, { name: string; n1: number; n2: number }> = {
  '1': { name: 'Farmacologia Médica', n1: 7.5, n2: 8.0 },
  '2': { name: 'Patologia Geral', n1: 7.0, n2: 7.5 },
}

export function recoverLegacyScores(): Record<string, number> {
  const recovered: Record<string, number> = {}
  try {
    const raw = localStorage.getItem('medplanner_grades')
    if (!raw) return recovered
    const parsed = JSON.parse(raw)
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'number' || Number.isNaN(value)) continue
      const isUntouchedExample = key in LEGACY_DEFAULTS && LEGACY_DEFAULTS[key] === value
      if (!isUntouchedExample) recovered[key] = value
    }
  } catch (e) {}
  return recovered
}

export function recoverLegacyDisciplines<T extends { id: string; name: string; n1: number | ''; n2: number | '' }>(): T[] {
  try {
    const raw = localStorage.getItem('medplanner_custom_calc')
    if (!raw) return []
    const parsed: T[] = JSON.parse(raw)
    return parsed.filter(d => {
      const sample = LEGACY_SAMPLE_DISCIPLINES[d.id]
      return !(sample && sample.name === d.name && sample.n1 === d.n1 && sample.n2 === d.n2)
    })
  } catch (e) {
    return []
  }
}
