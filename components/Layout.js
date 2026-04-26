// Next.js's built-in link component — handles client-side navigation
// (faster than a regular <a> tag because it doesn't reload the whole page)
import Link from 'next/link'

// This is a shared wrapper used by every public page (home, hunt, vote, results).
// Props:
//   children   — the page content rendered inside the layout
//   title      — optional page title shown in a bar below the header
//   backHref   — optional URL for a back arrow in the header
//   backLabel  — label text for the back arrow
export default function Layout({ children, title, backHref, backLabel }) {
  return (
    // min-h-screen makes the page at least full-screen height.
    // flex flex-col lets the footer stick to the bottom.
    <div className="min-h-screen flex flex-col">

      {/* Top navigation bar */}
      <header className="bg-indigo-600 text-white shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Only show the back arrow if a backHref was passed in */}
          {backHref && (
            <Link href={backHref} className="text-indigo-200 hover:text-white text-sm">
              &larr; {backLabel || 'Back'}
            </Link>
          )}
          {/* flex-1 pushes the Admin link to the right */}
          <Link href="/" className="font-bold text-xl tracking-tight flex-1">
            Snap Hunt
          </Link>
          <Link href="/admin" className="text-indigo-200 hover:text-white text-xs">
            Admin
          </Link>
        </div>
      </header>

      {/* Optional page title bar — only rendered if a title was provided */}
      {title && (
        <div className="bg-white border-b">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          </div>
        </div>
      )}

      {/* flex-1 makes the main content area grow to fill available space,
          keeping the footer at the bottom even on short pages */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      <footer className="text-center text-xs text-gray-400 py-4">
        Snap Hunt
      </footer>
    </div>
  )
}
