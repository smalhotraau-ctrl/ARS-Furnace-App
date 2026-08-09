import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RoleNav, type AppScreen } from './components/RoleNav'
import { BatchPlanPage } from './pages/BatchPlanPage'
import { CycleLogPage } from './pages/CycleLogPage'
import { HeatChargingPage } from './pages/HeatChargingPage'
import { PitFurnacePage } from './pages/PitFurnacePage'

function AppShell() {
  const { user } = useAuth()
  const [activeScreen, setActiveScreen] = useState<AppScreen>('batch')

  function renderScreen() {
    switch (activeScreen) {
      case 'batch':
        return <BatchPlanPage />
      case 'heat':
        return <HeatChargingPage />
      case 'cycle':
        return <CycleLogPage />
      case 'pit':
        return <PitFurnacePage />
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <RoleNav role={user!.role} activeScreen={activeScreen} onNavigate={setActiveScreen} />
      {renderScreen()}
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
