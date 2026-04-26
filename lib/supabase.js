// createClient is the Supabase function that creates a connection to your database
import { createClient } from '@supabase/supabase-js'

// NEXT_PUBLIC_ prefix means these env variables are safe to expose in the browser.
// They are read from your .env.local file during development,
// and from GitHub Actions secrets during deployment.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,      // keeps the user logged in across page refreshes
      autoRefreshToken: true,    // automatically renews the session before it expires
      storageKey: 'snap-hunt-auth', // the key used to store the session in localStorage
    },
  }
)

// Voting requires a user identity so Supabase can enforce the "one vote per person" rule.
// We use anonymous sign-in so users don't need to create an account —
// Supabase still gives them a unique ID that persists in their browser.
export async function ensureAnonSession() {
  const { data: { session } } = await supabase.auth.getSession()
  // If there's no active session, sign in anonymously
  if (!session) {
    await supabase.auth.signInAnonymously()
  }
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
