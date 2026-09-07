import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Timer, Brain, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  createParticipant,
  nextTrial,
  submitResponse,
  predict,
  formatINR,
  type TrialOut,
  type ResponseCreate,
} from '../api/client'
import DeviceArt, { tierForRank } from '../components/DeviceArt'

const CHOICE_SET_SIZES = [3, 6, 9, 12, 18]
const TOTAL_CALIBRATION = 15
const TRIAL_TIME_LIMIT_MS = 60000

type Phase = 'onboarding' | 'calibration' | 'post-trial' | 'predicting' | 'validation' | 'done'

interface Metrics {
  confidence: number
  perceived_difficulty: number
  regret: number
}

export default function ExperimentPage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('onboarding')
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [currentTrial, setCurrentTrial] = useState<TrialOut | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [selectionChanges, setSelectionChanges] = useState(0)
  const [lastSelected, setLastSelected] = useState<number | null>(null)
  const [startTime, setStartTime] = useState<number>(0)
  const [elapsed, setElapsed] = useState(0)
  const [trialCount, setTrialCount] = useState(0)
  const [metrics, setMetrics] = useState<Metrics>({ confidence: 4, perceived_difficulty: 4, regret: 4 })
  const [lastResponse, setLastResponse] = useState<{ is_correct: boolean; dei_score: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<number>(0)

  // Timer tick
  useEffect(() => {
    if (phase !== 'calibration' && phase !== 'validation') return
    timerRef.current = window.setInterval(() => {
      setElapsed(Date.now() - startTime)
    }, 100)
    return () => clearInterval(timerRef.current)
  }, [phase, startTime])

  const loadNextTrial = useCallback(async (pid: string) => {
    setLoading(true)
    setError(null)
    try {
      const trial = await nextTrial(pid)
      if (!trial) {
        // All trials done
        if (phase === 'calibration' || phase === 'predicting') {
          setPhase('predicting')
          runPrediction(pid)
        } else {
          navigate(`/results/${pid}`)
        }
        return
      }
      setCurrentTrial(trial)
      setSelectedIndex(null)
      setLastSelected(null)
      setSelectionChanges(0)
      setStartTime(Date.now())
      setElapsed(0)
      setPhase(trial.phase === 'calibration' ? 'calibration' : 'validation')
    } catch {
      setError('Failed to load next trial. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }, [phase, navigate])

  const runPrediction = async (pid: string) => {
    setPhase('predicting')
    try {
      await predict(pid)
      // Load validation trials
      await loadNextTrial(pid)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Prediction failed.')
    }
  }

  const handleOnboard = async () => {
    if (!name.trim()) { setError('Please enter your name.'); return }
    setLoading(true)
    setError(null)
    try {
      const p = await createParticipant(name.trim(), age ? parseInt(age) : undefined)
      setParticipantId(p.id)
      await loadNextTrial(p.id)
    } catch {
      setError('Could not connect to backend. Make sure uvicorn is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (idx: number) => {
    if (selectedIndex !== null && selectedIndex !== idx) {
      setSelectionChanges(c => c + 1)
    }
    setSelectedIndex(idx)
  }

  const handleSubmitChoice = async () => {
    if (selectedIndex === null || !currentTrial || !participantId) return
    clearInterval(timerRef.current)
    const rt = Date.now() - startTime
    setLoading(true)
    try {
      const body: ResponseCreate = {
        chosen_option_index: selectedIndex,
        response_time_ms: rt,
        confidence: metrics.confidence,
        perceived_difficulty: metrics.perceived_difficulty,
        regret: metrics.regret,
        selection_changes: selectionChanges,
      }
      const resp = await submitResponse(currentTrial.id, body)
      setLastResponse({ is_correct: resp.is_correct, dei_score: resp.dei_score })
      setTrialCount(c => c + 1)
      setPhase('post-trial')
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Submission failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleContinue = async () => {
    if (!participantId) return
    setMetrics({ confidence: 4, perceived_difficulty: 4, regret: 4 })
    await loadNextTrial(participantId)
  }

  const progress = Math.min(100, (trialCount / TOTAL_CALIBRATION) * 100)
  const timeLeft = Math.max(0, TRIAL_TIME_LIMIT_MS - elapsed)
  const timeLeftSec = Math.ceil(timeLeft / 1000)

  // ── Onboarding ────────────────────────────────────────────────────────
  if (phase === 'onboarding') {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 liquid-glass rounded-full px-4 py-2 mb-6">
              <Brain size={18} className="text-brass" />
              <span className="text-base font-body font-medium text-ink-70">ACA Experiment Platform</span>
            </div>
            <h1 className="font-heading text-4xl text-ink mb-3">Welcome, participant</h1>
            <p className="text-ink-60 text-base leading-relaxed">
              This experiment studies how the number of choices affects your decision quality.
              You will complete <strong className="text-ink-80">15 calibration trials</strong> followed
              by <strong className="text-ink-80">9 validation trials</strong>.
            </p>
          </div>

          <div className="card-glass p-6 space-y-5">
            {error && (
              <div className="flex items-start gap-2 bg-bad-soft border border-bad rounded-xl p-3 text-bad text-sm">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm text-ink-50 mb-1.5 font-body">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleOnboard()}
                placeholder="Your name"
                className="w-full bg-wash border border-hair rounded-xl px-4 py-3 text-ink text-base font-body outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm text-ink-50 mb-1.5 font-body">Age (optional)</label>
              <input
                type="number"
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="25"
                className="w-full bg-wash border border-hair rounded-xl px-4 py-3 text-ink text-base font-body outline-none transition-all"
              />
            </div>
            <button
              onClick={handleOnboard}
              disabled={loading}
              className="btn-primary w-full text-base font-body font-semibold rounded-xl py-3.5 transition-all duration-200 mt-2"
            >
              {loading ? 'Setting up...' : 'Begin experiment →'}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {CHOICE_SET_SIZES.map(s => (
              <div key={s} className="card-glass p-3 text-center">
                <div className="text-2xl font-heading text-brass">{s}</div>
                <div className="text-sm text-ink-40 mt-1">options</div>
              </div>
            ))}
            <div className="card-glass p-3 text-center col-span-3">
              <div className="text-sm text-ink-40">Each trial has a mathematically optimal answer</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Predicting ────────────────────────────────────────────────────────
  if (phase === 'predicting') {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 border-2 border-hair-strong border-t-brass rounded-full animate-spin mx-auto" />
          <h2 className="font-heading text-3xl text-ink">Computing your IOCS…</h2>
          <p className="text-ink-50 text-base max-w-xs mx-auto">
            Fitting a Gaussian curve to your DEI scores across all choice-set sizes.
          </p>
        </div>
      </div>
    )
  }

  // ── Post-trial feedback ───────────────────────────────────────────────
  if (phase === 'post-trial') {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          {/* Result banner */}
          <div className={`card-glass p-5 text-center rounded-2xl ${lastResponse?.is_correct ? 'border-good' : 'border-bad'}`}>
            {lastResponse?.is_correct ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 size={32} className="text-good" />
                <span className="text-good font-body font-semibold text-lg">Correct choice!</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <AlertCircle size={32} className="text-bad" />
                <span className="text-bad font-body font-semibold text-lg">Suboptimal choice</span>
              </div>
            )}
            <div className="mt-3 text-ink-60 text-base">
              DEI Score: <span className="text-ink font-medium">{lastResponse?.dei_score.toFixed(3)}</span>
            </div>
          </div>

          {/* Rating sliders */}
          <div className="card-glass p-6 space-y-6">
            <h3 className="text-ink-80 text-base font-body font-medium">Rate your experience</h3>

            {([
              ['confidence', 'Confidence', 'Not confident', 'Very confident'],
              ['perceived_difficulty', 'Difficulty', 'Very easy', 'Very hard'],
              ['regret', 'Regret', 'No regret', 'High regret'],
            ] as [keyof Metrics, string, string, string][]).map(([key, label, lo, hi]) => (
              <div key={key}>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-ink-60 font-body">{label}</span>
                  <span className="text-sm text-brass font-mono">{metrics[key]}/7</span>
                </div>
                <input
                  type="range" min={1} max={7} step={1}
                  value={metrics[key]}
                  onChange={e => setMetrics(m => ({ ...m, [key]: Number(e.target.value) }))}
                  className="custom-slider"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-sm text-ink-30">{lo}</span>
                  <span className="text-sm text-ink-30">{hi}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <div className="flex-1 card-glass p-3 text-center">
              <div className="text-ink-40 text-sm mb-1">Trial</div>
              <div className="text-ink font-mono text-lg">{trialCount} / {TOTAL_CALIBRATION}</div>
            </div>
            <button
              onClick={handleContinue}
              disabled={loading}
              className="btn-primary flex-1 font-body font-semibold text-base rounded-xl py-3 flex items-center justify-center gap-2 transition-all"
            >
              {loading ? 'Loading…' : <>Continue <ChevronRight size={18} /></>}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Trial (calibration or validation) ────────────────────────────────
  if (!currentTrial) return null

  const sortedByPrice = [...currentTrial.options].sort((a, b) => a.price - b.price)

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-hair">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-brass animate-pulse" />
          <span className="text-sm text-ink-50 font-body">
            {currentTrial.phase === 'calibration' ? 'Calibration' : 'Validation'} phase
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-ink-50 font-mono">
          <Timer size={16} />
          <span className={timeLeftSec < 10 ? 'text-bad' : ''}>{timeLeftSec}s</span>
        </div>
        <div className="text-sm text-ink-50 font-body">
          {currentTrial.choice_set_size} options
        </div>
      </div>

      {/* Progress */}
      {currentTrial.phase === 'calibration' && (
        <div className="px-6 py-2">
          <div className="flex justify-between text-sm text-ink-30 mb-1">
            <span>Progress</span>
            <span>{trialCount}/{TOTAL_CALIBRATION}</span>
          </div>
          <div className="h-1.5 bg-wash rounded-full">
            <div className="progress-bar-fill h-full" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Task prompt */}
      <div className="px-6 py-5 text-center">
        <p className="text-ink-70 text-base font-body leading-relaxed max-w-lg mx-auto">
          Select the <strong className="text-ink">best laptop</strong> based on battery life, performance, storage, and value.
          One option is objectively optimal.
        </p>
      </div>

      {/* Options grid */}
      <div className="flex-1 px-4 pb-4 overflow-y-auto">
        <div className={`grid gap-3 max-w-5xl mx-auto ${
          currentTrial.choice_set_size <= 3 ? 'grid-cols-1 sm:grid-cols-3' :
          currentTrial.choice_set_size <= 6 ? 'grid-cols-2 sm:grid-cols-3' :
          currentTrial.choice_set_size <= 9 ? 'grid-cols-2 sm:grid-cols-3' :
          currentTrial.choice_set_size <= 12 ? 'grid-cols-2 sm:grid-cols-4' :
          'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
        }`}>
          {currentTrial.options.map(opt => {
            const rank = sortedByPrice.findIndex(o => o.index === opt.index)
            const tier = tierForRank(rank, sortedByPrice.length)
            return (
              <button
                key={opt.index}
                onClick={() => handleSelect(opt.index)}
                className={`card-glass p-3 text-left transition-all duration-200 ${
                  selectedIndex === opt.index ? 'selected' : ''
                }`}
              >
                <DeviceArt tier={tier} className="w-full h-16 mb-2" />
                <div className="text-sm text-ink-50 mb-1.5 truncate font-body">{opt.name}</div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-50">Price</span>
                    <span className="text-ink font-mono">{formatINR(opt.price)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-50">Battery</span>
                    <span className="text-ink font-mono">{opt.battery_hours}h</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-50">RAM</span>
                    <span className="text-ink font-mono">{opt.ram_gb}GB</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-50">Storage</span>
                    <span className="text-ink font-mono">{opt.storage_gb}GB</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-50">Display</span>
                    <span className="text-ink font-mono">{opt.display_inches}"</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Submit */}
      <div className="px-6 py-4 border-t border-hair">
        {error && (
          <div className="text-bad text-sm mb-3 text-center">{error}</div>
        )}
        <button
          onClick={handleSubmitChoice}
          disabled={selectedIndex === null || loading}
          className="btn-primary w-full font-body font-semibold text-base rounded-xl py-3.5 transition-all duration-200 max-w-lg mx-auto block"
        >
          {loading ? 'Submitting…' : selectedIndex === null ? 'Select an option' : 'Confirm selection →'}
        </button>
      </div>
    </div>
  )
}
