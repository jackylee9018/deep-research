import { processDataStream, type JSONValue } from 'ai';

import type { FollowUpEntry } from '@/research-query';

import type { PromptAttachment } from './prompt-attachments';
import type { ResearchModelId } from './research-models';

export type ResearchStreamCallbacks = {
  onText: (text: string) => void;
  onData: (data: JSONValue) => void;
  onError: (message: string) => void;
};

export async function runResearchStream(
  body: {
    query: string;
    breadth: number;
    depth: number;
    mode: 'report' | 'answer';
    model: ResearchModelId;
    followUp?: FollowUpEntry[];
    attachments?: PromptAttachment[];
  },
  callbacks: ResearchStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: body.query,
      breadth: body.breadth,
      depth: body.depth,
      mode: body.mode,
      model: body.model,
      followUp: body.followUp,
      attachments: body.attachments,
      messages: [{ role: 'user', content: body.query }],
    }),
    signal,
  });

  if (!response.ok) {
    let message = `Research failed (${response.status})`;
    try {
      const json = await response.json();
      message = json.message ?? json.error ?? message;
    } catch {
      // ignore
    }
    callbacks.onError(message);
    return;
  }

  if (!response.body) {
    callbacks.onError('Empty response body');
    return;
  }

  let assistantText = '';

  await processDataStream({
    stream: response.body,
    onTextPart: text => {
      assistantText += text;
      callbacks.onText(assistantText);
    },
    onDataPart: data => {
      callbacks.onData(data);
    },
    onErrorPart: error => {
      callbacks.onError(error);
    },
  });
}
