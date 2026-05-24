import { z } from 'zod';

export const meetingActionItemSchema = z.object({
  owner: z
    .string()
    .describe('僅能使用逐字稿中的 SPEAKER 標籤，如 SPEAKER_00'),
  task: z.string(),
  deadline: z.string().optional(),
});

export const meetingSpeakerHighlightSchema = z.object({
  speaker: z
    .string()
    .describe('僅能使用逐字稿中的 SPEAKER 標籤，如 SPEAKER_00'),
  points: z.array(z.string()),
});

export const meetingMinutesSchema = z.object({
  title: z.string(),
  summary: z.string(),
  participants: z
    .array(z.string())
    .describe('僅列出逐字稿中出現的 SPEAKER 標籤，不可使用真實姓名'),
  agenda: z.array(z.string()),
  keyDecisions: z.array(z.string()),
  actionItems: z.array(meetingActionItemSchema),
  openQuestions: z.array(z.string()),
  speakerHighlights: z.array(meetingSpeakerHighlightSchema),
});

export const partialMeetingMinutesSchema = z.object({
  title: z.string().optional(),
  summary: z.string().optional(),
  participants: z.array(z.string()).optional(),
  agenda: z.array(z.string()).optional(),
  keyDecisions: z.array(z.string()).optional(),
  actionItems: z.array(meetingActionItemSchema).optional(),
  openQuestions: z.array(z.string()).optional(),
  speakerHighlights: z.array(meetingSpeakerHighlightSchema).optional(),
});

export type MeetingMinutes = z.infer<typeof meetingMinutesSchema>;
export type PartialMeetingMinutes = z.infer<typeof partialMeetingMinutesSchema>;
