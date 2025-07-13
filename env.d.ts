/// <reference types="node" />

declare namespace NodeJS {
  interface ProcessEnv {
    // Supabase Configuration
    NEXT_PUBLIC_SUPABASE_URL: string
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string
    SUPABASE_SERVICE_ROLE_KEY: string

    // Anthropic API Configuration
    ANTHROPIC_API_KEY: string

    // Multi-Agent Planning System Configuration
    USE_NEW_PLANNING_SYSTEM?: string

    // Agent Model Configuration
    ORGANIZING_AGENT_MODEL?: string
    ORGANIZING_AGENT_MAX_TOKENS?: string
    ORGANIZING_AGENT_TEMPERATURE?: string

    SELECTION_AGENT_MODEL?: string
    SELECTION_AGENT_MAX_TOKENS?: string
    SELECTION_AGENT_TEMPERATURE?: string

    EDITING_AGENT_MODEL?: string
    EDITING_AGENT_MAX_TOKENS?: string
    EDITING_AGENT_TEMPERATURE?: string

    // Legacy Model Configuration
    ANTHROPIC_MODEL?: string

    // Agent Timeout Configuration
    AGENT_DEFAULT_TIMEOUT?: string
    AGENT_MAX_RETRIES?: string

    // Subscription Limits
    AI_MINUTES_FREE_LIFETIME?: string
    AI_MINUTES_BASIC_MONTHLY?: string
    AI_MINUTES_PRO_MONTHLY?: string

    // Node environment
    NODE_ENV: 'development' | 'production' | 'test'
  }
}

// Export empty object to make this a module
export {}