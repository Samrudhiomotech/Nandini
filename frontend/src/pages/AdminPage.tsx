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

const PIE_COLORS = ['#A5672C', '#2B6459', '#3C7A49', '#8A6D3B', '#AF3A2C']

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
        <div className="w-12 h-12 border-2 border-hair-strong border-t-brass rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-bad text-base">{error}</p>
          <button onClick={load} className="text-ink-50 text-sm underline">Retry</button>
        </div>
      </div>
    )
  }

  const distData = Object.entries(data.iocs_distribution).map(([k, v]) => ({
    name: `N=${k}`,
    count: v,
  }))

  const statsCards = [
    { label: 'Participants', value: data.total_participants, icon: Users, color: 'text-brass' },
    { label: 'Avg IOCS', value: data.avg_predicted_iocs?.toFixed(1) ?? '—', icon: Brain, color: 'text-teal' },
    { label: 'Total trials', value: data.total_trials, icon: Target, color: 'text-good' },
    { label: 'Avg accuracy', value: `${(data.avg_calibration_accuracy * 100).toFixed(1)}%`, icon: CheckCircle2, color: 'text-brass' },
  ]

  return (
    <div className="min-h-screen gradient-bg text-ink">
      {/* Header */}
      <div className="border-b border-hair px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-ink-40">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <Brain size={20} className="text-teal" />
            <span className="font-body text-base text-ink-70">ACA Platform — Admin dashboard</span>
          </div>
        </div>
        <button
          onClick={load}
          className="liquid-glass flex items-center gap-2 rounded-full px-4 py-2 text-sm text-ink-60 transition-all"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statsCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card-glass p-5 rounded-2xl">
              <Icon size={22} className={`${color} mb-3`} />
              <div className="text-2xl font-heading text-ink mb-1">{value}</div>
              <div className="text-sm text-ink-50 font-body">{label}</div>
            </div>
          ))}
        </div>

        {/* IOCS Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-glass p-6 rounded-2xl">
            <h2 className="text-base font-body font-medium text-ink-80 mb-6">
              IOCS distribution
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(34,31,26,0.08)" />
                <XAxis dataKey="name" stroke="rgba(34,31,26,0.25)" tick={{ fill: 'rgba(34,31,26,0.55)', fontSize: 12 }} />
                <YAxis stroke="rgba(34,31,26,0.25)" tick={{ fill: 'rgba(34,31,26,0.55)', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#FAF7EF', border: '1px solid #DAD0B8', borderRadius: 12, fontSize: 13 }}
                  itemStyle={{ color: '#A5672C' }}
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
            <h2 className="text-base font-body font-medium text-ink-80 mb-6">
              IOCS share
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
                    contentStyle={{ background: '#FAF7EF', border: '1px solid #DAD0B8', borderRadius: 12, fontSize: 13 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-ink-30 text-base">
                No participant data yet. Run the experiment first.
              </div>
            )}
          </div>
        </div>

        {/* Research note */}
        <div className="card-glass p-6 rounded-2xl border-teal">
          <h2 className="text-base font-body font-medium text-ink-80 mb-3">
            Research methodology
          </h2>
          <div className="space-y-3 text-base text-ink-50 leading-relaxed">
            <p>
              <strong className="text-ink-70">Decision Efficiency Index (DEI)</strong> = 0.35·accuracy − 0.20·norm(RT) + 0.15·norm(confidence) − 0.15·norm(difficulty) − 0.10·norm(regret) − 0.05·norm(changes)
            </p>
            <p>
              <strong className="text-ink-70">IOCS prediction</strong>: A Gaussian f(x) = a·exp(−(x−μ)²/2σ²) + b is fit to DEI vs set-size. μ is the Individual Optimal Choice-Set Size. R² measures prediction confidence.
            </p>
            <p>
              <strong className="text-ink-70">Validation</strong>: Participants complete trials at IOCS−3, IOCS, and IOCS+3. Improvement% = (DEI_optimal − mean(DEI_others)) / |mean(DEI_others)| × 100.
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <Link
            to="/experiment"
            className="btn-primary font-body font-semibold text-base rounded-full px-8 py-3.5 transition-all"
          >
            + Add new participant
          </Link>
        </div>
      </div>
    </div>
  )
}
