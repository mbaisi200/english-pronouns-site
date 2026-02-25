'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

// Voice configurations with names
const VOICE_CONFIGS = {
  female: [
    { id: 'emma', name: 'Emma', description: 'Warm & Friendly', accent: 'American', pitch: 1.0 },
    { id: 'sophie', name: 'Sophie', description: 'Young & Lively', accent: 'American', pitch: 1.1 },
    { id: 'olivia', name: 'Olivia', description: 'Natural & Smooth', accent: 'British', pitch: 1.0 },
    { id: 'charlotte', name: 'Charlotte', description: 'Expressive', accent: 'American', pitch: 0.95 },
  ],
  male: [
    { id: 'james', name: 'James', description: 'British Gentleman', accent: 'British', pitch: 0.9 },
    { id: 'michael', name: 'Michael', description: 'Clear & Standard', accent: 'American', pitch: 1.0 },
    { id: 'david', name: 'David', description: 'Professional', accent: 'American', pitch: 0.95 },
  ]
}

type VoiceConfig = typeof VOICE_CONFIGS.female[0]

interface BrowserVoice {
  voice: SpeechSynthesisVoice | null
  config: VoiceConfig
}

export default function Home() {
  const [text, setText] = useState('')
  const [selectedVoiceConfig, setSelectedVoiceConfig] = useState<VoiceConfig>(VOICE_CONFIGS.female[0])
  const [speed, setSpeed] = useState(1.0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  const { toast } = useToast()
  const synthRef = useRef<SpeechSynthesis | null>(null)

  // Load voices
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis
      
      const loadVoices = () => {
        const availableVoices = synthRef.current?.getVoices() || []
        setVoices(availableVoices)
        setVoicesLoaded(true)
      }

      loadVoices()
      
      // Chrome loads voices asynchronously
      synthRef.current?.addEventListener('voiceschanged', loadVoices)
      
      return () => {
        synthRef.current?.removeEventListener('voiceschanged', loadVoices)
      }
    }
  }, [])

  // Find best matching voice for the selected config
  const findBestVoice = useCallback((config: VoiceConfig): SpeechSynthesisVoice | null => {
    if (!voices.length) return null

    const isBritish = config.accent === 'British'
    const searchTerms = isBritish 
      ? ['GB', 'UK', 'British', 'en-GB']
      : ['US', 'American', 'en-US']

    // Try to find English voice matching accent
    for (const term of searchTerms) {
      const found = voices.find(v => 
        v.lang.startsWith('en') && 
        (v.lang.includes(term) || v.name.toLowerCase().includes(term.toLowerCase()))
      )
      if (found) return found
    }

    // Fallback to any English voice
    const englishVoice = voices.find(v => v.lang.startsWith('en'))
    if (englishVoice) return englishVoice

    // Last resort: first available voice
    return voices[0] || null
  }, [voices])

  // Get voice info display
  const getVoiceInfo = (config: VoiceConfig): string => {
    const voice = findBestVoice(config)
    if (!voice) return 'No voice available'
    return voice.name
  }

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
    const voice = findBestVoice(selectedVoiceConfig)
    
    if (voice) {
      utterance.voice = voice
    }
    
    utterance.rate = speed
    utterance.pitch = selectedVoiceConfig.pitch
    utterance.lang = 'en-US'

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

  const handleVoiceSelect = (config: VoiceConfig) => {
    setSelectedVoiceConfig(config)
    // Stop current speech when changing voice
    if (isSpeaking) {
      stop()
    }
  }

  const handleSpeedChange = (value: number[]) => {
    setSpeed(value[0])
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
              <p className="text-yellow-700 dark:text-yellow-300">Loading voices...</p>
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
                Choose a Voice
              </Label>
              
              {/* Female Voices */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-pink-600 dark:text-pink-400 mb-3 flex items-center gap-2">
                  <span>👩</span> Female Voices
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                  {VOICE_CONFIGS.female.map((config) => (
                    <button
                      key={config.id}
                      onClick={() => handleVoiceSelect(config)}
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        selectedVoiceConfig.id === config.id
                          ? 'border-pink-400 bg-pink-50 dark:bg-pink-900/30 shadow-md'
                          : 'border-gray-200 dark:border-gray-600 hover:border-pink-300 hover:bg-pink-50/50 dark:hover:bg-pink-900/20'
                      }`}
                    >
                      <div className="font-semibold text-sm md:text-base">{config.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{config.description}</div>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {config.accent}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>

              {/* Male Voices */}
              <div>
                <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
                  <span>👨</span> Male Voices
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                  {VOICE_CONFIGS.male.map((config) => (
                    <button
                      key={config.id}
                      onClick={() => handleVoiceSelect(config)}
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        selectedVoiceConfig.id === config.id
                          ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 shadow-md'
                          : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-900/20'
                      }`}
                    >
                      <div className="font-semibold text-sm md:text-base">{config.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{config.description}</div>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {config.accent}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Voice Info */}
              {voicesLoaded && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <strong>Active voice:</strong> {getVoiceInfo(selectedVoiceConfig)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Speed Control */}
          <Card className="shadow-lg border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardContent className="p-4 md:p-6">
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
                  onValueChange={handleSpeedChange}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  className="flex-1"
                />
                <span className="text-sm text-gray-500 w-12 text-right">Fast 🐇</span>
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>0.5x</span>
                <span>1.0x (Normal)</span>
                <span>2.0x</span>
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
                    disabled={!text.trim() || !voicesLoaded}
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
                  <span>Practice short phrases first, then move to longer sentences</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Listen multiple times and try to mimic the pronunciation</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Browser Support Info */}
          <Card className="shadow-md border-0 bg-gray-50/80 dark:bg-gray-800/50 backdrop-blur-sm">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Works on all modern browsers • No installation needed • Free forever
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
