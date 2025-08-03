import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;


export async function POST(req: NextRequest) {
  try {
    const { chatId, userId, newTitle, accessToken } = await req.json();
    
    console.log('Rename chat request:', { chatId, userId, newTitle });

    if (!chatId || !userId || !newTitle?.trim()) {
      return NextResponse.json({ error: 'Missing chatId, userId, or newTitle' }, { status: 400 });
    }

    // Create Supabase client with user's access token for RLS
    const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    });

    // Update the chat title in Supabase
    const { error: updateError } = await supabaseWithAuth
      .from('chats')
      .update({ 
        title: newTitle.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', chatId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating chat title:', updateError);
      return NextResponse.json({ error: 'Failed to rename chat' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Rename chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 