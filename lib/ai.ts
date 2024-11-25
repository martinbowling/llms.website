'use client';

import { Groq } from 'groq-sdk';
import type { UrlSummary } from './types';

function extractSummary(text: string): string {
  const match = text.match(/<summary>([\s\S]*?)<\/summary>/);
  return match ? match[1].trim() : text.trim();
}

export async function generateHyperbolicSummary(url: string, content: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.hyperbolic.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
      messages: [
        {
          role: 'user',
          content: `Generate a concise 1-sentence summary of this webpage content. Wrap your summary in <summary> tags.

URL: ${url}
Content: ${content}

Example response format:
<summary>This is a clear and concise one-sentence summary of the webpage.</summary>`
        }
      ],
      max_tokens: 200,
      temperature: 0.7,
      top_p: 0.9,
      stream: false
    }),
  });

  const json = await response.json();
  return extractSummary(json.choices[0].message.content);
}

export async function generateGroqSummary(url: string, content: string, apiKey: string): Promise<string> {
  const groq = new Groq({ apiKey });
  
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'user',
        content: `Generate a concise 1-sentence summary of this webpage content. Wrap your summary in <summary> tags.

URL: ${url}
Content: ${content}

Example response format:
<summary>This is a clear and concise one-sentence summary of the webpage.</summary>`
      }
    ],
    model: "llama-3.2-1b-preview",
    temperature: 0.7,
    max_tokens: 200,
    top_p: 0.9,
    stream: false
  });

  return extractSummary(completion.choices[0]?.message?.content || '');
}

export function generateLLMsFullTxt(summaries: UrlSummary[]): string {
  if (!summaries.length) return '';
  
  return summaries.map(summary => {
    return `# ${summary.url}\n\n${summary.fullContent}\n\n---\n`;
  }).join('\n');
}