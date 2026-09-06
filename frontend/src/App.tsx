import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HeroPage from './pages/HeroPage'
import ExperimentPage from './pages/ExperimentPage'
import ResultsPage from './pages/ResultsPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HeroPage />} />
        <Route path="/experiment" element={<ExperimentPage />} />
        <Route path="/results/:participantId" element={<ResultsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
