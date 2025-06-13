import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const healthStatus = {
    status: 'ok',
    environment: {
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_anon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabase_service: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    },
    timestamp: new Date().toISOString()
  }

  // Log the health check for debugging
  console.log('Health check:', healthStatus)

  return NextResponse.json(healthStatus)
}