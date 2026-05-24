import { z } from 'zod';

export const meetingUtteranceSchema = z.object({
  id: z.string(),
  speaker: z.string(),
  startSec: z.number(),
  endSec: z.number(),
  text: z.string(),
  textRaw: z.string().optional(),
});

export const meetingTranscriptSchema = z.object({
  meta: z.object({
    durationSec: z.number(),
    language: z.string(),
    model: z.string().optional(),
    device: z.string().optional(),
    segmentCount: z.number().optional(),
  }),
  speakers: z.array(z.string()),
  utterances: z.array(meetingUtteranceSchema),
});

export type MeetingUtterance = z.infer<typeof meetingUtteranceSchema>;
export type MeetingTranscript = z.infer<typeof meetingTranscriptSchema>;
