import type { NextApiRequest, NextApiResponse } from 'next'

// Server-side TTS proxy
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { text, language } = req.body as { text?: string; language?: string }
  if (!text) {
    res.status(400).json({ error: 'text is required' })
    return
  }

  const serverTtsUrl = process.env.NEXT_PUBLIC_SERVER_TTS_URL || process.env.SERVER_TTS_URL
  if (!serverTtsUrl) {
    res.status(501).json({ error: 'Server TTS not configured' })
    return
  }

  try {
    const payload = { text, language }
    const r = await fetch(`${serverTtsUrl.replace(/\/$/, '')}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!r.ok) {
      const errText = await r.text()
      res.status(r.status).json({ error: errText || 'Server TTS failed' })
      return
    }

    const contentType = r.headers.get('content-type') || 'audio/wav'
    const blob = await r.blob()
    // Forward audio data to client
    res.setHeader('Content-Type', contentType)
    // Send as binary
    const buffer = Buffer.from(await blob.arrayBuffer())
    res.status(200).end(buffer)
  } catch (err) {
    res.status(500).json({ error: 'Server TTS request failed' })
  }
}
