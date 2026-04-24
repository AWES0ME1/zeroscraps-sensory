/**
 * Azure OpenAI client for the sensory plugin.
 *
 * Used only by the AI enhancer. If not configured, AI features gracefully
 * degrade (no calls are made, functions return null).
 */

import { AzureOpenAI } from 'openai';
import { createLogger } from './logger';

const log = createLogger('openai');

interface Config {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
  timeoutMs: number;
}

let config: Config | null = null;
let client: AzureOpenAI | null = null;

export function configureOpenAI(cfg: Partial<Config>): void {
  const endpoint = cfg.endpoint || process.env.AZURE_OPENAI_ENDPOINT || '';
  const apiKey = cfg.apiKey || process.env.AZURE_OPENAI_API_KEY || '';
  if (!endpoint || !apiKey) {
    log.warn({}, 'Azure OpenAI not configured — AI features disabled');
    config = null;
    client = null;
    return;
  }

  config = {
    endpoint,
    apiKey,
    deployment: cfg.deployment || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1-mini',
    apiVersion: cfg.apiVersion || process.env.AZURE_OPENAI_API_VERSION || '2024-10-21',
    timeoutMs: cfg.timeoutMs ?? parseInt(process.env.AZURE_OPENAI_TIMEOUT_MS || '30000', 10),
  };

  client = new AzureOpenAI({
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    apiVersion: config.apiVersion,
    timeout: config.timeoutMs,
  });
  log.info({ deployment: config.deployment }, 'Azure OpenAI configured');
}

export function isOpenAIEnabled(): boolean {
  return client != null;
}

export interface JsonCallResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
}

// Simple circuit breaker
let consecutiveFailures = 0;
let circuitOpenUntil = 0;
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 60_000;

export async function generateJson(
  systemPrompt: string,
  userPrompt: string
): Promise<JsonCallResult | null> {
  if (!client || !config) return null;
  if (consecutiveFailures >= CIRCUIT_THRESHOLD && Date.now() < circuitOpenUntil) {
    log.debug({}, 'Circuit breaker open — skipping call');
    return null;
  }

  try {
    const response = await client.chat.completions.create({
      model: config.deployment,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    });

    consecutiveFailures = 0;
    const choice = response.choices[0];
    return {
      content: choice?.message?.content || '',
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
    };
  } catch (err) {
    consecutiveFailures++;
    if (consecutiveFailures >= CIRCUIT_THRESHOLD) {
      circuitOpenUntil = Date.now() + CIRCUIT_RESET_MS;
      log.warn({ failures: consecutiveFailures }, 'Circuit breaker OPEN');
    }
    log.error({ err }, 'OpenAI call failed');
    return null;
  }
}
