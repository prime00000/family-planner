import Anthropic from '@anthropic-ai/sdk'

export interface AgentConfig {
  model: string
  maxTokens?: number
  temperature?: number
  timeout?: number // milliseconds
  maxRetries?: number
}

export interface AgentContext {
  sessionId: string
  teamId: string
  userId: string
}

export abstract class BaseAgent {
  protected anthropic: Anthropic
  protected config: AgentConfig
  
  constructor(config: AgentConfig) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    })
    
    this.config = {
      maxTokens: 4000,
      temperature: 0.2,
      timeout: 25000, // 25 seconds default
      maxRetries: 3,
      ...config
    }
  }
  
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      return await this.withTimeout(operation(), this.config.timeout!)
    } catch (error) {
      if (retryCount < this.config.maxRetries!) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000) // Exponential backoff, max 10s
        console.log(`Retry ${retryCount + 1}/${this.config.maxRetries} after ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.executeWithRetry(operation, retryCount + 1)
      }
      throw error
    }
  }
  
  protected async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    })
    
    return Promise.race([promise, timeoutPromise])
  }
  
  protected async callAnthropic(messages: any[]): Promise<any> {
    return this.executeWithRetry(async () => {
      return await this.anthropic.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens!,
        temperature: this.config.temperature!,
        messages
      })
    })
  }
  
  protected extractJSON<T>(response: string): T {
    // Remove markdown code blocks
    const cleaned = response
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim()
    
    // Try to extract JSON object
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    
    // Also check for JSON array
    const firstBracket = cleaned.indexOf('[')
    const lastBracket = cleaned.lastIndexOf(']')
    
    let jsonStr: string
    
    if (firstBrace !== -1 && lastBrace !== -1 && 
        (firstBracket === -1 || firstBrace < firstBracket)) {
      // Object found
      jsonStr = cleaned.substring(firstBrace, lastBrace + 1)
    } else if (firstBracket !== -1 && lastBracket !== -1) {
      // Array found
      jsonStr = cleaned.substring(firstBracket, lastBracket + 1)
    } else {
      console.error('No JSON found in response:', cleaned.substring(0, 500))
      throw new Error('No JSON object found in response')
    }
    
    try {
      return JSON.parse(jsonStr)
    } catch (error) {
      console.error('Failed to parse JSON, length:', jsonStr.length)
      console.error('First 500 chars:', jsonStr.substring(0, 500))
      console.error('Last 500 chars:', jsonStr.substring(Math.max(0, jsonStr.length - 500)))
      console.error('Parse error:', error)
      
      // Try to find common JSON issues
      const unclosedQuote = jsonStr.match(/[^\\]"[^"]*$/);
      if (unclosedQuote) {
        console.error('Possible unclosed quote near end of JSON');
      }
      
      // Check if JSON might be truncated
      const openBraces = (jsonStr.match(/{/g) || []).length;
      const closeBraces = (jsonStr.match(/}/g) || []).length;
      const openBrackets = (jsonStr.match(/\[/g) || []).length;
      const closeBrackets = (jsonStr.match(/]/g) || []).length;
      
      console.error('JSON structure analysis:');
      console.error(`  Open braces: ${openBraces}, Close braces: ${closeBraces}`);
      console.error(`  Open brackets: ${openBrackets}, Close brackets: ${closeBrackets}`);
      
      if (openBraces > closeBraces || openBrackets > closeBrackets) {
        console.error('JSON appears to be truncated (unmatched braces/brackets)');
      }
      
      throw new Error('Invalid JSON in AI response')
    }
  }
  
  protected handleError(error: unknown, operation: string): never {
    if (error instanceof Error) {
      console.error(`${operation} failed:`, error.message)
      if (error.message.includes('timeout')) {
        throw new Error(`${operation} timed out. Please try again.`)
      }
      if (error.message.includes('API')) {
        throw new Error(`AI service error during ${operation}. Please try again.`)
      }
      throw error
    }
    throw new Error(`Unknown error during ${operation}`)
  }
  
  abstract execute(input: any, context: AgentContext): Promise<any>
}