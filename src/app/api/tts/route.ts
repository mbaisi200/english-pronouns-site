import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice = 'tongtong', speed = 1.0 } = body;

    console.log('TTS API Request:', { 
      textLength: text?.length, 
      voice, 
      speed,
      textPreview: text?.substring(0, 50)
    });

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.error('TTS API Error: Text is required');
      return NextResponse.json(
        { error: 'Text is required', success: false },
        { status: 400 }
      );
    }

    // Limit text length (SDK max is 1024)
    const trimmedText = text.trim().slice(0, 1000);

    // Validate speed range
    const validSpeed = Math.max(0.5, Math.min(2.0, Number(speed) || 1.0));

    console.log('TTS: Creating ZAI instance...');
    
    // Create ZAI instance
    const zai = await ZAI.create();

    console.log('TTS: Calling TTS API...');
    
    // Generate TTS audio
    const response = await zai.audio.tts.create({
      input: trimmedText,
      voice: voice,
      speed: validSpeed,
      response_format: 'wav',
      stream: false,
    });

    console.log('TTS: Response received, type:', typeof response);
    console.log('TTS: Response headers:', response?.headers ? 'present' : 'missing');

    // Get array buffer from Response object
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
        details: error instanceof Error ? error.stack : undefined
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
