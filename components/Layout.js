import Link from 'next/link'

export default function Layout({ children, title, backHref, backLabel }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-indigo-600 text-white shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {backHref && (
            <Link href={backHref} className="text-indigo-200 hover:text-white text-sm">
              &larr; {backLabel || 'Back'}
            </Link>
          )}
          <Link href="/" className="font-bold text-xl tracking-tight flex-1">
            Snap Hunt
          </Link>
          <Link href="/admin" className="text-indigo-200 hover:text-white text-xs">
            Admin
          </Link>
        </div>
      </header>

      {title && (
        <div className="bg-white border-b">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      <footer className="text-center text-xs text-gray-400 py-4">
        Snap Hunt
      </footer>
    </div>
  )
}
