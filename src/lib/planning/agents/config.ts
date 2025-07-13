// Agent configuration management
export const agentConfig = {
  // Feature flag
  useNewPlanningSystem: process.env.USE_NEW_PLANNING_SYSTEM === 'true',
  
  // Organizing Agent
  organizing: {
    model: process.env.ORGANIZING_AGENT_MODEL || 'claude-opus-4-20250514',
    maxTokens: parseInt(process.env.ORGANIZING_AGENT_MAX_TOKENS || '4000'),
    temperature: parseFloat(process.env.ORGANIZING_AGENT_TEMPERATURE || '0.2'),
  },
  
  // Selection Agent
  selection: {
    model: process.env.SELECTION_AGENT_MODEL || 'claude-opus-4-20250514',
    maxTokens: parseInt(process.env.SELECTION_AGENT_MAX_TOKENS || '4000'),
    temperature: parseFloat(process.env.SELECTION_AGENT_TEMPERATURE || '0.3'),
  },
  
  // Editing Agent
  editing: {
    model: process.env.EDITING_AGENT_MODEL || 'claude-3-7-sonnet-20241022',
    maxTokens: parseInt(process.env.EDITING_AGENT_MAX_TOKENS || '3000'),
    temperature: parseFloat(process.env.EDITING_AGENT_TEMPERATURE || '0.1'),
  },
  
  // Common settings
  common: {
    timeout: parseInt(process.env.AGENT_DEFAULT_TIMEOUT || '25000'),
    maxRetries: parseInt(process.env.AGENT_MAX_RETRIES || '3'),
  },
  
  // Subscription limits
  subscriptionLimits: {
    freeLifetimeMinutes: parseInt(process.env.AI_MINUTES_FREE_LIFETIME || '30'),
    basicMonthlyMinutes: parseInt(process.env.AI_MINUTES_BASIC_MONTHLY || '300'),
    proMonthlyMinutes: parseInt(process.env.AI_MINUTES_PRO_MONTHLY || '1000'),
  },
  
  // Legacy model (for backward compatibility)
  legacyModel: process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219',
}

// Model validation
export function validateModels(): void {
  const requiredModels = [
    { name: 'Organizing Agent', model: agentConfig.organizing.model },
    { name: 'Selection Agent', model: agentConfig.selection.model },
    { name: 'Editing Agent', model: agentConfig.editing.model },
  ]
  
  for (const { name, model } of requiredModels) {
    if (!model) {
      console.warn(`${name} model not configured. Using default.`)
    }
  }
  
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required but not configured')
  }
}

// Get configuration summary for logging
export function getConfigSummary(): string {
  return `
AI Planning System Configuration:
- Feature Enabled: ${agentConfig.useNewPlanningSystem}
- Organizing Agent: ${agentConfig.organizing.model}
- Selection Agent: ${agentConfig.selection.model}
- Editing Agent: ${agentConfig.editing.model}
- Timeout: ${agentConfig.common.timeout}ms
- Max Retries: ${agentConfig.common.maxRetries}
`
}