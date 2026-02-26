import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { audio_base64 } = body;

    // Validate input
    if (!audio_base64 || typeof audio_base64 !== 'string') {
      return NextResponse.json(
        { error: 'Audio base64 data is required' },
        { status: 400 }
      );
    }

    // Create ZAI instance
    const zai = await ZAI.create();

    // Transcribe audio using ASR
    const response = await zai.audio.asr.create({
      file_base64: audio_base64
    });

    return NextResponse.json({
      success: true,
      transcription: response.text,
      wordCount: response.text.split(/\s+/).filter(w => w.length > 0).length
    });

  } catch (error) {
    console.error('ASR API Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to transcribe audio',
      },
      { status: 500 }
    );
  }
}
