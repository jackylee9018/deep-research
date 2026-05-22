import { NextResponse } from 'next/server';

import { listCompositions } from '@/ppt/composition/load-catalog';

export const runtime = 'nodejs';

export async function GET() {
  const compositions = listCompositions().map(c => ({
    id: c.id,
    layoutId: c.layoutId,
    label: c.label,
    description: c.description,
    whenToUse: c.whenToUse,
    fields: c.fields,
  }));

  return NextResponse.json({ compositions });
}
