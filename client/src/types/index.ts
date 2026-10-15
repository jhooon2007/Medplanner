export interface User {
  id: number
  name: string
  email: string
  phone?: string | null
  photo_url?: string | null
  role: 'admin' | 'student'
  created_at?: string
  completed_subtopics_count?: number
}

export interface ClassItem {
  id: number
  user_id?: number | null
  day_of_week: number // 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
  start_time: string
  end_time: string
  subject_name: string
  room?: string
  teacher?: string
  type: 'Teórica' | 'Prática' | 'TBL' | 'Seminário' | 'Laboratório'
  color?: string
}

export interface ImportantEvent {
  id: number
  user_id?: number | null
  title: string
  module_or_subject: string
  start_date: string // YYYY-MM-DD
  end_date?: string | null
  type: string
  topics: string[]
  is_custom?: number
}

export interface Subtopic {
  id: number
  topic_id: number
  name: string
  order_index?: number
  completed: boolean
}

export interface Topic {
  id: number
  subject_id: number
  name: string
  order_index?: number
  subtopics: Subtopic[]
}

export interface Subject {
  id: number
  user_id?: number | null
  name: string
  code?: string
  icon?: string
  color: string
  description?: string
  order_index?: number
  topics: Topic[]
  totalSubtopics?: number
  completedSubtopics?: number
  percentage?: number
}

export interface GradeItem {
  id?: number
  user_id?: number
  module: string
  discipline?: string
  item_key: string
  item_name: string
  score?: number | null
  weight?: number
}

