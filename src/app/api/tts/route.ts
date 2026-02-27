import { NextRequest, NextResponse } from 'next/server';

// Configuration from environment variables
const ZAI_BASE_URL = process.env.ZAI_BASE_URL || '';
const ZAI_API_KEY = process.env.ZAI_API_KEY || 'Z.ai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice = 'tongtong', speed = 1.0 } = body;

    console.log('TTS API Request:', { 
      textLength: text?.length, 
      voice, 
      speed,
      textPreview: text?.substring(0, 50),
      baseUrl: ZAI_BASE_URL ? 'configured' : 'missing'
    });

    // Check if base URL is configured
    if (!ZAI_BASE_URL) {
      console.error('TTS API Error: ZAI_BASE_URL not configured');
      return NextResponse.json(
        { error: 'Server configuration error: ZAI_BASE_URL not set', success: false },
        { status: 500 }
      );
    }

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.error('TTS API Error: Text is required');
      return NextResponse.json(
        { error: 'Text is required', success: false },
        { status: 400 }
      );
    }

    // Limit text length
    const trimmedText = text.trim().slice(0, 1000);
    const validSpeed = Math.max(0.5, Math.min(2.0, Number(speed) || 1.0));

    console.log('TTS: Calling API directly...');
    
    // Call TTS API directly
    const response = await fetch(`${ZAI_BASE_URL}/audio/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZAI_API_KEY}`,
        'X-Z-AI-From': 'Z',
      },
      body: JSON.stringify({
        input: trimmedText,
        voice: voice,
        speed: validSpeed,
        response_format: 'wav',
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('TTS API Error:', response.status, errorBody);
      return NextResponse.json(
        { error: `TTS API failed: ${response.status}`, success: false },
        { status: response.status }
      );
    }

    // Get audio data
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));
    
    console.log('TTS: Audio buffer size:', buffer.length);
    
    if (buffer.length < 100) {
      console.error('TTS API Error: Audio buffer too small');
      return NextResponse.json(
        { error: 'Generated audio is too small', success: false },
        { status: 500 }
      );
    }

    // Return audio as response
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('TTS API Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate speech';
    
    return NextResponse.json(
      {
        error: errorMessage,
        success: false,
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
