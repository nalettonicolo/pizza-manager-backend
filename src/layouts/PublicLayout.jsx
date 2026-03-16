import { Outlet } from "react-router-dom"

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      
      {/* Header pubblico (puoi personalizzarlo dopo) */}
      <header className="bg-white shadow px-6 py-4">
        <h1 className="text-xl font-bold">PizzaManager</h1>
      </header>

      {/* Contenuto pagina */}
      <main className="flex-1 p-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t px-6 py-4 text-sm text-gray-500 text-center">
        © {new Date().getFullYear()} PizzaManager
      </footer>

    </div>
  )
}