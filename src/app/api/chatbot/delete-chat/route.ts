import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create Supabase client with anon key (will use RLS policies)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: NextRequest) {
  try {
    const { chatId, userId, accessToken } = await req.json();
    
    console.log('Delete chat request:', { chatId, userId });

    if (!chatId || !userId) {
      return NextResponse.json({ error: 'Missing chatId or userId' }, { status: 400 });
    }

    // Create Supabase client with user's access token for RLS
    const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    });

    // First, check if the chat exists and get the thread ID
    console.log('Fetching chat from Supabase...');
    
    // Let's also check what chats exist for this user
    const { data: allUserChats, error: listError } = await supabaseWithAuth
      .from('chats')
      .select('id, title')
      .eq('user_id', userId);
    
    if (listError) {
      console.error('Error listing user chats:', listError);
    } else {
      console.log('All chats for user:', allUserChats);
    }
    
    const { data: chatData, error: fetchError } = await supabaseWithAuth
      .from('chats')
      .select('thread_id')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching chat:', fetchError);
      // If the chat doesn't exist, we should still return success to clean up the frontend
      if (fetchError.code === 'PGRST116') {
        console.log('Chat not found in database, but proceeding with cleanup');
        return NextResponse.json({ success: true, message: 'Chat not found in database' });
      }
      return NextResponse.json({ error: 'Chat not found', details: fetchError.message }, { status: 404 });
    }
    
    console.log('Found chat data:', chatData);

    // Delete the OpenAI thread if it exists
    if (chatData.thread_id && OPENAI_API_KEY) {
      try {
        const threadResponse = await fetch(`https://api.openai.com/v1/threads/${chatData.thread_id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });

        if (!threadResponse.ok) {
          console.error('Error deleting OpenAI thread:', threadResponse.status);
          // Continue with Supabase deletion even if OpenAI deletion fails
        }
      } catch (error) {
        console.error('Error deleting OpenAI thread:', error);
        // Continue with Supabase deletion even if OpenAI deletion fails
      }
    }

    // Delete the chat from Supabase
    console.log('Deleting chat from Supabase...');
    const { error: deleteError } = await supabaseWithAuth
      .from('chats')
      .delete()
      .eq('id', chatId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting chat from Supabase:', deleteError);
      return NextResponse.json({ error: 'Failed to delete chat', details: deleteError.message }, { status: 500 });
    }

    console.log('Chat deleted successfully');
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 