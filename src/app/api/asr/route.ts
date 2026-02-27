import { NextRequest, NextResponse } from 'next/server';

// Configuration from environment variables
const ZAI_BASE_URL = process.env.ZAI_BASE_URL || '';
const ZAI_API_KEY = process.env.ZAI_API_KEY || 'Z.ai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { audio_base64 } = body;

    // Check if base URL is configured
    if (!ZAI_BASE_URL) {
      console.error('ASR API Error: ZAI_BASE_URL not configured');
      return NextResponse.json(
        { success: false, error: 'Server configuration error: ZAI_BASE_URL not set' },
        { status: 500 }
      );
    }

    // Validate input
    if (!audio_base64 || typeof audio_base64 !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Audio base64 data is required' },
        { status: 400 }
      );
    }

    // Check if base64 is valid
    if (audio_base64.length < 100) {
      return NextResponse.json(
        { success: false, error: 'Audio data too short - please speak longer' },
        { status: 400 }
      );
    }

    console.log('ASR Request received, base64 length:', audio_base64.length);

    // Call ASR API directly
    const response = await fetch(`${ZAI_BASE_URL}/audio/asr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZAI_API_KEY}`,
        'X-Z-AI-From': 'Z',
      },
      body: JSON.stringify({
        file_base64: audio_base64
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('ASR API Error:', response.status, errorBody);
      return NextResponse.json(
        { success: false, error: `ASR API failed: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('ASR Response:', data);

    if (!data.text || data.text.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No speech detected - please try speaking louder or closer to the microphone'
      });
    }

    return NextResponse.json({
      success: true,
      transcription: data.text,
      wordCount: data.text.split(/\s+/).filter((w: string) => w.length > 0).length
    });

  } catch (error) {
    console.error('ASR API Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to transcribe audio';
    
    // Provide more helpful error messages
    let userMessage = errorMessage;
    if (errorMessage.includes('fetch')) {
      userMessage = 'Network error connecting to speech service. Please try again.';
    }

    return NextResponse.json(
      {
        success: false,
        error: userMessage
      },
      { status: 500 }
    );
  }
}
