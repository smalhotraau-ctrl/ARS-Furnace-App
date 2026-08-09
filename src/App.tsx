import { AuthProvider, useAuth } from './context/AuthContext'
import { RoleNav } from './components/RoleNav'
import { PitFurnacePage } from './pages/PitFurnacePage'

function AppShell() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <RoleNav role={user!.role} />
      <PitFurnacePage />
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
