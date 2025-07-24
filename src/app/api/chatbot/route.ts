import { NextRequest, NextResponse } from 'next/server';
const FLOWISE_API_KEY=process.env.FLOWISE_API_KEY;
export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();
    if (!question) {
      return NextResponse.json({ error: 'Missing question' }, { status: 400 });
    }
    const flowiseRes = await fetch(
      `https://cloud.flowiseai.com/api/v1/prediction/${FLOWISE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      }
    );
    if (!flowiseRes.ok) {
      return NextResponse.json({ error: 'Flowise API error' }, { status: 502 });
    }
    const data = await flowiseRes.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err }, { status: 500 });
  }
} 