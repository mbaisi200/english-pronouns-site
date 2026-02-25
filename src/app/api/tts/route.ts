import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'tongtong', speed = 1.0 } = await req.json();

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Limit text length (SDK max is 1024)
    const trimmedText = text.trim().slice(0, 1000);

    // Validate speed range
    const validSpeed = Math.max(0.5, Math.min(2.0, Number(speed) || 1.0));

    // Create ZAI instance
    const zai = await ZAI.create();

    // Generate TTS audio
    const response = await zai.audio.tts.create({
      input: trimmedText,
      voice: voice,
      speed: validSpeed,
      response_format: 'wav',
      stream: false,
    });

    // Get array buffer from Response object
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    // Return audio as response
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('TTS API Error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate speech',
      },
      { status: 500 }
    );
  }
}
