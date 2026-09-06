import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Users, Brain, Target, CheckCircle2, ArrowLeft, RefreshCw } from 'lucide-react'
import { getAdminSummary, type AdminSummaryOut } from '../api/client'

const PIE_COLORS = ['#00d4ff', '#7c3aed', '#10b981', '#f59e0b', '#ef4444']

export default function AdminPage() {
  const [data, setData] = useState<AdminSummaryOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await getAdminSummary())
    } catch {
      setError('Backend not reachable. Start uvicorn first.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <button onClick={load} className="text-white/50 text-sm underline">Retry</button>
        </div>
      </div>
    )
  }

  const distData = Object.entries(data.iocs_distribution).map(([k, v]) => ({
    name: `N=${k}`,
    count: v,
  }))

  const statsCards = [
    { label: 'Participants', value: data.total_participants, icon: Users, color: 'text-cyan-400' },
    { label: 'Avg IOCS', value: data.avg_predicted_iocs?.toFixed(1) ?? '—', icon: Brain, color: 'text-violet-400' },
    { label: 'Total Trials', value: data.total_trials, icon: Target, color: 'text-emerald-400' },
    { label: 'Avg Accuracy', value: `${(data.avg_calibration_accuracy * 100).toFixed(1)}%`, icon: CheckCircle2, color: 'text-amber-400' },
  ]

  return (
    <div className="min-h-screen gradient-bg text-white">
      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-white/40 hover:text-white/80 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-violet-400" />
            <span className="font-body text-sm text-white/70">ACA Platform — Admin Dashboard</span>
          </div>
        </div>
        <button
          onClick={load}
          className="liquid-glass flex items-center gap-2 rounded px-3 py-1.5 text-xs text-white/60 hover:text-white transition-all"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statsCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card-glass p-5 rounded-2xl">
              <Icon size={20} className={`${color} mb-3`} />
              <div className="text-2xl font-heading italic text-white mb-1">{value}</div>
              <div className="text-xs text-white/40 font-body">{label}</div>
            </div>
          ))}
        </div>

        {/* IOCS Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-glass p-6 rounded-2xl">
            <h2 className="text-sm font-body font-medium text-white/80 uppercase tracking-widest mb-6">
              IOCS Distribution
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                  itemStyle={{ color: '#00d4ff' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {distData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card-glass p-6 rounded-2xl">
            <h2 className="text-sm font-body font-medium text-white/80 uppercase tracking-widest mb-6">
              IOCS Share
            </h2>
            {data.total_participants > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={distData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) =>
                      percent > 0 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''
                    }
                    labelLine={false}
                  >
                    {distData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-white/30 text-sm">
                No participant data yet. Run the experiment first.
              </div>
            )}
          </div>
        </div>

        {/* Research note */}
        <div className="card-glass p-6 rounded-2xl border border-violet-500/20">
          <h2 className="text-sm font-body font-medium text-white/80 uppercase tracking-widest mb-3">
            Research Methodology
          </h2>
          <div className="space-y-3 text-sm text-white/50 leading-relaxed">
            <p>
              <strong className="text-white/70">Decision Efficiency Index (DEI)</strong> = 0.35·accuracy − 0.20·norm(RT) + 0.15·norm(confidence) − 0.15·norm(difficulty) − 0.10·norm(regret) − 0.05·norm(changes)
            </p>
            <p>
              <strong className="text-white/70">IOCS Prediction</strong>: A Gaussian f(x) = a·exp(−(x−μ)²/2σ²) + b is fit to DEI vs set-size. μ is the Individual Optimal Choice-Set Size. R² measures prediction confidence.
            </p>
            <p>
              <strong className="text-white/70">Validation</strong>: Participants complete trials at IOCS−3, IOCS, and IOCS+3. Improvement% = (DEI_optimal − mean(DEI_others)) / |mean(DEI_others)| × 100.
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <Link
            to="/experiment"
            className="bg-white text-black font-body font-semibold text-sm rounded-full px-8 py-3.5 hover:bg-white/90 transition-all"
          >
            + Add New Participant
          </Link>
        </div>
      </div>
    </div>
  )
}
