import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const { threadId } = await req.json();
    
    if (!threadId) {
      return NextResponse.json({ error: 'Missing threadId' }, { status: 400 });
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI configuration missing' }, { status: 500 });
    }

    // Get messages from the thread
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (!messagesResponse.ok) {
      throw new Error('Failed to retrieve messages from thread');
    }

    const messagesData = await messagesResponse.json();
    
    // Convert OpenAI messages to our format
    const messages = messagesData.data.map((msg: { role: string; content: Array<{ text?: { value: string } }>; id: string }) => ({
      sender: msg.role === 'user' ? 'user' : 'bot',
      text: msg.content[0]?.text?.value || '',
      id: msg.id
    }));

    // Reverse the messages to show them in chronological order (oldest first)
    const reversedMessages = messages.reverse();

    return NextResponse.json({ messages: reversedMessages });

  } catch (err) {
    console.error('Error loading messages from thread:', err);
    return NextResponse.json({ 
      error: 'Failed to load messages',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
} 