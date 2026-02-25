'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

// Voice configurations with names
const VOICES = {
  female: [
    { id: 'emma', voiceId: 'tongtong', name: 'Emma', description: 'Warm & Friendly', accent: 'American' },
    { id: 'sophie', voiceId: 'chuichui', name: 'Sophie', description: 'Young & Lively', accent: 'American' },
    { id: 'olivia', voiceId: 'douji', name: 'Olivia', description: 'Natural & Smooth', accent: 'British' },
    { id: 'charlotte', voiceId: 'luodo', name: 'Charlotte', description: 'Expressive', accent: 'American' },
  ],
  male: [
    { id: 'james', voiceId: 'jam', name: 'James', description: 'British Gentleman', accent: 'British' },
    { id: 'michael', voiceId: 'kazi', name: 'Michael', description: 'Clear & Standard', accent: 'American' },
    { id: 'david', voiceId: 'xiaochen', name: 'David', description: 'Professional', accent: 'American' },
  ]
}

type VoiceType = typeof VOICES.female[0] | typeof VOICES.male[0]

export default function Home() {
  const [text, setText] = useState('')
  const [selectedVoice, setSelectedVoice] = useState<VoiceType>(VOICES.female[0])
  const [speed, setSpeed] = useState(1.0)
  const [isLoading, setIsLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const { toast } = useToast()

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  // Handle audio ended
  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      const handleEnded = () => setIsPlaying(false)
      audio.addEventListener('ended', handleEnded)
      return () => audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  const generateSpeech = async () => {
    if (!text.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter some text to speak',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    
    // Revoke previous audio URL
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          voice: selectedVoice.voiceId,
          speed: speed,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate speech')
      }

      const audioBlob = await response.blob()
      const url = URL.createObjectURL(audioBlob)
      setAudioUrl(url)
      
      // Auto-play after generation
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play()
          setIsPlaying(true)
        }
      }, 100)

    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate speech',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const togglePlayPause = () => {
    if (!audioRef.current || !audioUrl) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    }
  }

  const handleVoiceSelect = (voice: VoiceType) => {
    setSelectedVoice(voice)
    // Reset audio when voice changes
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
      setIsPlaying(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Audio Element */}
      {audioUrl && (
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          preload="auto"
          playsInline
        />
      )}

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
                maxLength={1000}
              />
              <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
                <span>{text.length}/1000 characters</span>
                {text.length > 900 && (
                  <span className="text-amber-500">Approaching limit</span>
                )}
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
                  {VOICES.female.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => handleVoiceSelect(voice)}
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        selectedVoice.id === voice.id
                          ? 'border-pink-400 bg-pink-50 dark:bg-pink-900/30 shadow-md'
                          : 'border-gray-200 dark:border-gray-600 hover:border-pink-300 hover:bg-pink-50/50 dark:hover:bg-pink-900/20'
                      }`}
                    >
                      <div className="font-semibold text-sm md:text-base">{voice.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{voice.description}</div>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {voice.accent}
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
                  {VOICES.male.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => handleVoiceSelect(voice)}
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        selectedVoice.id === voice.id
                          ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 shadow-md'
                          : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-900/20'
                      }`}
                    >
                      <div className="font-semibold text-sm md:text-base">{voice.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{voice.description}</div>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {voice.accent}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
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
                  onValueChange={(value) => setSpeed(value[0])}
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
                <Button
                  onClick={generateSpeech}
                  disabled={isLoading || !text.trim()}
                  className="flex-1 sm:flex-none px-8 py-6 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg"
                >
                  {isLoading ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Generating...
                    </>
                  ) : (
                    <>
                      <span className="mr-2">🔊</span>
                      Generate Speech
                    </>
                  )}
                </Button>

                {audioUrl && (
                  <>
                    <Button
                      onClick={togglePlayPause}
                      variant="outline"
                      className="flex-1 sm:flex-none px-6 py-6 text-lg font-semibold"
                    >
                      {isPlaying ? (
                        <>
                          <span className="mr-2">⏸️</span>
                          Pause
                        </>
                      ) : (
                        <>
                          <span className="mr-2">▶️</span>
                          Play
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={stopAudio}
                      variant="destructive"
                      className="flex-1 sm:flex-none px-6 py-6 text-lg font-semibold"
                    >
                      <span className="mr-2">⏹️</span>
                      Stop
                    </Button>
                  </>
                )}
              </div>

              {audioUrl && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    ✅ Audio ready! Click Play to listen again.
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
        </div>

        {/* Footer */}
        <footer className="text-center mt-8 md:mt-12 text-sm text-gray-500 dark:text-gray-400">
          <p>Made for English learners 📚</p>
        </footer>
      </div>
    </main>
  )
}
