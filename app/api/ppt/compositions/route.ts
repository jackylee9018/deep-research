import { NextResponse } from 'next/server';

import {
  findComposition,
  listCompositions,
} from '@/ppt/composition/load-catalog';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id')?.trim();

  if (id) {
    const entry = findComposition(id);
    if (!entry) {
      return NextResponse.json(
        { error: `Unknown composition: ${id}` },
        { status: 404 },
      );
    }
    return NextResponse.json({
      composition: {
        id: entry.id,
        layoutId: entry.layoutId,
        label: entry.label,
        description: entry.description,
        whenToUse: entry.whenToUse,
        fields: entry.fields,
        boxes: entry.boxes,
      },
    });
  }

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
