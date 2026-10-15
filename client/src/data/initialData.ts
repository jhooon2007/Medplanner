import { Subject, ImportantEvent, ClassItem } from '@/types'

const RAW_SUBJECTS = [
  {
    id: 1,
    name: 'Anatomia Humana',
    code: 'MED-ANA',
    color: 'blue',
    icon: 'Activity',
    description: 'Módulo CHS II: Estudo da anatomia dos sistemas cardiovascular, respiratório, digestório, urogenital e sensorial.',
    topics: [
      {
        id: 101,
        subject_id: 1,
        name: 'Sistema Circulatório',
        subtopics: [
          { id: 1001, topic_id: 101, name: 'Coração e pericárdio', completed: false },
          { id: 1002, topic_id: 101, name: 'Vascularização coronariana e ciclo anatômico', completed: false },
          { id: 1003, topic_id: 101, name: 'Grandes artérias sistêmicas', completed: false },
          { id: 1004, topic_id: 101, name: 'Sistema venoso e veias cavas', completed: false },
          { id: 1005, topic_id: 101, name: 'Microcirculação e vasos capilares', completed: false },
        ]
      },
      {
        id: 102,
        subject_id: 1,
        name: 'Sistema Linfático',
        subtopics: [
          { id: 1006, topic_id: 102, name: 'Timo e baço', completed: false },
          { id: 1007, topic_id: 102, name: 'Linfonodos cervicais, axilares e inguinais', completed: false },
          { id: 1008, topic_id: 102, name: 'Ducto torácico e circulação linfática', completed: false },
          { id: 1009, topic_id: 102, name: 'Tecido linfoide associado a mucosas (MALT)', completed: false },
        ]
      },
      {
        id: 103,
        subject_id: 1,
        name: 'Sistema Respiratório',
        subtopics: [
          { id: 1010, topic_id: 103, name: 'Cavidade nasal e seios paranasais', completed: false },
          { id: 1011, topic_id: 103, name: 'Faringe e laringe (cartilagens e cordas vocais)', completed: false },
          { id: 1012, topic_id: 103, name: 'Traqueia e árvore brônquica', completed: false },
          { id: 1013, topic_id: 103, name: 'Pulmões, pleuras e hilos pulmonares', completed: false },
          { id: 1014, topic_id: 103, name: 'Segmentação broncopulmonar', completed: false },
        ]
      },
      {
        id: 104,
        subject_id: 1,
        name: 'Sistema Digestório',
        subtopics: [
          { id: 1015, topic_id: 104, name: 'Cavidade oral, glândulas salivares e faringe', completed: false },
          { id: 1016, topic_id: 104, name: 'Esôfago e estômago (vascularização e inervação)', completed: false },
          { id: 1017, topic_id: 104, name: 'Duodeno, jejuno e íleo', completed: false },
          { id: 1018, topic_id: 104, name: 'Ceco, apêndice, cólons e reto', completed: false },
          { id: 1019, topic_id: 104, name: 'Fígado, vias biliares e pâncreas', completed: false },
        ]
      },
      {
        id: 105,
        subject_id: 1,
        name: 'Sistema Urogenital',
        subtopics: [
          { id: 1020, topic_id: 105, name: 'Rins (córtex, medula e pedículo renal)', completed: false },
          { id: 1021, topic_id: 105, name: 'Ureteres e relações anatômicas', completed: false },
          { id: 1022, topic_id: 105, name: 'Bexiga urinária e trígono vesical', completed: false },
          { id: 1023, topic_id: 105, name: 'Uretra masculina e feminina', completed: false },
        ]
      },
      {
        id: 106,
        subject_id: 1,
        name: 'Sistema Genital (masc/fem)',
        subtopics: [
          { id: 1024, topic_id: 106, name: 'Aparelho genital masculino (testículos, próstata, pênis)', completed: false },
          { id: 1025, topic_id: 106, name: 'Aparelho genital feminino (ovários, tubas, útero e vagina)', completed: false },
          { id: 1026, topic_id: 106, name: 'Genitália externa e assoalho pélvico', completed: false },
          { id: 1027, topic_id: 106, name: 'Períneo e vascularização pudenda', completed: false },
        ]
      },
      {
        id: 107,
        subject_id: 1,
        name: 'Sistema Sensorial',
        subtopics: [
          { id: 1028, topic_id: 107, name: 'Olho, globo ocular e músculos extrínsecos', completed: false },
          { id: 1029, topic_id: 107, name: 'Vias ópticas e reflexos pupilares', completed: false },
          { id: 1030, topic_id: 107, name: 'Orelha externa, média e interna', completed: false },
          { id: 1031, topic_id: 107, name: 'Vias auditivas e vestibulares', completed: false },
          { id: 1032, topic_id: 107, name: 'Sentidos químicos (olfato e gustação)', completed: false },
        ]
      }
    ]
  },
  {
    id: 2,
    name: 'Bioquímica',
    code: 'MED-BIOQ',
    color: 'purple',
    icon: 'Dna',
    description: 'Módulo CHS II: Bioquímica metabólica, sinalização celular e regulação energética.',
    topics: [
      {
        id: 201,
        subject_id: 2,
        name: 'Controle da expressão gênica',
        subtopics: [
          { id: 2001, topic_id: 201, name: 'Estrutura da cromatina e epigenética', completed: false },
          { id: 2002, topic_id: 201, name: 'Fatores de transcrição basais e específicos', completed: false },
          { id: 2003, topic_id: 201, name: 'Processamento do RNA e splicing alternativo', completed: false },
          { id: 2004, topic_id: 201, name: 'Regulação pós-transcricional e microRNAs', completed: false },
        ]
      },
      {
        id: 202,
        subject_id: 2,
        name: 'Transdução de sinal/apoptose/oncogenes',
        subtopics: [
          { id: 2005, topic_id: 202, name: 'Receptores acoplados à proteína G e segundos mensageiros', completed: false },
          { id: 2006, topic_id: 202, name: 'Receptores tirosina-quinase e via MAPK', completed: false },
          { id: 2007, topic_id: 202, name: 'Vias de apoptose intrínseca e extrínseca (caspases)', completed: false },
          { id: 2008, topic_id: 202, name: 'Oncogenes e genes supressores de tumor (p53, Rb)', completed: false },
        ]
      },
      {
        id: 203,
        subject_id: 2,
        name: 'Sinalização (insulina, glucagon, epinefrina)',
        subtopics: [
          { id: 2009, topic_id: 203, name: 'Mecanismo de ação da insulina e captação de glicose (GLUT4)', completed: false },
          { id: 2010, topic_id: 203, name: 'Sinalização do glucagon e ativação da PKA', completed: false },
          { id: 2011, topic_id: 203, name: 'Epinefrina e resposta ao estresse agudo', completed: false },
          { id: 2012, topic_id: 203, name: 'Regulação metabólica coordenada no fígado e músculo', completed: false },
        ]
      },
      {
        id: 204,
        subject_id: 2,
        name: 'Metabolismo de Carboidratos',
        subtopics: [
          { id: 2013, topic_id: 204, name: 'Glicólise aeróbia e anaeróbia', completed: false },
          { id: 2014, topic_id: 204, name: 'Complexo da piruvato desidrogenase', completed: false },
          { id: 2015, topic_id: 204, name: 'Gliconeogênese hepática e renal', completed: false },
          { id: 2016, topic_id: 204, name: 'Metabolismo do glicogênio (síntese e degradação)', completed: false },
          { id: 2017, topic_id: 204, name: 'Via das pentoses fosfato e síntese de NADPH', completed: false },
        ]
      },
      {
        id: 205,
        subject_id: 2,
        name: 'Metabolismo de Lipídeos',
        subtopics: [
          { id: 2018, topic_id: 205, name: 'Digestão, absorção e transporte por lipoproteínas (quilomícrons, VLDL, LDL, HDL)', completed: false },
          { id: 2019, topic_id: 205, name: 'Lipólise e ativação de ácidos graxos', completed: false },
          { id: 2020, topic_id: 205, name: 'Beta-oxidação mitocondrial e rendimento energético', completed: false },
          { id: 2021, topic_id: 205, name: 'Cetogênese e utilização de corpos cetônicos', completed: false },
          { id: 2022, topic_id: 205, name: 'Síntese de ácidos graxos, triglicerídeos e colesterol', completed: false },
        ]
      },
      {
        id: 206,
        subject_id: 2,
        name: 'Fosforilação oxidativa',
        subtopics: [
          { id: 2023, topic_id: 206, name: 'Complexos I, II, III e IV da cadeia respiratória', completed: false },
          { id: 2024, topic_id: 206, name: 'Gradiente eletroquímico de prótons', completed: false },
          { id: 2025, topic_id: 206, name: 'ATP sintase e mecanismo rotacional', completed: false },
          { id: 2026, topic_id: 206, name: 'Inibidores da cadeia e agentes desacopladores', completed: false },
        ]
      }
    ]
  },
  {
    id: 3,
    name: 'Fisiologia Humana',
    code: 'MED-FISIO',
    color: 'rose',
    icon: 'HeartPulse',
    description: 'Módulo CHS II: Fisiologia dos sistemas cardiovascular, respiratório, digestório e renal.',
    topics: [
      {
        id: 301,
        subject_id: 3,
        name: 'Cardiovascular',
        subtopics: [
          { id: 3001, topic_id: 301, name: 'Potenciais de ação cardíacos (células marca-passo vs contráteis)', completed: false },
          { id: 3002, topic_id: 301, name: 'Eletrocardiograma (ECG) normal e derivações', completed: false },
          { id: 3003, topic_id: 301, name: 'Mecânica do ciclo cardíaco e curvas de pressão-volume', completed: false },
          { id: 3004, topic_id: 301, name: 'Débito cardíaco, pré-carga, pós-carga e contratilidade', completed: false },
          { id: 3005, topic_id: 301, name: 'Hemodinâmica, resistência vascular periférica e pressão arterial', completed: false },
          { id: 3006, topic_id: 301, name: 'Regulação pelo barorreflexo e sistema renina-angiotensina', completed: false },
        ]
      },
      {
        id: 302,
        subject_id: 3,
        name: 'Respiratório',
        subtopics: [
          { id: 3007, topic_id: 302, name: 'Mecânica ventilatória, músculos inspiratórios/expiratórios e complacência', completed: false },
          { id: 3008, topic_id: 302, name: 'Volumes, capacidades pulmonares e espirometria', completed: false },
          { id: 3009, topic_id: 302, name: 'Troca gasosa alvéolo-capilar e difusão de O2 e CO2', completed: false },
          { id: 3010, topic_id: 302, name: 'Transporte de gases no sangue e curva de dissociação da hemoglobina', completed: false },
          { id: 3011, topic_id: 302, name: 'Relação ventilação/perfusão (V/Q)', completed: false },
          { id: 3012, topic_id: 302, name: 'Controle neural e químico da ventilação (quimiorreceptores)', completed: false },
        ]
      },
      {
        id: 303,
        subject_id: 3,
        name: 'Digestório',
        subtopics: [
          { id: 3013, topic_id: 303, name: 'Controle neuroendócrino da motilidade gastrointestinal', completed: false },
          { id: 3014, topic_id: 303, name: 'Secreções salivares e gástricas (ácido clorídrico e pepsina)', completed: false },
          { id: 3015, topic_id: 303, name: 'Secreção pancreática exócrina e bile', completed: false },
          { id: 3016, topic_id: 303, name: 'Digestão e mecanismos de absorção intestinal', completed: false },
          { id: 3017, topic_id: 303, name: 'Fisiologia do fígado e circulação êntero-hepática', completed: false },
        ]
      },
      {
        id: 304,
        subject_id: 3,
        name: 'Renal',
        subtopics: [
          { id: 3018, topic_id: 304, name: 'Filtração glomerular, taxa de filtração (TFG) e autorregulação', completed: false },
          { id: 3019, topic_id: 304, name: 'Reabsorção e secreção no túbulo proximal', completed: false },
          { id: 3020, topic_id: 304, name: 'Alça de Henle e mecanismo de concentração por contracorrente', completed: false },
          { id: 3021, topic_id: 304, name: 'Túbulo distal, ducto coletor e ação do ADH e aldosterona', completed: false },
          { id: 3022, topic_id: 304, name: 'Regulação do volume extracelular, osmolaridade e balanço ácido-base', completed: false },
        ]
      }
    ]
  },
  {
    id: 4,
    name: 'Histologia e Embriologia',
    code: 'MED-HISTO',
    color: 'amber',
    icon: 'Microscope',
    description: 'Módulo CHS II: Análise microscópica de tecidos, órgãos e embriogênese.',
    topics: [
      {
        id: 401,
        subject_id: 4,
        name: 'Tecidos dos sistemas (Circulatório, Respiratório, Digestório, Urinário, Reprodutor)',
        subtopics: [
          { id: 4001, topic_id: 401, name: 'Túnicas vasculares de artérias e veias elásticas/musculares', completed: false },
          { id: 4002, topic_id: 401, name: 'Epitélio respiratório e barreira hematoaérea', completed: false },
          { id: 4003, topic_id: 401, name: 'Camadas do trato digestório (mucosa, submucosa, muscular, adventícia/serosa)', completed: false },
          { id: 4004, topic_id: 401, name: 'Néfrons, corpúsculos renais e aparelho justaglomerular', completed: false },
          { id: 4005, topic_id: 401, name: 'Espermatogênese e túbulos seminíferos', completed: false },
          { id: 4006, topic_id: 401, name: 'Ciclo ovariano e endométrio uterino', completed: false },
        ]
      },
      {
        id: 402,
        subject_id: 4,
        name: 'Pele e anexos',
        subtopics: [
          { id: 4007, topic_id: 402, name: 'Camadas da epiderme e queratinização', completed: false },
          { id: 4008, topic_id: 402, name: 'Derme papilar e reticular', completed: false },
          { id: 4009, topic_id: 402, name: 'Hipoderme e tecido adiposo', completed: false },
          { id: 4010, topic_id: 402, name: 'Glândulas sebáceas, sudoríparas e folículos pilosos', completed: false },
        ]
      },
      {
        id: 403,
        subject_id: 4,
        name: 'Desenvolvimento embrionário (1ª à 8ª semana e anexos)',
        subtopics: [
          { id: 4011, topic_id: 403, name: 'Fecundação, clivagem e formação do blastocisto', completed: false },
          { id: 4012, topic_id: 403, name: 'Nidação e formação do disco bilaminar', completed: false },
          { id: 4013, topic_id: 403, name: 'Gastrulação e derivados dos três folhetos (ectoderme, mesoderme, endoderme)', completed: false },
          { id: 4014, topic_id: 403, name: 'Neurulação e fechamento do tubo neural', completed: false },
          { id: 4015, topic_id: 403, name: 'Dobramento embrionário e organogênese primária', completed: false },
          { id: 4016, topic_id: 403, name: 'Placenta, âmnio, córion e cordão umbilical', completed: false },
        ]
      }
    ]
  },
  {
    id: 5,
    name: 'Introdução ao Método Clínico II',
    code: 'MED-IMC2',
    color: 'emerald',
    icon: 'Stethoscope',
    description: 'Módulo IMC II: Semiologia médica, raciocínio clínico, imagenologia e práticas clínicas simuladas.',
    topics: [
      {
        id: 501,
        subject_id: 5,
        name: 'Semiologia dos Grandes Sintomas',
        subtopics: [
          { id: 5001, topic_id: 501, name: 'Dispneia (mecanismos, classificação funcional NYHA e anamnese)', completed: false },
          { id: 5002, topic_id: 501, name: 'Tosse e expectoração (aguda vs crônica, características semiológicas)', completed: false },
          { id: 5003, topic_id: 501, name: 'Icterícia (pré-hepática, hepática e pós-hepática/obstrutiva)', completed: false },
          { id: 5004, topic_id: 501, name: 'Dispepsia e doença do refluxo gastroesofágico', completed: false },
          { id: 5005, topic_id: 501, name: 'Diarreia (alta vs baixa, osmótica vs secretória vs inflamatória)', completed: false },
          { id: 5006, topic_id: 501, name: 'Dor (tipos nociceptiva, neuropática e psicogênica, escala visual analógica)', completed: false },
          { id: 5007, topic_id: 501, name: 'Febre e síndrome febril (curva térmica e febre de origem indeterminada)', completed: false },
          { id: 5008, topic_id: 501, name: 'Edema (fisiopatologia, sinal de Godet/cacifo e diagnóstico diferencial)', completed: false },
        ]
      },
      {
        id: 502,
        subject_id: 5,
        name: 'Imagenologia Médica',
        subtopics: [
          { id: 5009, topic_id: 502, name: 'Fundamentos e interpretação sistemática do Raio X de tórax e abdome', completed: false },
          { id: 5010, topic_id: 502, name: 'Ultrassonografia (USG) e princípios de ecogenicidade', completed: false },
          { id: 5011, topic_id: 502, name: 'Tomografia Computadorizada (TC) e densidades tomográficas (janelas)', completed: false },
          { id: 5012, topic_id: 502, name: 'Ressonância Magnética (RM) - sequências T1, T2 e contraste com gadolínio', completed: false },
          { id: 5013, topic_id: 502, name: 'Medicina Nuclear (cintilografia e PET-CT) e radiofármacos', completed: false },
        ]
      },
      {
        id: 503,
        subject_id: 5,
        name: 'Prática (Role Play e HC)',
        subtopics: [
          { id: 5014, topic_id: 503, name: 'Relação médico-paciente e empatia na anamnese', completed: false },
          { id: 5015, topic_id: 503, name: 'Construção da História Clínica completa (ID, QP, HDA, IS, AP, AF, AS)', completed: false },
          { id: 5016, topic_id: 503, name: 'Simulações Role Play de atendimento e feedback', completed: false },
          { id: 5017, topic_id: 503, name: 'Raciocínio clínico diagnóstico e tomada de decisão', completed: false },
        ]
      }
    ]
  }
]

