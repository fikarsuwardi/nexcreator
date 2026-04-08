import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 5,
  timeout: 60000,
});

export default client;
export const MODEL = 'claude-sonnet-4-6';
