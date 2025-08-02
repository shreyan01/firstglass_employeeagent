import { NextRequest } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

// Web search function using DuckDuckGo properly
async function performWebSearch(query: string) {
  try {
    console.log('Searching for:', query);
    
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&t=your-app-name`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (data.Abstract && data.Abstract.length > 20) {
      return {
        source: data.AbstractSource || 'DuckDuckGo',
        content: data.Abstract,
        url: data.AbstractURL || ''
      };
    }
    
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      const topic = data.RelatedTopics[0];
      return {
        source: 'DuckDuckGo',
        content: topic.Text || topic.FirstURL || 'Information found but no details available.',
        url: topic.FirstURL || ''
      };
    }
    
    if (data.Answer && data.Answer.length > 10) {
      return {
        source: 'DuckDuckGo',
        content: data.Answer,
        url: data.AnswerType || ''
      };
    }
    
    if (data.Heading || data.Definition) {
      return {
        source: 'DuckDuckGo',
        content: data.Definition || data.Heading || `Found information about ${query}`,
        url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
      };
    }
    
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
  const encoder = new TextEncoder();
  
  try {
    const { question, threadId } = await req.json();
    
    if (!question?.trim()) {
      return new Response('Missing question', { status: 400 });
    }

    if (!OPENAI_API_KEY || !ASSISTANT_ID) {
      return new Response('OpenAI configuration missing', { status: 500 });
    }

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
        const errorText = await threadResponse.text();
        console.error('Thread creation error:', threadResponse.status, errorText);
        throw new Error(`Failed to create thread: ${threadResponse.status} - ${errorText}`);
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
      const errorText = await messageResponse.text();
      console.error('Message creation error:', messageResponse.status, errorText);
      throw new Error(`Failed to add message to thread: ${messageResponse.status} - ${errorText}`);
    }

    // Create a ReadableStream for streaming the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial data
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', threadId: currentThreadId })}\n\n`));
          
          // Start the run with streaming enabled
          const runResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
              'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
              assistant_id: ASSISTANT_ID,
              stream: true
            })
          });

          if (!runResponse.ok) {
            const errorText = await runResponse.text();
            console.error('Run creation error:', runResponse.status, errorText);
            throw new Error(`Failed to start assistant run: ${runResponse.status} - ${errorText}`);
          }

          const reader = runResponse.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error('No response body');
          }

          let buffer = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) break;
              
              const chunk = decoder.decode(value);
              buffer += chunk;
              
              // Process complete lines from the buffer
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer
              
              for (const line of lines) {
                const trimmedLine = line.trim();
                
                // Skip empty lines
                if (!trimmedLine) continue;
                
                // Handle [DONE] marker
                if (trimmedLine === 'data: [DONE]') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
                  return;
                }
                
                // Process data lines
                if (trimmedLine.startsWith('data: ')) {
                  const dataContent = trimmedLine.slice(6);
                  
                  // Skip if it's just [DONE] or empty
                  if (dataContent === '[DONE]' || !dataContent.trim()) {
                    continue;
                  }
                  
                  try {
                    const data = JSON.parse(dataContent);
                    console.log('Received event:', data.object, data);
                    
                    // Handle different event types based on object type
                    switch (data.object) {
                      case 'thread.run':
                        if (data.status === 'created') {
                          console.log('Run created:', data.id);
                        } else if (data.status === 'queued' || data.status === 'in_progress') {
                          // Run is processing
                        } else if (data.status === 'requires_action') {
                          // Handle tool calls
                          const toolCalls = data.required_action?.submit_tool_outputs?.tool_calls || [];
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

                          // Submit tool outputs with streaming
                          const submitResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs/${data.id}/submit_tool_outputs`, {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${OPENAI_API_KEY}`,
                              'Content-Type': 'application/json',
                              'OpenAI-Beta': 'assistants=v2'
                            },
                            body: JSON.stringify({
                              tool_outputs: toolOutputs,
                              stream: true
                            })
                          });

                          if (!submitResponse.ok) {
                            const errorText = await submitResponse.text();
                            throw new Error(`Failed to submit tool outputs: ${submitResponse.status} - ${errorText}`);
                          }

                          // Continue streaming from the submit response
                          const submitReader = submitResponse.body?.getReader();
                          if (submitReader) {
                            let submitBuffer = '';
                            
                            while (true) {
                              const { done: submitDone, value: submitValue } = await submitReader.read();
                              if (submitDone) break;
                              
                              const submitChunk = decoder.decode(submitValue);
                              submitBuffer += submitChunk;
                              
                              const submitLines = submitBuffer.split('\n');
                              submitBuffer = submitLines.pop() || '';
                              
                              for (const submitLine of submitLines) {
                                const trimmedSubmitLine = submitLine.trim();
                                
                                if (!trimmedSubmitLine) continue;
                                
                                if (trimmedSubmitLine === 'data: [DONE]') {
                                  break;
                                }
                                
                                if (trimmedSubmitLine.startsWith('data: ')) {
                                  const submitDataContent = trimmedSubmitLine.slice(6);
                                  
                                  if (submitDataContent === '[DONE]' || !submitDataContent.trim()) {
                                    continue;
                                  }
                                  
                                  try {
                                    const submitData = JSON.parse(submitDataContent);
                                    if (submitData.object === 'thread.message.delta') {
                                      const content = submitData.delta.content?.[0]?.text?.value || '';
                                      if (content) {
                                        // Send each character individually for real-time streaming
                                        for (const char of content) {
                                          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'message', text: char })}\n\n`));
                                          // Small delay to prevent overwhelming the client
                                          await new Promise(resolve => setTimeout(resolve, 10));
                                        }
                                      }
                                    }
                                  } catch (e) {
                                    // Ignore parsing errors for submit data
                                    console.log("Error:",e)
                                  }
                                }
                              }
                            }
                            submitReader.releaseLock();
                          }
                        } else if (data.status === 'completed') {
                          // Run completed
                          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
                          return;
                        } else if (data.status === 'failed') {
                          throw new Error('Assistant run failed');
                        }
                        break;
                        
                      case 'thread.message.delta':
                        // Stream message content character by character
                        const content = data.delta.content?.[0]?.text?.value || '';
                        if (content) {
                          // Send each character individually for real-time streaming
                          for (const char of content) {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'message', text: char })}\n\n`));
                            // Small delay to prevent overwhelming the client
                            await new Promise(resolve => setTimeout(resolve, 10));
                          }
                        }
                        break;
                        
                      case 'thread.message':
                        // Message completed
                        break;
                        
                      case 'thread.run.step':
                        // Step completed
                        break;
                        
                      default:
                        // Handle unknown events gracefully
                        console.log('Unknown object type:', data.object);
                        break;
                    }
                    
                  } catch (e) {
                    // Only log parsing errors for debugging, but don't break the stream
                    console.log('Skipping malformed SSE data:', dataContent, e);
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
          
        } catch (error) {
          console.error('Streaming error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (err) {
    console.error('OpenAI Assistant API error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new Response(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`, {
      status: 500,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }
} 