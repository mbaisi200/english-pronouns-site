'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

export default function Home() {
  const [text, setText] = useState('')
  const [speed, setSpeed] = useState(1.0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('female')
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  const { toast } = useToast()
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])

  // Load voices
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis
      
      const loadVoices = () => {
        const availableVoices = synthRef.current?.getVoices() || []
        if (availableVoices.length > 0) {
          voicesRef.current = availableVoices
          setVoicesLoaded(true)
        }
      }

      loadVoices()
      
      if (synthRef.current.onvoiceschanged !== undefined) {
        synthRef.current.onvoiceschanged = loadVoices
      }

      // Keep trying to load
      const interval = setInterval(() => {
        const v = synthRef.current?.getVoices()
        if (v && v.length > 0) {
          voicesRef.current = v
          setVoicesLoaded(true)
        }
      }, 200)

      return () => {
        clearInterval(interval)
        if (synthRef.current) {
          synthRef.current.cancel()
        }
      }
    }
  }, [])

  // Find best voice for gender
  const getVoice = (gender: 'male' | 'female'): SpeechSynthesisVoice | null => {
    const voices = voicesRef.current
    if (voices.length === 0) return null

    // English voices only
    const englishVoices = voices.filter(v => v.lang.startsWith('en'))
    if (englishVoices.length === 0) return voices[0]

    // Keywords for each gender
    const maleKeywords = ['daniel', 'george', 'guy', 'male', 'man', 'james', 'david', 'michael', 'mark', 'tom', 'arthur', 'brian', 'richard']
    const femaleKeywords = ['samantha', 'victoria', 'karen', 'female', 'woman', 'siri', 'zira', 'susan', 'hazel', 'emma', 'sophie', 'olivia', 'moira', 'tessa', 'fiona', 'alice', 'kate', 'molly', 'ellen']

    const keywords = gender === 'male' ? maleKeywords : femaleKeywords

    // Try to find voice matching keywords
    for (const keyword of keywords) {
      const found = englishVoices.find(v => 
        v.name.toLowerCase().includes(keyword)
      )
      if (found) return found
    }

    // Fallback: alternate between available English voices
    const index = gender === 'male' ? Math.min(1, englishVoices.length - 1) : 0
    return englishVoices[index] || englishVoices[0]
  }

  const speak = () => {
    if (!text.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter some text',
        variant: 'destructive',
      })
      return
    }

    if (!synthRef.current) {
      toast({
        title: 'Error',
        description: 'Speech not supported',
        variant: 'destructive',
      })
      return
    }

    // Cancel any ongoing speech
    synthRef.current.cancel()

    const utterance = new SpeechSynthesisUtterance(text.trim())
    const voice = getVoice(selectedGender)
    
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = 'en-US'
    }
    
    // Adjust pitch for gender effect
    utterance.pitch = selectedGender === 'female' ? 1.1 : 0.9
    utterance.rate = speed

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    synthRef.current.speak(utterance)
  }

  const stop = () => {
    if (synthRef.current) {
      synthRef.current.cancel()
      setIsSpeaking(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <header className="text-center mb-8">
          <span className="text-5xl mb-4 block">🗣️</span>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            English Phonetics Trainer
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Practice your English pronunciation
          </p>
        </header>

        <div className="space-y-6">
          {/* Text Input */}
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <Label className="font-semibold mb-2 block">Enter text in English</Label>
              <Textarea
                placeholder="The quick brown fox jumps over the lazy dog."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[120px] text-base"
                maxLength={1000}
              />
              <p className="text-xs text-gray-500 mt-2">{text.length}/1000</p>
            </CardContent>
          </Card>

          {/* Voice Selection */}
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <Label className="font-semibold mb-3 block">Choose a Voice</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedGender('female')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedGender === 'female'
                      ? 'border-pink-400 bg-pink-50 dark:bg-pink-900/30'
                      : 'border-gray-200 hover:border-pink-200'
                  }`}
                >
                  <span className="text-3xl mb-2 block">👩</span>
                  <span className="font-semibold">Emma</span>
                  <p className="text-xs text-gray-500 mt-1">Female Voice</p>
                </button>
                <button
                  onClick={() => setSelectedGender('male')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedGender === 'male'
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 hover:border-blue-200'
                  }`}
                >
                  <span className="text-3xl mb-2 block">👨</span>
                  <span className="font-semibold">James</span>
                  <p className="text-xs text-gray-500 mt-1">Male Voice</p>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Speed Control */}
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <div className="flex justify-between mb-2">
                <Label className="font-semibold">Speed</Label>
                <span className="font-mono text-sm bg-gray-100 px-2 rounded">{speed.toFixed(1)}x</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm">🐢</span>
                <Slider
                  value={[speed]}
                  onValueChange={(v) => setSpeed(v[0])}
                  min={0.5}
                  max={1.5}
                  step={0.1}
                  className="flex-1"
                />
                <span className="text-sm">🐇</span>
              </div>
            </CardContent>
          </Card>

          {/* Speak Button */}
          <Button
            onClick={isSpeaking ? stop : speak}
            disabled={!text.trim() || !voicesLoaded}
            className={`w-full py-6 text-xl font-semibold shadow-lg ${
              isSpeaking 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
            }`}
          >
            {isSpeaking ? '⏹️ Stop' : '🔊 Speak'}
          </Button>

          {/* Tips */}
          <Card className="bg-amber-50 dark:bg-amber-900/20 border-0">
            <CardContent className="p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                💡 <strong>Tip:</strong> Use slower speed (0.7x-0.8x) to hear each sound clearly.
              </p>
            </CardContent>
          </Card>
        </div>

        <footer className="text-center mt-8 text-sm text-gray-500">
          Made for English learners 📚
        </footer>
      </div>
    </main>
  )
}
