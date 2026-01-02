import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'

// AI Provider configuration
// Supports switching between OpenAI and Anthropic

export type AIProvider = 'openai' | 'anthropic'

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export function getAIModel(provider?: AIProvider) {
  const selectedProvider = provider || (process.env.AI_PROVIDER as AIProvider) || 'openai'
  
  switch (selectedProvider) {
    case 'openai':
      // Using GPT-5 as the primary model
      return openai('gpt-5')
    case 'anthropic':
      return anthropic('claude-sonnet-4-20250514')
    default:
      return openai('gpt-5')
  }
}

// Get a cheaper model for simple tasks (ingredient parsing, etc.)
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
