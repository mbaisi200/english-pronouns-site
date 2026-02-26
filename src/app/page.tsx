'use client'

import { useState, useRef, useEffect } from 'react'
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
  const [speechSupported, setSpeechSupported] = useState(false)
  
  const { toast } = useToast()
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const speechSupportedRef = useRef(false)

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

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = false
        recognitionRef.current.interimResults = false
        recognitionRef.current.lang = 'en-US'
        speechSupportedRef.current = true
        // Trigger re-render to show support status
        setTimeout(() => setSpeechSupported(true), 0)
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

  // Start recording with Web Speech API
  const startRecording = () => {
    if (!recognitionRef.current) {
      toast({
        title: 'Error',
        description: 'Speech recognition not supported. Please use Chrome or Edge.',
        variant: 'destructive',
      })
      return
    }

    setIsRecording(true)
    setSpokenText('')
    setAnalysisResult(null)

    recognitionRef.current.onresult = async (event) => {
      const transcript = event.results[0][0].transcript
      console.log('Transcript:', transcript)
      setSpokenText(transcript)
      setIsRecording(false)
      setIsProcessing(true)
      
      // Analyze the speech
      await analyzeSpeech(transcript)
    }

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      setIsRecording(false)
      toast({
        title: 'Error',
        description: `Speech recognition error: ${event.error}. Please try again.`,
        variant: 'destructive',
      })
    }

    recognitionRef.current.onend = () => {
      setIsRecording(false)
    }

    try {
      recognitionRef.current.start()
    } catch {
      toast({
        title: 'Error',
        description: 'Could not start speech recognition. Please try again.',
        variant: 'destructive',
      })
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsRecording(false)
    }
  }

  // Analyze speech using local comparison
  const analyzeSpeech = async (transcript: string) => {
    try {
      const originalWords = text.toLowerCase().replace(/[.,!?;:'"]/g, '').split(/\s+/).filter(w => w.length > 0)
      const spokenWords = transcript.toLowerCase().replace(/[.,!?;:'"]/g, '').split(/\s+/).filter(w => w.length > 0)
      
      const correctWords: string[] = []
      const incorrectWords: Array<{ word: string; spokenAs: string; tip: string }> = []
      const missingWords: string[] = []
      const extraWords: string[] = []
      
      // Simple comparison
      const spokenSet = new Set(spokenWords)
      const originalSet = new Set(originalWords)
      
      // Find correct and missing words
      originalWords.forEach(word => {
        if (spokenSet.has(word)) {
          correctWords.push(word)
        } else {
          missingWords.push(word)
        }
      })
      
      // Find extra words (spoken but not in original)
      spokenWords.forEach(word => {
        if (!originalSet.has(word)) {
          extraWords.push(word)
        }
      })
      
      // Calculate score
      const score = originalWords.length > 0 
        ? Math.round((correctWords.length / originalWords.length) * 100)
        : 0

      // Generate pronunciation tips based on missing words
      const pronunciationTips: string[] = []
      if (missingWords.length > 0) {
        pronunciationTips.push(`Practice these words: ${missingWords.slice(0, 3).join(', ')}`)
      }
      if (extraWords.length > 0) {
        pronunciationTips.push(`You added extra words. Try to match the original text exactly.`)
      }
      if (score < 70) {
        pronunciationTips.push(`Try speaking more slowly and clearly.`)
        pronunciationTips.push(`Listen to the text again before practicing.`)
      }
      if (score >= 80) {
        pronunciationTips.push(`Great job! Keep practicing to maintain your skills.`)
      }

      // Generate feedback
      let feedback = ''
      if (score >= 90) {
        feedback = `Excellent pronunciation! You said "${transcript}" which matches the original text very well.`
      } else if (score >= 70) {
        feedback = `Good effort! You said "${transcript}". You got most of the words right. Keep practicing the words you missed.`
      } else if (score >= 50) {
        feedback = `Nice try! You said "${transcript}". Focus on pronouncing each word clearly. Listen again and try to match the rhythm.`
      } else {
        feedback = `Keep practicing! You said "${transcript}". Try listening to the text multiple times and speaking more slowly.`
      }

      const result: AnalysisResult = {
        score,
        accuracy: `${score}%`,
        correctWords,
        incorrectWords,
        missingWords,
        extraWords,
        feedback,
        pronunciationTips
      }

      setAnalysisResult(result)
      setCurrentStep('result')
      setIsProcessing(false)

    } catch (error) {
      console.error('Analysis error:', error)
      setIsProcessing(false)
      toast({
        title: 'Error',
        description: 'Failed to analyze speech',
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
                    {isRecording ? '⏹️ Stop Speaking' : '🎙️ Start Speaking'}
                  </Button>
                  {isRecording && (
                    <p className="text-sm text-gray-500 mt-2 animate-pulse">
                      🎧 Listening... Speak now!
                    </p>
                  )}
                </CardContent>
              </Card>

              {isProcessing && (
                <Card className="shadow-lg bg-blue-50 dark:bg-blue-900/20">
                  <CardContent className="p-4 text-center">
                    <div className="animate-spin text-4xl mb-2">⚙️</div>
                    <p className="text-blue-600 dark:text-blue-400">Analyzing your speech...</p>
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
                    {spokenText || '(nothing detected)'}
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
                    <Label className="font-semibold mb-2 block text-green-600">✅ Correct words ({analysisResult.correctWords.length}):</Label>
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

              {analysisResult.missingWords.length > 0 && (
                <Card className="shadow-lg border-red-200 dark:border-red-800">
                  <CardContent className="p-4">
                    <Label className="font-semibold mb-2 block text-red-600">❌ Missing words ({analysisResult.missingWords.length}):</Label>
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

              {analysisResult.extraWords.length > 0 && (
                <Card className="shadow-lg border-orange-200 dark:border-orange-800">
                  <CardContent className="p-4">
                    <Label className="font-semibold mb-2 block text-orange-600">➕ Extra words spoken:</Label>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.extraWords.map((word, i) => (
                        <Badge key={i} variant="outline" className="bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
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
                  onClick={() => {
                    setSpokenText('')
                    setAnalysisResult(null)
                    setCurrentStep('speak')
                  }}
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
                  💡 <strong>Tip:</strong> Use slower speed (0.7x-0.8x) to hear each sound clearly. After listening, speak and get instant feedback!
                </p>
              </CardContent>
            </Card>
          )}

          {/* Browser Support Warning */}
          {currentStep === 'speak' && !speechSupported && (
            <Card className="bg-red-50 dark:bg-red-900/20 border-0">
              <CardContent className="p-4">
                <p className="text-sm text-red-800 dark:text-red-200">
                  ⚠️ <strong>Warning:</strong> Speech recognition is not supported in this browser. Please use Chrome or Edge for the best experience.
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
