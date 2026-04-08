import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com/v1',
  maxRetries: 5,
  timeout: 60000,
});

export default client;
export const MODEL = 'claude-haiku-4-5';
