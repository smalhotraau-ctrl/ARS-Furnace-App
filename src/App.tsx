import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { RoleNav, type AppScreen } from './components/RoleNav'
import { BatchPlanPage } from './pages/BatchPlanPage'
import { CycleLogPage } from './pages/CycleLogPage'
import { HeatChargingPage } from './pages/HeatChargingPage'
import { PitFurnacePage } from './pages/PitFurnacePage'
import { SpectroPage } from './pages/SpectroPage'

function AppShell() {
  const { user, loading } = useAuth()
  const [activeScreen, setActiveScreen] = useState<AppScreen>('batch')

  // Automatic background sign-in is in flight; no login screen is shown.
  if (loading || !user) return null

  function renderScreen() {
    switch (activeScreen) {
      case 'batch':
        return <BatchPlanPage />
      case 'heat':
        return <HeatChargingPage />
      case 'cycle':
        return <CycleLogPage />
      case 'spectro':
        return <SpectroPage />
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
    <LanguageProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </LanguageProvider>
  )
}

export default App
