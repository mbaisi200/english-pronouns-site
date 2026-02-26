'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

type Step = 'input' | 'listen' | 'speak' | 'result'

interface AnalysisResult {
  score: number
  accuracy: string
  correctWords: string[]
  incorrectWords: Array<{ word: string; spokenAs: string; tip: string }>
  missingWords: string[]
  extraWords: string[]
  feedback: string
  pronunciationTips: string[]
}

export default function Home() {
  const [text, setText] = useState('')
  const [speed, setSpeed] = useState(1.0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('female')
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  const [currentStep, setCurrentStep] = useState<Step>('input')
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [spokenText, setSpokenText] = useState('')
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  
  const { toast } = useToast()
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

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

    const englishVoices = voices.filter(v => v.lang.startsWith('en'))
    if (englishVoices.length === 0) return voices[0]

    const maleKeywords = ['daniel', 'george', 'guy', 'male', 'man', 'james', 'david', 'michael', 'mark', 'tom', 'arthur', 'brian', 'richard']
    const femaleKeywords = ['samantha', 'victoria', 'karen', 'female', 'woman', 'siri', 'zira', 'susan', 'hazel', 'emma', 'sophie', 'olivia', 'moira', 'tessa', 'fiona', 'alice', 'kate', 'molly', 'ellen']

    const keywords = gender === 'male' ? maleKeywords : femaleKeywords

    for (const keyword of keywords) {
      const found = englishVoices.find(v => 
        v.name.toLowerCase().includes(keyword)
      )
      if (found) return found
    }

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

    synthRef.current.cancel()

    const utterance = new SpeechSynthesisUtterance(text.trim())
    const voice = getVoice(selectedGender)
    
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = 'en-US'
    }
    
    utterance.pitch = selectedGender === 'female' ? 1.1 : 0.9
    utterance.rate = speed

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => {
      setIsSpeaking(false)
      // Move to speak step after listening
      setCurrentStep('speak')
    }
    utterance.onerror = () => setIsSpeaking(false)

    synthRef.current.speak(utterance)
    setCurrentStep('listen')
  }

  const stop = () => {
    if (synthRef.current) {
      synthRef.current.cancel()
      setIsSpeaking(false)
    }
  }

  // Recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Check supported MIME types
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/mp4') 
          ? 'audio/mp4' 
          : 'audio/wav'
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        console.log('Audio blob size:', audioBlob.size, 'type:', mimeType)
        await processAudio(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Recording error:', error)
      toast({
        title: 'Error',
        description: 'Could not access microphone. Please allow microphone access.',
        variant: 'destructive',
      })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsProcessing(true)
    }
  }

  const processAudio = async (audioBlob: Blob) => {
    try {
      console.log('Processing audio...')
      
      // Convert blob to base64
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          const base64 = result.split(',')[1]
          resolve(base64)
        }
        reader.onerror = () => reject(new Error('Failed to read audio file'))
        reader.readAsDataURL(audioBlob)
      })

      console.log('Sending to ASR API...')

      // Send to ASR API
      const asrResponse = await fetch('/api/asr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_base64: base64Audio })
      })

      console.log('ASR response status:', asrResponse.status)
      const asrResult = await asrResponse.json()
      console.log('ASR result:', asrResult)

      if (!asrResult.success) {
        throw new Error(asrResult.error || 'Failed to transcribe')
      }

      setSpokenText(asrResult.transcription)

      console.log('Sending to Compare API...')

      // Send to compare API
      const compareResponse = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText: text,
          spokenText: asrResult.transcription
        })
      })

      console.log('Compare response status:', compareResponse.status)
      const compareResult = await compareResponse.json()
      console.log('Compare result:', compareResult)

      if (compareResult.success) {
        setAnalysisResult(compareResult.analysis)
        setCurrentStep('result')
      } else {
        throw new Error(compareResult.error || 'Failed to analyze')
      }

      setIsProcessing(false)
    } catch (error) {
      console.error('Process audio error:', error)
      setIsProcessing(false)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process audio',
        variant: 'destructive',
      })
    }
  }

  const resetPractice = () => {
    setCurrentStep('input')
    setSpokenText('')
    setAnalysisResult(null)
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
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

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            {['input', 'listen', 'speak', 'result'].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  currentStep === step 
                    ? 'bg-blue-500 text-white' 
                    : ['input', 'listen', 'speak', 'result'].indexOf(currentStep) > index
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {index + 1}
                </div>
                {index < 3 && (
                  <div className={`w-12 h-1 ${
                    ['input', 'listen', 'speak', 'result'].indexOf(currentStep) > index
                      ? 'bg-green-500'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {/* Step 1: Input */}
          {currentStep === 'input' && (
            <>
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
                onClick={speak}
                disabled={!text.trim() || !voicesLoaded}
                className="w-full py-6 text-xl font-semibold shadow-lg bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              >
                🔊 Listen to Text
              </Button>
            </>
          )}

          {/* Step 2: Listening */}
          {currentStep === 'listen' && (
            <Card className="shadow-lg">
              <CardContent className="p-6 text-center">
                <div className="text-6xl mb-4 animate-pulse">🎧</div>
                <h2 className="text-2xl font-bold mb-2">Listen Carefully</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  &ldquo;{text}&rdquo;
                </p>
                <Button
                  onClick={isSpeaking ? stop : speak}
                  className={`px-8 py-4 ${
                    isSpeaking 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                >
                  {isSpeaking ? '⏹️ Stop' : '🔊 Listen Again'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Speak */}
          {currentStep === 'speak' && (
            <>
              <Card className="shadow-lg">
                <CardContent className="p-6 text-center">
                  <div className="text-6xl mb-4">🎤</div>
                  <h2 className="text-2xl font-bold mb-2">Your Turn!</h2>
                  <p className="text-gray-600 dark:text-gray-300 mb-2">
                    Repeat what you heard:
                  </p>
                  <p className="text-lg font-medium mb-4 text-blue-600 dark:text-blue-400">
                    &ldquo;{text}&rdquo;
                  </p>
                  <Button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`px-8 py-4 ${
                      isRecording 
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                        : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    {isRecording ? '⏹️ Stop Recording' : '🎙️ Start Recording'}
                  </Button>
                </CardContent>
              </Card>

              {isProcessing && (
                <Card className="shadow-lg bg-blue-50 dark:bg-blue-900/20">
                  <CardContent className="p-4 text-center">
                    <div className="animate-spin text-4xl mb-2">⚙️</div>
                    <p className="text-blue-600 dark:text-blue-400">Processing your speech...</p>
                  </CardContent>
                </Card>
              )}

              <Button
                variant="outline"
                onClick={speak}
                className="w-full py-4"
              >
                🔊 Listen Again
              </Button>
            </>
          )}

          {/* Step 4: Results */}
          {currentStep === 'result' && analysisResult && (
            <>
              {/* Score Card */}
              <Card className="shadow-lg">
                <CardContent className="p-6 text-center">
                  <h2 className="text-2xl font-bold mb-4">Your Result</h2>
                  <div className={`text-6xl font-bold mb-2 ${getScoreColor(analysisResult.score)}`}>
                    {analysisResult.score}
                  </div>
                  <Badge className={getScoreBadge(analysisResult.score)}>
                    {analysisResult.accuracy} Accuracy
                  </Badge>
                  <Progress value={analysisResult.score} className="mt-4 h-3" />
                </CardContent>
              </Card>

              {/* What you said */}
              <Card className="shadow-lg">
                <CardContent className="p-4">
                  <Label className="font-semibold mb-2 block">📝 What you said:</Label>
                  <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    {spokenText}
                  </p>
                </CardContent>
              </Card>

              {/* Original text */}
              <Card className="shadow-lg">
                <CardContent className="p-4">
                  <Label className="font-semibold mb-2 block">📖 Original text:</Label>
                  <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    {text}
                  </p>
                </CardContent>
              </Card>

              {/* Feedback */}
              <Card className="shadow-lg">
                <CardContent className="p-4">
                  <Label className="font-semibold mb-2 block">💬 Feedback:</Label>
                  <p className="text-gray-700 dark:text-gray-300">
                    {analysisResult.feedback}
                  </p>
                </CardContent>
              </Card>

              {/* Words Analysis */}
              {analysisResult.correctWords.length > 0 && (
                <Card className="shadow-lg border-green-200 dark:border-green-800">
                  <CardContent className="p-4">
                    <Label className="font-semibold mb-2 block text-green-600">✅ Correct words:</Label>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.correctWords.map((word, i) => (
                        <Badge key={i} variant="outline" className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          {word}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {analysisResult.incorrectWords.length > 0 && (
                <Card className="shadow-lg border-yellow-200 dark:border-yellow-800">
                  <CardContent className="p-4">
                    <Label className="font-semibold mb-2 block text-yellow-600">⚠️ Words to improve:</Label>
                    <div className="space-y-2">
                      {analysisResult.incorrectWords.map((item, i) => (
                        <div key={i} className="bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded-lg">
                          <span className="font-medium">{item.word}</span>
                          <span className="text-gray-500 mx-2">→</span>
                          <span className="text-yellow-700 dark:text-yellow-300">{item.spokenAs}</span>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">💡 {item.tip}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {analysisResult.missingWords.length > 0 && (
                <Card className="shadow-lg border-red-200 dark:border-red-800">
                  <CardContent className="p-4">
                    <Label className="font-semibold mb-2 block text-red-600">❌ Missing words:</Label>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.missingWords.map((word, i) => (
                        <Badge key={i} variant="outline" className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                          {word}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pronunciation Tips */}
              {analysisResult.pronunciationTips.length > 0 && (
                <Card className="shadow-lg bg-amber-50 dark:bg-amber-900/20 border-0">
                  <CardContent className="p-4">
                    <Label className="font-semibold mb-2 block">💡 Pronunciation Tips:</Label>
                    <ul className="list-disc list-inside space-y-1 text-sm text-amber-800 dark:text-amber-200">
                      {analysisResult.pronunciationTips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('speak')}
                  className="py-4"
                >
                  🎙️ Try Again
                </Button>
                <Button
                  onClick={resetPractice}
                  className="py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                >
                  🔄 New Text
                </Button>
              </div>
            </>
          )}

          {/* Tips */}
          {currentStep === 'input' && (
            <Card className="bg-amber-50 dark:bg-amber-900/20 border-0">
              <CardContent className="p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  💡 <strong>Tip:</strong> Use slower speed (0.7x-0.8x) to hear each sound clearly. After listening, you can practice speaking and get instant feedback!
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <footer className="text-center mt-8 text-sm text-gray-500">
          Made for English learners 📚
        </footer>
      </div>
    </main>
  )
}
