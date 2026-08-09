import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RoleNav, type AppScreen } from './components/RoleNav'
import { BatchPlanPage } from './pages/BatchPlanPage'
import { PitFurnacePage } from './pages/PitFurnacePage'

function AppShell() {
  const { user } = useAuth()
  const [activeScreen, setActiveScreen] = useState<AppScreen>('batch')

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <RoleNav role={user!.role} activeScreen={activeScreen} onNavigate={setActiveScreen} />
      {activeScreen === 'batch' ? <BatchPlanPage /> : <PitFurnacePage />}
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
