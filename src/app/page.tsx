'use client'

import { useState, useRef, useEffect } from 'react'
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
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('')
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  const { toast } = useToast()
  const synthRef = useRef<SpeechSynthesis | null>(null)

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
          if (englishVoice) {
            setSelectedVoiceURI(englishVoice.voiceURI)
          } else if (availableVoices[0]) {
            setSelectedVoiceURI(availableVoices[0].voiceURI)
          }
        }
      }

      loadVoices()
      
      // Keep trying to load voices (needed for some browsers)
      let attempts = 0
      const interval = setInterval(() => {
        const v = synthRef.current?.getVoices()
        attempts++
        if (v && v.length > 0) {
          setVoices(v)
          if (!selectedVoiceURI && v.length > 0) {
            const englishVoice = v.find(voice => voice.lang.startsWith('en'))
            setSelectedVoiceURI(englishVoice?.voiceURI || v[0].voiceURI)
          }
        }
        if (attempts > 20) clearInterval(interval)
      }, 200)

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
  }, [selectedVoiceURI])

  // Get selected voice object
  const getSelectedVoice = (): SpeechSynthesisVoice | null => {
    return voices.find(v => v.voiceURI === selectedVoiceURI) || null
  }

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
        description: 'Speech synthesis not supported',
        variant: 'destructive',
      })
      return
    }

    // Cancel any ongoing speech
    synthRef.current.cancel()

    const utterance = new SpeechSynthesisUtterance(text.trim())
    const selectedVoice = getSelectedVoice()
    
    if (selectedVoice) {
      utterance.voice = selectedVoice
      utterance.lang = selectedVoice.lang
    } else {
      utterance.lang = 'en-US'
    }
    
    utterance.rate = speed

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

  const handleVoiceSelect = (voiceURI: string) => {
    setSelectedVoiceURI(voiceURI)
    if (isSpeaking) {
      stop()
    }
  }

  const getVoiceAccent = (voice: SpeechSynthesisVoice): string => {
    if (voice.lang.includes('GB') || voice.lang.includes('UK')) return '🇬🇧 British'
    if (voice.lang.includes('US')) return '🇺🇸 American'
    if (voice.lang.includes('AU')) return '🇦🇺 Australian'
    if (voice.lang.includes('CA')) return '🇨🇦 Canadian'
    if (voice.lang.includes('IE')) return '🇮🇪 Irish'
    if (voice.lang.includes('IN')) return '🇮🇳 Indian'
    if (voice.lang.includes('ZA')) return '🇿🇦 South African'
    return `🌐 ${voice.lang}`
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
                Select a Voice ({voices.length} available)
              </Label>
              
              {/* English Voices */}
              {englishVoices.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-green-600 dark:text-green-400 mb-3">
                    🇬🇧 English Voices
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-2">
                    {englishVoices.map((voice) => {
                      const isSelected = selectedVoiceURI === voice.voiceURI
                      return (
                        <button
                          key={voice.voiceURI}
                          onClick={() => handleVoiceSelect(voice.voiceURI)}
                          className={`p-3 rounded-xl border-2 transition-all text-left ${
                            isSelected
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/30 shadow-md'
                              : 'border-gray-200 dark:border-gray-600 hover:border-green-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                        >
                          <div className="font-semibold text-sm">{voice.name}</div>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            <Badge variant={isSelected ? "default" : "secondary"} className="text-xs">
                              {getVoiceAccent(voice)}
                            </Badge>
                          </div>
                          {isSelected && (
                            <div className="mt-2 text-xs text-green-600 font-medium">✓ Selected</div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Other Voices */}
              {otherVoices.length > 0 && (
                <details className="mt-4">
                  <summary className="text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700">
                    🌐 Other Languages ({otherVoices.length} voices)
                  </summary>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {otherVoices.map((voice) => {
                      const isSelected = selectedVoiceURI === voice.voiceURI
                      return (
                        <button
                          key={voice.voiceURI}
                          onClick={() => handleVoiceSelect(voice.voiceURI)}
                          className={`p-2 rounded-lg border text-left text-sm ${
                            isSelected
                              ? 'border-gray-400 bg-gray-100 dark:bg-gray-700'
                              : 'border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <div className="font-medium">{voice.name}</div>
                          <div className="text-xs text-gray-500">{voice.lang}</div>
                        </button>
                      )
                    })}
                  </div>
                </details>
              )}

              {/* Current Voice */}
              {getSelectedVoice() && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    🎤 Active voice: <strong>{getSelectedVoice()?.name}</strong>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Speed Control */}
          <Card className="shadow-lg border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Speech Speed</Label>
                <Badge variant="outline" className="text-base font-mono">{speed.toFixed(1)}x</Badge>
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
            </CardContent>
          </Card>

          {/* Controls */}
          <Card className="shadow-lg border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {!isSpeaking ? (
                  <Button
                    onClick={speak}
                    disabled={!text.trim() || !selectedVoiceURI}
                    className="flex-1 sm:flex-none px-8 py-6 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg"
                  >
                    🔊 Speak
                  </Button>
                ) : isPaused ? (
                  <Button
                    onClick={resume}
                    className="flex-1 sm:flex-none px-8 py-6 text-lg font-semibold bg-green-500 hover:bg-green-600"
                  >
                    ▶️ Resume
                  </Button>
                ) : (
                  <Button
                    onClick={pause}
                    variant="outline"
                    className="flex-1 sm:flex-none px-8 py-6 text-lg font-semibold"
                  >
                    ⏸️ Pause
                  </Button>
                )}

                {isSpeaking && (
                  <Button
                    onClick={stop}
                    variant="destructive"
                    className="flex-1 sm:flex-none px-8 py-6 text-lg font-semibold"
                  >
                    ⏹️ Stop
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
                💡 Tips
              </h3>
              <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
                <li>• Use slower speed (0.7x-0.8x) to hear each sound clearly</li>
                <li>• Click on different voices to hear various accents</li>
                <li>• British voices 🇬🇧 sound different from American 🇺🇸</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <footer className="text-center mt-8 md:mt-12 text-sm text-gray-500">
          Made for English learners 📚
        </footer>
      </div>
    </main>
  )
}
