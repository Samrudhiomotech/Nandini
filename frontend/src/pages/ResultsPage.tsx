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
  LineChart,
  Line,
  Legend,
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
          <div className="w-14 h-14 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin mx-auto" />
          <p className="text-white/50 text-sm">Loading your results…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <Link to="/" className="text-white/50 text-sm underline">Back to home</Link>
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
      fill: Number(size) === iocs ? '#00d4ff' : '#7c3aed',
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
    <div className="min-h-screen gradient-bg text-white">
      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4 flex items-center gap-4">
        <Link to="/" className="text-white/40 hover:text-white/80 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-cyan-400" />
          <span className="font-body text-sm text-white/70">ACA Platform — Results</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        {/* Hero result */}
        <div className="text-center space-y-4">
          <p className="text-white/40 text-sm uppercase tracking-widest font-body">Your Individual Optimal Choice-Set Size</p>
          <div className="text-8xl font-heading italic glow-cyan text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-600">
            {iocs}
          </div>
          <p className="text-white/60 text-sm max-w-md mx-auto leading-relaxed">
            {results.message}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className="liquid-glass rounded px-4 py-2 text-sm">
              <span className="text-white/40">Confidence </span>
              <span className="text-cyan-400 font-mono">R²={prediction.confidence.toFixed(3)}</span>
            </div>
            <div className="liquid-glass rounded px-4 py-2 text-sm">
              <span className="text-white/40">Method </span>
              <span className="text-violet-400 font-mono capitalize">{(prediction.curve_params as any)?.method ?? 'Gaussian'}</span>
            </div>
            {results.improvement_pct !== null && (
              <div className="liquid-glass rounded px-4 py-2 text-sm">
                <span className="text-white/40">Improvement </span>
                <span className={`font-mono ${results.improvement_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {results.improvement_pct > 0 ? '+' : ''}{results.improvement_pct}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Gaussian Curve ── */}
        <div className="card-glass p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp size={16} className="text-cyan-400" />
            <h2 className="text-sm font-body font-medium text-white/80 uppercase tracking-widest">
              DEI vs Choice-Set Size — Fitted Curve
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={curvePoints} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gaussGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="x" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} label={{ value: 'Choice Set Size', position: 'insideBottom', offset: -2, fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} />
              <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} label={{ value: 'DEI', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
                itemStyle={{ color: '#00d4ff' }}
              />
              <ReferenceLine x={prediction.predicted_iocs} stroke="#00d4ff" strokeDasharray="6 3" label={{ value: `IOCS=${iocs}`, fill: '#00d4ff', fontSize: 11 }} />
              <Area type="monotone" dataKey="y" stroke="#00d4ff" strokeWidth={2} fill="url(#gaussGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── DEI per size bars ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-glass p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-6">
              <Target size={16} className="text-violet-400" />
              <h2 className="text-sm font-body font-medium text-white/80 uppercase tracking-widest">Calibration DEI</h2>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={calibData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="size" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} domain={[-0.4, 0.8]} />
                <Tooltip
                  contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                  itemStyle={{ color: '#a78bfa' }}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                <Bar dataKey="DEI" radius={[6, 6, 0, 0]}>
                  {calibData.map((entry, index) => (
                    <rect key={index} fill={entry.sizeNum === iocs ? '#00d4ff' : '#7c3aed'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card-glass p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-6">
              <Award size={16} className="text-emerald-400" />
              <h2 className="text-sm font-body font-medium text-white/80 uppercase tracking-widest">Validation DEI</h2>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={valData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="size" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} domain={[-0.4, 0.8]} />
                <Tooltip
                  contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                  itemStyle={{ color: '#34d399' }}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                <Bar dataKey="DEI" radius={[6, 6, 0, 0]}
                  fill="#10b981"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Raw DEI table */}
        <div className="card-glass p-6 rounded-2xl">
          <h2 className="text-sm font-body font-medium text-white/80 uppercase tracking-widest mb-5">DEI Scores by Set Size</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-white/40 font-normal pb-3 pr-6">Phase</th>
                  {[3,6,9,12,18].map(s => (
                    <th key={s} className={`text-center text-white/40 font-normal pb-3 px-3 ${s === iocs ? 'text-cyan-400' : ''}`}>
                      N={s} {s === iocs ? '★' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-6 text-white/60">Calibration</td>
                  {[3,6,9,12,18].map(s => (
                    <td key={s} className={`text-center py-3 px-3 font-mono ${s === iocs ? 'text-cyan-400' : 'text-white/70'}`}>
                      {results.calibration_dei[String(s)] ?? '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-6 text-white/60">Validation</td>
                  {[3,6,9,12,18].map(s => (
                    <td key={s} className={`text-center py-3 px-3 font-mono ${s === iocs ? 'text-emerald-400' : 'text-white/70'}`}>
                      {results.validation_dei[String(s)] ?? '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-4 justify-center flex-wrap">
          <Link to="/experiment" className="bg-white text-black font-body font-semibold text-sm rounded-full px-6 py-3 hover:bg-white/90 transition-all">
            Run New Experiment
          </Link>
          <Link to="/admin" className="liquid-glass text-white font-body text-sm rounded-full px-6 py-3 hover:bg-white/5 transition-all">
            Admin Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
