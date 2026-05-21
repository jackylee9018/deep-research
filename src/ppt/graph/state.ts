import { Annotation } from '@langchain/langgraph';

import type { PromptAttachment } from '@/prompt-attachments';

import type { DeckPlan, OutlineDeck, ValidationIssue } from '../schemas';

export type PptGraphState = {
  userPrompt: string;
  attachments?: PromptAttachment[];
  confirmedOutline: OutlineDeck;
  deckPlan?: DeckPlan;
  attempt: number;
  maxAttempts: number;
  issues: ValidationIssue[];
  filePath?: string;
  slideCount?: number;
  success: boolean;
  error?: string;
  outputPath?: string;
};

export const PptGraphAnnotation = Annotation.Root({
  userPrompt: Annotation<string>(),
  attachments: Annotation<PromptAttachment[] | undefined>(),
  confirmedOutline: Annotation<OutlineDeck>(),
  deckPlan: Annotation<DeckPlan | undefined>(),
  attempt: Annotation<number>(),
  maxAttempts: Annotation<number>(),
  issues: Annotation<ValidationIssue[]>(),
  filePath: Annotation<string | undefined>(),
  slideCount: Annotation<number | undefined>(),
  success: Annotation<boolean>(),
  error: Annotation<string | undefined>(),
  outputPath: Annotation<string | undefined>(),
});