export const INITIAL_SUBJECTS: Subject[] = RAW_SUBJECTS.map(s => {
  let total = 0
  let completed = 0
  s.topics.forEach(t => t.subtopics.forEach(st => {
    total++
    if (st.completed) completed++
  }))
  return {
    ...s,
    semester: 2,
    totalSubtopics: total,
    completedSubtopics: completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0
  }
})

export const INITIAL_EVENTS: ImportantEvent[] = [
  // Setembro / 2026
  {
    id: 1,
    title: 'Avaliação Teórico-Prática N1 de Anatomia',
    module_or_subject: 'Anatomia Humana (CHS II)',
    start_date: '2026-09-08',
    end_date: '2026-09-10',
    type: 'Prova',
    topics: ['Sistema Circulatório', 'Sistema Linfático', 'Sistema Respiratório']
  },
  {
    id: 2,
    title: 'Avaliação N1 de Bioquímica',
    module_or_subject: 'Bioquímica (CHS II)',
    start_date: '2026-09-15',
    end_date: null,
    type: 'Prova',
    topics: ['Metabolismo de carboidratos - Glicólise', 'Sinalização hormonal']
  },
  {
    id: 3,
    title: '1ª Avaliação de Fisiologia (Cardiovascular)',
    module_or_subject: 'Fisiologia Humana (CHS II)',
    start_date: '2026-09-18',
    end_date: null,
    type: 'Prova',
    topics: ['Fisiologia Cardiovascular', 'Ciclo cardíaco', 'Hemodinâmica', 'Eletrofisiologia e ECG']
  },
  {
    id: 4,
    title: 'Fórum Corpo Humano Saudável Integrador 1',
    module_or_subject: 'Módulo Integrador II',
    start_date: '2026-09-19',
    end_date: null,
    type: 'Fórum',
    topics: ['Integração Básica-Clínica', 'Discussão temática de casos de Anatomia, Fisiologia e Bioquímica']
  },
  // Outubro / 2026
  {
    id: 5,
    title: '1ª Avaliação Teórica de Histologia',
    module_or_subject: 'Histologia e Embriologia (CHS II)',
    start_date: '2026-10-05',
    end_date: null,
    type: 'Prova',
    topics: ['Tecidos dos sistemas Circulatório e Respiratório']
  },
  {
    id: 6,
    title: '1ª Avaliação Prática de Histologia',
    module_or_subject: 'Histologia e Embriologia (CHS II)',
    start_date: '2026-10-06',
    end_date: '2026-10-08',
    type: 'Prova',
    topics: ['Lâminas histológicas de Circulatório e Respiratório no laboratório']
  },
  {
    id: 7,
    title: 'Avaliação Teórica de Fisiologia (Respiratório)',
    module_or_subject: 'Fisiologia Humana (CHS II)',
    start_date: '2026-10-13',
    end_date: null,
    type: 'Prova',
    topics: ['Mecânica ventilatória', 'Trocas gasosas alvéolo-capilares', 'Controle central da respiração']
  },
  {
    id: 8,
    title: 'Fórum Corpo Humano Saudável Integrador 2',
    module_or_subject: 'Módulo Integrador II',
    start_date: '2026-10-17',
    end_date: null,
    type: 'Fórum',
    topics: ['Integração dos sistemas respiratório e circulatório com abordagem clínica']
  },
  {
    id: 9,
    title: 'Avaliação N2 de Bioquímica',
    module_or_subject: 'Bioquímica (CHS II)',
    start_date: '2026-10-20',
    end_date: null,
    type: 'Prova',
    topics: ['Metabolismo de lipídeos', 'Beta-oxidação', 'Síntese de colesterol e lipoproteínas']
  },
  {
    id: 10,
    title: 'Apresentação do Caso Clínico Integrador 1',
    module_or_subject: 'Módulo Integrador II',
    start_date: '2026-10-23',
    end_date: null,
    type: 'Apresentação',
    topics: ['Apresentação oral e discussão de caso clínico multidisciplinar']
  },
  // Novembro / 2026
  {
    id: 11,
    title: 'Prova Presencial do Caso Clínico Integrador',
    module_or_subject: 'Módulo Integrador II',
    start_date: '2026-11-06',
    end_date: null,
    type: 'Prova',
    topics: ['Avaliação escrita sobre os Casos Clínicos Integradores do semestre']
  },
  {
    id: 12,
    title: 'Apresentação de Seminários de Anatomia',
    module_or_subject: 'Anatomia Humana (CHS II)',
    start_date: '2026-11-17',
    end_date: '2026-11-19',
    type: 'Seminário',
    topics: ['Apresentação dos temas integrados de anatomia para a turma']
  },
  {
    id: 13,
    title: 'Avaliação N3 de Bioquímica',
    module_or_subject: 'Bioquímica (CHS II)',
    start_date: '2026-11-24',
    end_date: null,
    type: 'Prova',
    topics: ['Regulação e integração do metabolismo', 'Fosforilação oxidativa', 'Estado alimentado e jejum']
  },
  {
    id: 14,
    title: 'Avaliação Teórico-Prática N2 de Anatomia (Sensorial)',
    module_or_subject: 'Anatomia Humana (CHS II)',
    start_date: '2026-11-24',
    end_date: '2026-11-26',
    type: 'Prova',
    topics: ['Sistema Sensorial', 'Olho', 'Orelha', 'Vias sensoriais e peças práticas']
  },
  {
    id: 15,
    title: '2ª Avaliação Teórica de Histologia',
    module_or_subject: 'Histologia e Embriologia (CHS II)',
    start_date: '2026-11-30',
    end_date: null,
    type: 'Prova',
    topics: ['Tecidos dos sistemas Digestório, Urinário e Reprodutor', 'Embriologia básica']
  },
  // Dezembro / 2026
  {
    id: 16,
    title: 'Avaliação de Fisiologia',
    module_or_subject: 'Fisiologia Humana (CHS II)',
    start_date: '2026-12-01',
    end_date: null,
    type: 'Prova',
    topics: ['Fisiologia Renal e Digestória integradas']
  },
  {
    id: 17,
    title: '2ª Avaliação Prática de Histologia',
    module_or_subject: 'Histologia e Embriologia (CHS II)',
    start_date: '2026-12-01',
    end_date: '2026-12-03',
    type: 'Prova',
    topics: ['Identificação prática de lâminas ao microscópio']
  },
  {
    id: 18,
    title: 'Avaliação N4 de Bioquímica (Teatro Metabólico)',
    module_or_subject: 'Bioquímica (CHS II)',
    start_date: '2026-12-05',
    end_date: null,
    type: 'Apresentação',
    topics: ['Teatro Metabólico: Simulação e dramatização das vias metabólicas integradas']
  },
  {
    id: 19,
    title: 'Avaliações de Recuperação do CHS',
    module_or_subject: 'Módulo CHS II',
    start_date: '2026-12-07',
    end_date: '2026-12-10',
    type: 'Recuperação',
    topics: ['Avaliações de recuperação para Anatomia, Bioquímica, Fisiologia e Histologia']
  },
  {
    id: 20,
    title: 'Prova Final de Introdução ao Método Clínico II',
    module_or_subject: 'Introdução ao Método Clínico II (IMC II)',
    start_date: '2026-12-11',
    end_date: null,
    type: 'Prova',
    topics: ['Avaliação teórica e prática somativa de Semiologia e Raciocínio Clínico']
  }
]

