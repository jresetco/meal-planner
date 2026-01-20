import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'

// AI Provider configuration
// Primary: OpenAI GPT-5.2 with fallback to GPT-5.0
// Secondary: Anthropic Claude for backup

export type AIProvider = 'openai' | 'anthropic'

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Primary model for complex meal planning tasks
export function getAIModel(provider?: AIProvider) {
  const selectedProvider = provider || (process.env.AI_PROVIDER as AIProvider) || 'openai'
  
  switch (selectedProvider) {
    case 'openai':
      // GPT-5.2 is preferred, falls back to GPT-5.0 if not available
      // The SDK will handle model availability
      return openai('gpt-5.2')
    case 'anthropic':
      return anthropic('claude-sonnet-4-20250514')
    default:
      return openai('gpt-5.2')
  }
}

// Fallback model if primary fails
export function getFallbackModel(provider?: AIProvider) {
  const selectedProvider = provider || (process.env.AI_PROVIDER as AIProvider) || 'openai'
  
  switch (selectedProvider) {
    case 'openai':
      return openai('gpt-5')
    case 'anthropic':
      return anthropic('claude-sonnet-4-20250514')
    default:
      return openai('gpt-5')
  }
}

// Get a cheaper model for simple tasks (ingredient parsing, categorization)
export function getSimpleModel(provider?: AIProvider) {
  const selectedProvider = provider || (process.env.AI_PROVIDER as AIProvider) || 'openai'
  
  switch (selectedProvider) {
    case 'openai':
      return openai('gpt-4o-mini')
    case 'anthropic':
      return anthropic('claude-3-5-haiku-20241022')
    default:
      return openai('gpt-4o-mini')
  }
}

// Model configuration for streaming
export const STREAMING_CONFIG = {
  // Maximum tokens for meal plan generation
  maxTokens: 8000,
  // Temperature for creative but consistent outputs
  temperature: 0.7,
}
