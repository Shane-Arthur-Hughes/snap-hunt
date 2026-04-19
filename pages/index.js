import { useEffect, useState } from 'react'
import Link from 'next/link'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [hunts, setHunts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('hunts')
        .select('*, items(count)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
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

      {loading && (
        <div className="text-center text-gray-400 py-12">Loading hunts...</div>
      )}

      {!loading && hunts.length === 0 && (
        <div className="text-center text-gray-400 py-12">
          <p className="text-lg">No active hunts right now.</p>
          <p className="text-sm mt-1">Check back soon or ask an admin to create one.</p>
        </div>
      )}

      <div className="space-y-4">
        {hunts.map(hunt => (
          <Link
            key={hunt.id}
            href={`/hunt?id=${hunt.id}`}
            className="block bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-indigo-200 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900">{hunt.name}</h2>
                {hunt.description && (
                  <p className="text-gray-500 text-sm mt-1">{hunt.description}</p>
                )}
                <p className="text-indigo-500 text-sm font-medium mt-2">
                  {hunt.items?.[0]?.count ?? 0} items to find
                </p>
              </div>
              <span className="ml-4 bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                Join
              </span>
            </div>
          </Link>
        ))}
      </div>
    </Layout>
  )
}