const CAA = 'Centro de Aulas Aroeira - CAA - UFG'
const ICB3 = 'Instituto de Ciências Biológicas III'
const FM = 'Faculdade de Medicina - FM/UFG'

// Horários conforme Google Agenda (seg-sex)
export const INITIAL_CLASSES: ClassItem[] = [
  // Segunda-feira
  { id: 1, day_of_week: 1, start_time: '08:00', end_time: '09:40', subject_name: 'Fisiologia', room: `CAA 107 • ${CAA}`, type: 'Teórica', color: 'emerald' },
  { id: 2, day_of_week: 1, start_time: '10:00', end_time: '11:40', subject_name: 'Histologia', room: `ICB3 Auditório • ${ICB3}`, type: 'Teórica', color: 'emerald' },
  { id: 3, day_of_week: 1, start_time: '11:40', end_time: '12:30', subject_name: 'Anatomia', room: `ICB3 Auditório • ${ICB3}`, type: 'Teórica', color: 'emerald' },
  { id: 4, day_of_week: 1, start_time: '14:00', end_time: '17:40', subject_name: 'SFC', type: 'Teórica', color: 'amber' },
  // Terça-feira
  { id: 5, day_of_week: 2, start_time: '08:00', end_time: '09:40', subject_name: 'Bioquímica', room: `CAB 107 • ${ICB3}`, type: 'Teórica', color: 'emerald' },
  { id: 6, day_of_week: 2, start_time: '10:00', end_time: '11:40', subject_name: 'Histologia', room: `ICB3 Lab. 204 • ${ICB3}`, type: 'Prática', color: 'emerald' },
  { id: 7, day_of_week: 2, start_time: '13:10', end_time: '17:40', subject_name: 'Anatomia', room: `ICB3 Lab. 2 • ${ICB3}`, type: 'Prática', color: 'emerald' },
  // Quarta-feira
  { id: 8, day_of_week: 3, start_time: '07:10', end_time: '09:40', subject_name: 'Fisiologia', room: 'CAA 107', type: 'Teórica', color: 'emerald' },
  // Quinta-feira
  { id: 9, day_of_week: 4, start_time: '08:00', end_time: '09:40', subject_name: 'Bioquímica', room: `CAB 107 • ${ICB3}`, type: 'Teórica', color: 'emerald' },
  { id: 10, day_of_week: 4, start_time: '10:00', end_time: '11:40', subject_name: 'Histologia', room: `ICB3 Lab. 204 • ${ICB3}`, type: 'Prática', color: 'emerald' },
  // Sexta-feira
  { id: 11, day_of_week: 5, start_time: '07:10', end_time: '08:50', subject_name: 'Imagenologia', room: FM, type: 'Teórica', color: 'amber' },
  { id: 12, day_of_week: 5, start_time: '08:50', end_time: '11:40', subject_name: 'Semiologia', room: FM, type: 'Teórica', color: 'amber' },
  { id: 13, day_of_week: 5, start_time: '14:00', end_time: '18:30', subject_name: 'IMC', room: FM, type: 'Prática', color: 'amber' }
]
