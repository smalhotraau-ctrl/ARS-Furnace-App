import { AuthProvider, useAuth } from './context/AuthContext'
import { RoleNav } from './components/RoleNav'
import { LoginScreen } from './pages/LoginScreen'
import { PitFurnacePage } from './pages/PitFurnacePage'

function AppShell() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-300">
        <p>Loading… · लोड हो रहा है…</p>
      </main>
    )
  }

  if (!user) {
    return <LoginScreen />
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <RoleNav role={user.role} />
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
