import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { originalText, spokenText } = body;

    // Validate input
    if (!originalText || !spokenText) {
      return NextResponse.json(
        { error: 'Original text and spoken text are required' },
        { status: 400 }
      );
    }

    // Create ZAI instance
    const zai = await ZAI.create();

    // Use LLM to compare and provide correction
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an English pronunciation coach for non-native speakers. Your task is to compare what the student was supposed to say with what they actually said, and provide helpful feedback.

Analyze the differences and provide:
1. A score from 0-100 based on accuracy
2. Words that were pronounced incorrectly or missing
3. Specific pronunciation tips for the mistakes made
4. Encouragement for what was done well

Be encouraging and constructive. Focus on helping the student improve.

Respond in JSON format:
{
  "score": <number 0-100>,
  "accuracy": "<percentage string>",
  "correctWords": ["word1", "word2"],
  "incorrectWords": [{"word": "word", "spokenAs": "what was said", "tip": "pronunciation tip"}],
  "missingWords": ["word1"],
  "extraWords": ["word1"],
  "feedback": "<overall encouraging feedback>",
  "pronunciationTips": ["tip1", "tip2"]
}`
        },
        {
          role: 'user',
          content: `Original text (what student should say): "${originalText}"

Spoken text (what student actually said): "${spokenText}"

Please analyze and provide correction feedback.`
        }
      ],
      temperature: 0.3,
    });

    const responseContent = completion.choices[0]?.message?.content || '{}';
    
    // Parse the JSON response
    let analysis;
    try {
      // Remove markdown code blocks if present
      const cleanedContent = responseContent.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleanedContent);
    } catch {
      // If parsing fails, provide a basic analysis
      analysis = {
        score: 50,
        accuracy: "50%",
        correctWords: [],
        incorrectWords: [],
        missingWords: [],
        extraWords: [],
        feedback: responseContent,
        pronunciationTips: []
      };
    }

    return NextResponse.json({
      success: true,
      originalText,
      spokenText,
      analysis
    });

  } catch (error) {
    console.error('Compare API Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze speech',
      },
      { status: 500 }
    );
  }
}
