import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { audio_base64 } = body;

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

    // Create ZAI instance
    const zai = await ZAI.create();

    // Transcribe audio using ASR
    const response = await zai.audio.asr.create({
      file_base64: audio_base64
    });

    console.log('ASR Response:', response);

    if (!response.text || response.text.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No speech detected - please try speaking louder or closer to the microphone'
      });
    }

    return NextResponse.json({
      success: true,
      transcription: response.text,
      wordCount: response.text.split(/\s+/).filter(w => w.length > 0).length
    });

  } catch (error) {
    console.error('ASR API Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to transcribe audio';
    
    // Provide more helpful error messages
    let userMessage = errorMessage;
    if (errorMessage.includes('format') || errorMessage.includes('decode')) {
      userMessage = 'Audio format not supported. Please try again.';
    } else if (errorMessage.includes('too large') || errorMessage.includes('size')) {
      userMessage = 'Audio too long. Please try a shorter phrase.';
    } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      userMessage = 'Network error. Please check your connection and try again.';
    }

    return NextResponse.json(
      {
        success: false,
        error: userMessage,
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
