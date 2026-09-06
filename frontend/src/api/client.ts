import axios from 'axios'

const BASE = '/api'

const http = axios.create({ baseURL: BASE })

export interface ParticipantOut {
  id: string
  name: string | null
  age: number | null
  session_token: string
  created_at: string
  predicted_iocs: number | null
  prediction_confidence: number | null
  validated_iocs: number | null
}

export interface OptionSchema {
  index: number
  name: string
  price: number
  battery_hours: number
  ram_gb: number
  storage_gb: number
  display_inches: number
  utility_score: number
}

export interface TrialOut {
  id: string
  participant_id: string
  phase: 'calibration' | 'validation'
  choice_set_size: number
  trial_order: number
  options: OptionSchema[]
}

export interface ResponseCreate {
  chosen_option_index: number
  response_time_ms: number
  confidence: number
  perceived_difficulty: number
  regret: number
  selection_changes: number
}

export interface ResponseOut {
  id: string
  trial_id: string
  chosen_option_index: number
  response_time_ms: number
  confidence: number
  perceived_difficulty: number
  regret: number
  selection_changes: number
  is_correct: boolean
  dei_score: number
}

export interface PredictionOut {
  participant_id: string
  predicted_iocs: number
  confidence: number
  curve_params: Record<string, unknown>
  dei_per_size: Record<string, number>
}

export interface ResultsOut {
  participant_id: string
  predicted_iocs: number
  validation_iocs: number | null
  calibration_dei: Record<string, number>
  validation_dei: Record<string, number>
  improvement_pct: number | null
  message: string
}

export interface AdminSummaryOut {
  total_participants: number
  avg_predicted_iocs: number | null
  iocs_distribution: Record<string, number>
  avg_calibration_accuracy: number
  total_trials: number
}

// ── Participants ──────────────────────────────────────────────────────────
export const createParticipant = (name?: string, age?: number) =>
  http.post<ParticipantOut>('/participants', { name, age }).then(r => r.data)

export const getParticipant = (id: string) =>
  http.get<ParticipantOut>(`/participants/${id}`).then(r => r.data)

// ── Trials ────────────────────────────────────────────────────────────────
export const nextTrial = (participantId: string) =>
  http.get<TrialOut | null>(`/trials/next/${participantId}`).then(r => r.data)

export const submitResponse = (trialId: string, body: ResponseCreate) =>
  http.post<ResponseOut>(`/trials/${trialId}/respond`, body).then(r => r.data)

// ── Prediction ────────────────────────────────────────────────────────────
export const predict = (participantId: string) =>
  http.get<PredictionOut>(`/participants/${participantId}/predict`).then(r => r.data)

// ── Results ───────────────────────────────────────────────────────────────
export const getResults = (participantId: string) =>
  http.get<ResultsOut>(`/participants/${participantId}/results`).then(r => r.data)

// ── Admin ─────────────────────────────────────────────────────────────────
export const getAdminSummary = () =>
  http.get<AdminSummaryOut>('/admin/summary').then(r => r.data)
