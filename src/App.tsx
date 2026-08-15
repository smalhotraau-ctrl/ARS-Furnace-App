import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { RoleNav, type AppScreen } from './components/RoleNav'
import { BatchPlanPage } from './pages/BatchPlanPage'
import { BundlingPage } from './pages/BundlingPage'
import { CostingPage } from './pages/CostingPage'
import { DispatchPage } from './pages/DispatchPage'
import { HeatChargingPage } from './pages/HeatChargingPage'
import { LoginScreen } from './pages/LoginScreen'
import { MasterAdminPage } from './pages/MasterAdminPage'
import { OutputPage } from './pages/OutputPage'
import { PitFurnacePage } from './pages/PitFurnacePage'
import { SpectroPage } from './pages/SpectroPage'

function AppShell() {
  const { user, loading } = useAuth()
  const [activeScreen, setActiveScreen] = useState<AppScreen>('batch')

  if (loading) return null
  if (!user) return <LoginScreen />

  function renderScreen() {
    switch (activeScreen) {
      case 'batch':
        return <BatchPlanPage />
      case 'heat':
        return <HeatChargingPage />
      case 'spectro':
        return <SpectroPage />
      case 'output':
        return <OutputPage />
      case 'bundling':
        return <BundlingPage />
      case 'dispatch':
        return <DispatchPage />
      case 'pit':
        return <PitFurnacePage />
      case 'master_admin':
        return <MasterAdminPage />
      case 'costing':
        return <CostingPage />
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <RoleNav userId={user!.id} role={user!.role} activeScreen={activeScreen} onNavigate={setActiveScreen} />
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
