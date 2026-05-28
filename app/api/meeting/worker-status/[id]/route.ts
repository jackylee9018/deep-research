import { getWhisperxJobStatus } from '@/meeting/whisperx-client';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: 'Invalid worker job id' }, { status: 400 });
  }

  try {
    const status = await getWhisperxJobStatus(id);
    return Response.json(status);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch worker status';
    return Response.json({ error: message }, { status: 502 });
  }
}
