// React hooks — useState stores data, useEffect runs code when the page loads
import { useEffect, useState } from 'react'
// Next.js link component for client-side navigation
import Link from 'next/link'
// Our shared page wrapper (header, footer, max-width container)
import Layout from '../components/Layout'
// Our Supabase client for database queries
import { supabase } from '../lib/supabase'

// In Next.js, every file in the /pages folder becomes a route.
// This file is pages/index.js, so it maps to the root URL: /
export default function Home() {
  // useState holds the list of hunts — starts as an empty array
  const [hunts, setHunts] = useState([])
  // loading tracks whether we're still fetching from the database
  const [loading, setLoading] = useState(true)

  // useEffect runs after the component first renders.
  // The empty [] at the end means "only run this once on page load".
  useEffect(() => {
    async function load() {
      // Query the 'hunts' table in Supabase.
      // select('*, items(count)') fetches all hunt columns plus
      // a count of related items (the * means all columns).
      // .eq('is_active', true) filters to only active hunts.
      // .order sorts newest first.
      const { data } = await supabase
        .from('hunts')
        .select('*, items(count)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      // data || [] means "use data, but fall back to empty array if it's null"
      setHunts(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <Layout>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-indigo-600 mb-2">Snap Hunt</h1>
        <p className="text-gray-500 text-lg">Find it. Snap it. Share it.</p>
      </div>

      {/* Show a loading message while the database query is in progress */}
      {loading && (
        <div className="text-center text-gray-400 py-12">Loading hunts...</div>
      )}

      {/* Show an empty state message once loaded if no hunts exist */}
      {!loading && hunts.length === 0 && (
        <div className="text-center text-gray-400 py-12">
          <p className="text-lg">No active hunts right now.</p>
          <p className="text-sm mt-1">Check back soon or ask an admin to create one.</p>
        </div>
      )}

      <div className="space-y-4">
        {/* .map() loops over each hunt and renders a card for it.
            key={hunt.id} is required by React to track list items efficiently. */}
        {hunts.map(hunt => (
          // The whole card is wrapped in a Link so tapping anywhere navigates to the hunt page.
          // The hunt ID is passed as a query parameter: /hunt?id=...
          <Link
            key={hunt.id}
            href={`/hunt?id=${hunt.id}`}
            className="block bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all overflow-hidden"
          >
            {/* Only render the banner image if the hunt has an icon */}
            {hunt.icon_url && (
              <img src={hunt.icon_url} alt={hunt.name} className="w-full h-36 object-cover" />
            )}
            <div className="p-5 flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900">{hunt.name}</h2>
                {/* Only render the description paragraph if one exists */}
                {hunt.description && (
                  <p className="text-gray-500 text-sm mt-1">{hunt.description}</p>
                )}
                {/* hunt.items?.[0]?.count is "optional chaining" —
                    safely reads a nested value without crashing if any part is null.
                    ?? 0 is a fallback: use 0 if the value is null/undefined. */}
                <p className="text-indigo-500 text-sm font-medium mt-2">
                  {hunt.items?.[0]?.count ?? 0} items to find
                </p>
              </div>
              <span className="ml-4 bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg flex-shrink-0">
                Join
              </span>
            </div>
          </Link>
        ))}
      </div>
    </Layout>
  )
}
