import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { Brain, TrendingUp, Target, Award, ArrowLeft } from 'lucide-react'
import { predict, getResults, type PredictionOut, type ResultsOut } from '../api/client'

interface CurvePoint { x: number; y: number }

export default function ResultsPage() {
  const { participantId } = useParams<{ participantId: string }>()
  const [prediction, setPrediction] = useState<PredictionOut | null>(null)
  const [results, setResults] = useState<ResultsOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!participantId) return
    ;(async () => {
      try {
        const [pred, res] = await Promise.all([
          predict(participantId),
          getResults(participantId),
        ])
        setPrediction(pred)
        setResults(res)
      } catch (e: any) {
        setError(e?.response?.data?.detail || 'Failed to load results.')
      } finally {
        setLoading(false)
      }
    })()
  }, [participantId])

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-2 border-hair-strong border-t-brass rounded-full animate-spin mx-auto" />
          <p className="text-ink-50 text-base">Loading your results…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-bad text-base">{error}</p>
          <Link to="/" className="text-ink-50 text-sm underline">Back to home</Link>
        </div>
      </div>
    )
  }

  if (!prediction || !results) return null

  // Gaussian curve data
  const curvePoints: CurvePoint[] = (prediction.curve_params as any)?.curve_points || []
  const iocs = Math.round(prediction.predicted_iocs)

  // Calibration bar data
  const calibData = Object.entries(results.calibration_dei)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([size, dei]) => ({
      size: `N=${size}`,
      sizeNum: Number(size),
      DEI: parseFloat(dei.toFixed(3)),
      fill: Number(size) === iocs ? '#A5672C' : '#2B6459',
    }))

  // Validation comparison
  const valData = Object.entries(results.validation_dei)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([size, dei]) => ({
      size: `N=${size}`,
      sizeNum: Number(size),
      DEI: parseFloat(dei.toFixed(3)),
      isOptimal: Number(size) === iocs,
    }))

  return (
    <div className="min-h-screen gradient-bg text-ink">
      {/* Header */}
      <div className="border-b border-hair px-6 py-4 flex items-center gap-4">
        <Link to="/" className="text-ink-40">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-2">
          <Brain size={20} className="text-brass" />
          <span className="font-body text-base text-ink-70">ACA Platform — Results</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        {/* Hero result */}
        <div className="text-center space-y-4">
          <p className="text-ink-50 text-sm font-body">Your individual optimal choice-set size</p>
          <div className="text-8xl font-heading glow-cyan">
            {iocs}
          </div>
          <p className="text-ink-60 text-base max-w-md mx-auto leading-relaxed">
            {results.message}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className="liquid-glass rounded-full px-4 py-2 text-sm">
              <span className="text-ink-40">Confidence </span>
              <span className="text-brass font-mono">R²={prediction.confidence.toFixed(3)}</span>
            </div>
            <div className="liquid-glass rounded-full px-4 py-2 text-sm">
              <span className="text-ink-40">Method </span>
              <span className="text-teal font-mono capitalize">{(prediction.curve_params as any)?.method ?? 'Gaussian'}</span>
            </div>
            {results.improvement_pct !== null && (
              <div className="liquid-glass rounded-full px-4 py-2 text-sm">
                <span className="text-ink-40">Improvement </span>
                <span className={`font-mono ${results.improvement_pct >= 0 ? 'text-good' : 'text-bad'}`}>
                  {results.improvement_pct > 0 ? '+' : ''}{results.improvement_pct}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Gaussian Curve ── */}
        <div className="card-glass p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp size={18} className="text-brass" />
            <h2 className="text-base font-body font-medium text-ink-80">
              DEI vs choice-set size — fitted curve
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={curvePoints} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gaussGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A5672C" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#A5672C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(34,31,26,0.08)" />
              <XAxis dataKey="x" stroke="rgba(34,31,26,0.25)" tick={{ fill: 'rgba(34,31,26,0.55)', fontSize: 12 }} label={{ value: 'Choice set size', position: 'insideBottom', offset: -2, fill: 'rgba(34,31,26,0.45)', fontSize: 12 }} />
              <YAxis stroke="rgba(34,31,26,0.25)" tick={{ fill: 'rgba(34,31,26,0.55)', fontSize: 12 }} label={{ value: 'DEI', angle: -90, position: 'insideLeft', fill: 'rgba(34,31,26,0.45)', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#FAF7EF', border: '1px solid #DAD0B8', borderRadius: 12, fontSize: 13 }}
                labelStyle={{ color: 'rgba(34,31,26,0.6)' }}
                itemStyle={{ color: '#A5672C' }}
              />
              <ReferenceLine x={prediction.predicted_iocs} stroke="#A5672C" strokeDasharray="6 3" label={{ value: `IOCS=${iocs}`, fill: '#A5672C', fontSize: 12 }} />
              <Area type="monotone" dataKey="y" stroke="#A5672C" strokeWidth={2} fill="url(#gaussGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── DEI per size bars ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-glass p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-6">
              <Target size={18} className="text-teal" />
              <h2 className="text-base font-body font-medium text-ink-80">Calibration DEI</h2>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={calibData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(34,31,26,0.08)" />
                <XAxis dataKey="size" stroke="rgba(34,31,26,0.25)" tick={{ fill: 'rgba(34,31,26,0.55)', fontSize: 11 }} />
                <YAxis stroke="rgba(34,31,26,0.25)" tick={{ fill: 'rgba(34,31,26,0.55)', fontSize: 11 }} domain={[-0.4, 0.8]} />
                <Tooltip
                  contentStyle={{ background: '#FAF7EF', border: '1px solid #DAD0B8', borderRadius: 12, fontSize: 13 }}
                  itemStyle={{ color: '#2B6459' }}
                />
                <ReferenceLine y={0} stroke="rgba(34,31,26,0.15)" />
                <Bar dataKey="DEI" radius={[6, 6, 0, 0]}>
                  {calibData.map((entry, index) => (
                    <rect key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card-glass p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-6">
              <Award size={18} className="text-good" />
              <h2 className="text-base font-body font-medium text-ink-80">Validation DEI</h2>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={valData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(34,31,26,0.08)" />
                <XAxis dataKey="size" stroke="rgba(34,31,26,0.25)" tick={{ fill: 'rgba(34,31,26,0.55)', fontSize: 11 }} />
                <YAxis stroke="rgba(34,31,26,0.25)" tick={{ fill: 'rgba(34,31,26,0.55)', fontSize: 11 }} domain={[-0.4, 0.8]} />
                <Tooltip
                  contentStyle={{ background: '#FAF7EF', border: '1px solid #DAD0B8', borderRadius: 12, fontSize: 13 }}
                  itemStyle={{ color: '#3C7A49' }}
                />
                <ReferenceLine y={0} stroke="rgba(34,31,26,0.15)" />
                <Bar dataKey="DEI" radius={[6, 6, 0, 0]}
                  fill="#3C7A49"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Raw DEI table */}
        <div className="card-glass p-6 rounded-2xl">
          <h2 className="text-base font-body font-medium text-ink-80 mb-5">DEI scores by set size</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-base font-body">
              <thead>
                <tr className="border-b border-hair">
                  <th className="text-left text-ink-40 font-normal pb-3 pr-6">Phase</th>
                  {[3,6,9,12,18].map(s => (
                    <th key={s} className={`text-center text-ink-40 font-normal pb-3 px-3 ${s === iocs ? 'text-brass' : ''}`}>
                      N={s} {s === iocs ? '★' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-hair">
                  <td className="py-3 pr-6 text-ink-60">Calibration</td>
                  {[3,6,9,12,18].map(s => (
                    <td key={s} className={`text-center py-3 px-3 font-mono ${s === iocs ? 'text-brass' : 'text-ink-70'}`}>
                      {results.calibration_dei[String(s)] ?? '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-6 text-ink-60">Validation</td>
                  {[3,6,9,12,18].map(s => (
                    <td key={s} className={`text-center py-3 px-3 font-mono ${s === iocs ? 'text-good' : 'text-ink-70'}`}>
                      {results.validation_dei[String(s)] ?? '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-4 justify-center flex-wrap">
          <Link to="/experiment" className="btn-primary font-body font-semibold text-base rounded-full px-6 py-3 transition-all">
            Run new experiment
          </Link>
          <Link to="/admin" className="btn-ghost font-body text-base rounded-full px-6 py-3 transition-all">
            Admin dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
