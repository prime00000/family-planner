import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create a single supabase client for interacting with your database
export const createClientComponentClient = () => 
  createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })

// Create a server-side supabase client with service role key
export const createServerComponentClient = () => {
  if (!supabaseServiceKey) {
    throw new Error('Missing Supabase service role key')
  }
  
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// Export a singleton instance for client-side usage
export const supabase = createClientComponentClient()

// Helper types
export type SupabaseClient = ReturnType<typeof createClientComponentClient>
export type SupabaseServerClient = ReturnType<typeof createServerComponentClient> 