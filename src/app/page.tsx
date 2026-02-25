'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

export default function Home() {
  const [text, setText] = useState('')
  const [speed, setSpeed] = useState(1.0)
  const [pitch, setPitch] = useState(1.0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  const { toast } = useToast()
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Load voices
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis
      
      const loadVoices = () => {
        const availableVoices = synthRef.current?.getVoices() || []
        if (availableVoices.length > 0) {
          setVoices(availableVoices)
          setVoicesLoaded(true)
          // Select first English voice by default
          const englishVoice = availableVoices.find(v => v.lang.startsWith('en'))
          setSelectedVoice(englishVoice || availableVoices[0])
        }
      }

      loadVoices()
      
      // Chrome loads voices asynchronously
      const interval = setInterval(() => {
        const v = synthRef.current?.getVoices()
        if (v && v.length > 0 && v.length !== voices.length) {
          loadVoices()
        }
      }, 100)

      if (synthRef.current.onvoiceschanged !== undefined) {
        synthRef.current.onvoiceschanged = loadVoices
      }

      return () => {
        clearInterval(interval)
        if (synthRef.current) {
          synthRef.current.cancel()
        }
      }
    }
  }, [])

  // Filter English voices
  const englishVoices = voices.filter(v => v.lang.startsWith('en'))
  const otherVoices = voices.filter(v => !v.lang.startsWith('en'))

  const speak = () => {
    if (!text.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter some text to speak',
        variant: 'destructive',
      })
      return
    }

    if (!synthRef.current) {
      toast({
        title: 'Error',
        description: 'Speech synthesis not supported in this browser',
        variant: 'destructive',
      })
      return
    }

    // Cancel any ongoing speech
    synthRef.current.cancel()

    const utterance = new SpeechSynthesisUtterance(text.trim())
    
    if (selectedVoice) {
      utterance.voice = selectedVoice
      utterance.lang = selectedVoice.lang
    } else {
      utterance.lang = 'en-US'
    }
    
    utterance.rate = speed
    utterance.pitch = pitch

    utterance.onstart = () => {
      setIsSpeaking(true)
      setIsPaused(false)
    }

    utterance.onend = () => {
      setIsSpeaking(false)
      setIsPaused(false)
    }

    utterance.onerror = (event) => {
      console.error('Speech error:', event)
      setIsSpeaking(false)
      setIsPaused(false)
      toast({
        title: 'Error',
        description: 'Failed to speak. Please try again.',
        variant: 'destructive',
      })
    }

    utteranceRef.current = utterance
    synthRef.current.speak(utterance)
  }

  const pause = () => {
    if (synthRef.current && isSpeaking) {
      synthRef.current.pause()
      setIsPaused(true)
    }
  }

  const resume = () => {
    if (synthRef.current && isPaused) {
      synthRef.current.resume()
      setIsPaused(false)
    }
  }

  const stop = () => {
    if (synthRef.current) {
      synthRef.current.cancel()
      setIsSpeaking(false)
      setIsPaused(false)
    }
  }

  const handleVoiceSelect = (voice: SpeechSynthesisVoice) => {
    setSelectedVoice(voice)
    // Stop current speech when changing voice
    if (isSpeaking) {
      stop()
    }
  }

  const getVoiceDisplayName = (voice: SpeechSynthesisVoice) => {
    // Extract a friendly name from the voice
    let name = voice.name
      .replace('Microsoft ', '')
      .replace('Google ', '')
      .replace(' Online (Natural)', '')
      .replace(' Enhanced', '')
      .replace(' Compact', '')
      .replace('(Female)', '')
      .replace('(Male)', '')
      .trim()
    
    return name
  }

  const getVoiceAccent = (voice: SpeechSynthesisVoice) => {
    if (voice.lang.includes('GB') || voice.lang.includes('UK')) return 'British'
    if (voice.lang.includes('US')) return 'American'
    if (voice.lang.includes('AU')) return 'Australian'
    if (voice.lang.includes('CA')) return 'Canadian'
    if (voice.lang.includes('IN')) return 'Indian'
    return voice.lang.split('-')[1] || 'Other'
  }

  const getVoiceGender = (voice: SpeechSynthesisVoice) => {
    const name = voice.name.toLowerCase()
    if (name.includes('female') || name.includes('woman') || name.includes('girl')) return 'female'
    if (name.includes('male') || name.includes('man') || name.includes('boy')) return 'male'
    // Common female voice names
    const femaleNames = ['samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'siri', 'alex', 'zira', 'susan', 'hazel', 'emma', 'olivia', 'sophie', 'charlotte']
    const maleNames = ['daniel', 'george', 'tom', 'james', 'david', 'michael', 'mark', 'richard', 'brian', 'arthur']
    
    for (const fn of femaleNames) {
      if (name.includes(fn)) return 'female'
    }
    for (const mn of maleNames) {
      if (name.includes(mn)) return 'male'
    }
    return 'neutral'
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-6 md:py-10 max-w-4xl">
        {/* Header */}
        <header className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="text-4xl">🗣️</span>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              English Phonetics Trainer
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-base md:text-lg max-w-2xl mx-auto">
            Practice your English pronunciation! Type any text and listen to native-like speech.
          </p>
        </header>

        {/* Voice Loading Status */}
        {!voicesLoaded && (
          <Card className="mb-6 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
            <CardContent className="p-4 text-center">
              <p className="text-yellow-700 dark:text-yellow-300">Loading voices from your device...</p>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <div className="space-y-6">
          {/* Text Input */}
          <Card className="shadow-lg border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardContent className="p-4 md:p-6">
              <Label htmlFor="text-input" className="text-base font-semibold mb-3 block">
                Enter your text in English
              </Label>
              <Textarea
                id="text-input"
                placeholder="Type or paste your English text here... (e.g., 'The quick brown fox jumps over the lazy dog.')"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[120px] md:min-h-[150px] text-base resize-none border-2 focus:border-blue-400 transition-colors"
                maxLength={2000}
              />
              <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
                <span>{text.length}/2000 characters</span>
              </div>
            </CardContent>
          </Card>

          {/* Voice Selection */}
          <Card className="shadow-lg border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardContent className="p-4 md:p-6">
              <Label className="text-base font-semibold mb-4 block">
                Choose a Voice ({voices.length} available on your device)
              </Label>
              
              {/* English Voices */}
              {englishVoices.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-green-600 dark:text-green-400 mb-3 flex items-center gap-2">
                    <span>🇬🇧</span> English Voices (Recommended)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {englishVoices.map((voice) => {
                      const gender = getVoiceGender(voice)
                      const isSelected = selectedVoice?.name === voice.name
                      return (
                        <button
                          key={voice.name}
                          onClick={() => handleVoiceSelect(voice)}
                          className={`p-3 rounded-xl border-2 transition-all text-left ${
                            isSelected
                              ? 'border-green-400 bg-green-50 dark:bg-green-900/30 shadow-md ring-2 ring-green-300'
                              : 'border-gray-200 dark:border-gray-600 hover:border-green-300 hover:bg-green-50/50 dark:hover:bg-green-900/20'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">
                              {gender === 'female' ? '👩' : gender === 'male' ? '👨' : '🗣️'}
                            </span>
                            <div>
                              <div className="font-semibold text-sm">{getVoiceDisplayName(voice)}</div>
                              <div className="flex gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {getVoiceAccent(voice)}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {voice.lang}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Other Voices */}
              {otherVoices.length > 0 && (
                <details className="mt-4">
                  <summary className="text-sm font-medium text-gray-500 cursor-pointer">
                    Other Languages ({otherVoices.length} voices)
                  </summary>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {otherVoices.slice(0, 10).map((voice) => {
                      const isSelected = selectedVoice?.name === voice.name
                      return (
                        <button
                          key={voice.name}
                          onClick={() => handleVoiceSelect(voice)}
                          className={`p-2 rounded-lg border text-left text-sm ${
                            isSelected
                              ? 'border-gray-400 bg-gray-100 dark:bg-gray-700'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-medium">{getVoiceDisplayName(voice)}</div>
                          <div className="text-xs text-gray-500">{voice.lang}</div>
                        </button>
                      )
                    })}
                  </div>
                </details>
              )}

              {/* Current Voice Info */}
              {selectedVoice && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    ✓ Selected: <strong>{getVoiceDisplayName(selectedVoice)}</strong> ({getVoiceAccent(selectedVoice)})
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Speed and Pitch Control */}
          <Card className="shadow-lg border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardContent className="p-4 md:p-6">
              {/* Speed */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">
                    Speech Speed
                  </Label>
                  <Badge variant="outline" className="text-base font-mono">
                    {speed.toFixed(1)}x
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 w-12">🐢 Slow</span>
                  <Slider
                    value={[speed]}
                    onValueChange={(value) => setSpeed(value[0])}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-500 w-12 text-right">Fast 🐇</span>
                </div>
              </div>

              {/* Pitch */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">
                    Voice Pitch
                  </Label>
                  <Badge variant="outline" className="text-base font-mono">
                    {pitch.toFixed(1)}
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 w-12">Low 🔈</span>
                  <Slider
                    value={[pitch]}
                    onValueChange={(value) => setPitch(value[0])}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-500 w-12 text-right">High 🔊</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Controls */}
          <Card className="shadow-lg border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {!isSpeaking ? (
                  <Button
                    onClick={speak}
                    disabled={!text.trim() || !voicesLoaded || !selectedVoice}
                    className="flex-1 sm:flex-none px-8 py-6 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg"
                  >
                    <span className="mr-2">🔊</span>
                    Speak
                  </Button>
                ) : isPaused ? (
                  <Button
                    onClick={resume}
                    variant="default"
                    className="flex-1 sm:flex-none px-8 py-6 text-lg font-semibold bg-green-500 hover:bg-green-600"
                  >
                    <span className="mr-2">▶️</span>
                    Resume
                  </Button>
                ) : (
                  <Button
                    onClick={pause}
                    variant="outline"
                    className="flex-1 sm:flex-none px-8 py-6 text-lg font-semibold"
                  >
                    <span className="mr-2">⏸️</span>
                    Pause
                  </Button>
                )}

                {isSpeaking && (
                  <Button
                    onClick={stop}
                    variant="destructive"
                    className="flex-1 sm:flex-none px-8 py-6 text-lg font-semibold"
                  >
                    <span className="mr-2">⏹️</span>
                    Stop
                  </Button>
                )}
              </div>

              {isSpeaking && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                  <p className="text-sm text-blue-700 dark:text-blue-300 animate-pulse">
                    🎧 {isPaused ? 'Paused' : 'Speaking...'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tips */}
          <Card className="shadow-md border-0 bg-amber-50/80 dark:bg-amber-900/20 backdrop-blur-sm">
            <CardContent className="p-4 md:p-6">
              <h3 className="font-semibold text-amber-700 dark:text-amber-300 mb-3 flex items-center gap-2">
                <span>💡</span> Tips for Better Practice
              </h3>
              <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Start with slower speed (0.7x - 0.8x) to hear each sound clearly</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Try different voices to hear various accents and pronunciations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Adjust pitch to make the voice higher or lower</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Listen multiple times and try to mimic the pronunciation</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Device Info */}
          <Card className="shadow-md border-0 bg-gray-50/80 dark:bg-gray-800/50 backdrop-blur-sm">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Voices come from your device • Works on all modern browsers • Free forever
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="text-center mt-8 md:mt-12 text-sm text-gray-500 dark:text-gray-400">
          <p>Made for English learners 📚</p>
        </footer>
      </div>
    </main>
  )
}
