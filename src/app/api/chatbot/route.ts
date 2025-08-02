import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID; // Your assistant ID from OpenAI dashboard

// Web search function using DuckDuckGo properly
async function performWebSearch(query: string) {
  try {
    console.log('Searching for:', query);
    
    // Use DuckDuckGo's web search API (not just instant answers)
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&t=your-app-name`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    // Check for abstract (instant answer)
    if (data.Abstract && data.Abstract.length > 20) {
      return {
        source: data.AbstractSource || 'DuckDuckGo',
        content: data.Abstract,
        url: data.AbstractURL || ''
      };
    }
    
    // Check for related topics
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      const topic = data.RelatedTopics[0];
      return {
        source: 'DuckDuckGo',
        content: topic.Text || topic.FirstURL || 'Information found but no details available.',
        url: topic.FirstURL || ''
      };
    }
    
    // Check for answer (for specific questions)
    if (data.Answer && data.Answer.length > 10) {
      return {
        source: 'DuckDuckGo',
        content: data.Answer,
        url: data.AnswerType || ''
      };
    }
    
    // If we have any data, return it with a search link
    if (data.Heading || data.Definition) {
      return {
        source: 'DuckDuckGo',
        content: data.Definition || data.Heading || `Found information about ${query}`,
        url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
      };
    }
    
    // Fallback with search link
    return {
      source: 'DuckDuckGo',
      content: `I searched for "${query}" and found some information, but for the most current and detailed results, you can search directly on DuckDuckGo.`,
      url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
    };
    
  } catch (error) {
    console.error('Web search error:', error);
    return {
      source: 'DuckDuckGo',
      content: `I encountered an error while searching for "${query}". You can search for this directly on DuckDuckGo for the most current information.`,
      url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { question, threadId } = await req.json();
    
    if (!question?.trim()) {
      return NextResponse.json({ error: 'Missing question' }, { status: 400 });
    }

    if (!OPENAI_API_KEY || !ASSISTANT_ID) {
      return NextResponse.json({ error: 'OpenAI configuration missing' }, { status: 500 });
    }

    // Rate limiting (basic)
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    console.log(`Request from IP: ${clientIP}`);

    let currentThreadId = threadId;

    // Create a new thread if none exists
    if (!currentThreadId) {
      const threadResponse = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      if (!threadResponse.ok) {
        const errorBody = await threadResponse.text();
        console.error('Thread creation failed:', {
          status: threadResponse.status,
          statusText: threadResponse.statusText,
          body: errorBody
        });
        throw new Error('Failed to create thread');
      }

      const threadData = await threadResponse.json();
      currentThreadId = threadData.id;
    }

    // Add the user's message to the thread
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        role: 'user',
        content: question
      })
    });

    if (!messageResponse.ok) {
      throw new Error('Failed to add message to thread');
    }

    // Run the assistant
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        assistant_id: ASSISTANT_ID
      })
    });

    if (!runResponse.ok) {
      throw new Error('Failed to start assistant run');
    }

    const runData = await runResponse.json();
    const runId = runData.id;

    // Poll for completion and handle function calls
    let runStatus = 'queued';
    while (runStatus === 'queued' || runStatus === 'in_progress') {
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 0.5 seconds
      
      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs/${runId}`, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      if (!statusResponse.ok) {
        throw new Error('Failed to check run status');
      }

      const statusData = await statusResponse.json();
      runStatus = statusData.status;

      // Handle function calls if the run requires action
      if (runStatus === 'requires_action' && statusData.required_action?.type === 'submit_tool_outputs') {
        const toolCalls = statusData.required_action.submit_tool_outputs.tool_calls;
        const toolOutputs = [];

        for (const toolCall of toolCalls) {
          if (toolCall.function.name === 'web_search') {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const searchQuery = args.query;
              
              console.log('Performing web search for:', searchQuery);
              const searchResult = await performWebSearch(searchQuery);
              
              toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify(searchResult)
              });
            } catch (error) {
              console.error('Error in web search function:', error);
              toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify({
                  source: 'Web Search',
                  content: 'Sorry, I encountered an error while searching the web.',
                  url: ''
                })
              });
            }
          }
        }

        // Submit tool outputs
        const submitResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs/${runId}/submit_tool_outputs`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2'
          },
          body: JSON.stringify({
            tool_outputs: toolOutputs
          })
        });

        if (!submitResponse.ok) {
          throw new Error('Failed to submit tool outputs');
        }

        // Continue polling
        runStatus = 'queued';
      }

      if (runStatus === 'failed') {
        throw new Error('Assistant run failed');
      }
    }

    // Get the assistant's response
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/messages`, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (!messagesResponse.ok) {
      throw new Error('Failed to retrieve messages');
    }

    const messagesData = await messagesResponse.json();
    const assistantMessage = messagesData.data.find((msg: { role: string }) => msg.role === 'assistant');

    if (!assistantMessage) {
      throw new Error('No assistant response found');
    }

    return NextResponse.json({
      text: assistantMessage.content[0]?.text?.value || 'No response from assistant',
      threadId: currentThreadId
    }, {
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      }
    });

  } catch (err) {
    console.error('OpenAI Assistant API error:', err);
    return NextResponse.json({ 
      error: 'Assistant API error', 
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      }
    });
  }
}