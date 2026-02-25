'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { AlertCircle, Loader2 } from 'lucide-react'

interface VoiceOption {
  voice: SpeechSynthesisVoice | null
  label: string
  emoji: string
  gender: 'male' | 'female'
}

export default function Home() {
  const [text, setText] = useState('')
  const [speed, setSpeed] = useState(1.0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('female')
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([])
  const [isLoadingVoices, setIsLoadingVoices] = useState(true)
  const { toast } = useToast()
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const voiceLoadAttempts = useRef(0)
  const maxVoiceLoadAttempts = 50 // Aumentado para melhor compatibilidade

  // Detectar plataforma
  const getPlatform = () => {
    if (typeof window === 'undefined') return 'unknown'
    const ua = navigator.userAgent
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
    if (/Android/.test(ua)) return 'android'
    if (/Windows/.test(ua)) return 'windows'
    if (/Mac/.test(ua)) return 'macos'
    if (/Linux/.test(ua)) return 'linux'
    return 'unknown'
  }

  // Melhorar detecção de vozes com retry
  const loadVoicesWithRetry = async () => {
    if (typeof window === 'undefined') {
      setVoiceError('Web Speech API não está disponível')
      setIsLoadingVoices(false)
      return
    }

    synthRef.current = window.speechSynthesis

    if (!synthRef.current) {
      setVoiceError('Speech Synthesis não suportado neste navegador')
      setIsLoadingVoices(false)
      return
    }

    const loadVoices = () => {
      try {
        const voices = synthRef.current?.getVoices() || []
        
        if (voices.length > 0) {
          voicesRef.current = voices
          updateAvailableVoices(voices)
          setVoicesLoaded(true)
          setVoiceError(null)
          setIsLoadingVoices(false)
          voiceLoadAttempts.current = 0
          return true
        }
        
        return false
      } catch (error) {
        console.error('Erro ao carregar vozes:', error)
        setVoiceError('Erro ao carregar vozes')
        return false
      }
    }

    // Tentar carregar vozes imediatamente
    if (loadVoices()) return

    // Configurar listener para quando vozes forem carregadas
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices
    }

    // Retry com backoff exponencial para plataformas que carregam vozes lentamente
    const retryInterval = setInterval(() => {
      voiceLoadAttempts.current++
      
      if (loadVoices()) {
        clearInterval(retryInterval)
        return
      }

      if (voiceLoadAttempts.current >= maxVoiceLoadAttempts) {
        clearInterval(retryInterval)
        // Usar vozes padrão mesmo sem carregar
        setVoicesLoaded(true)
        setIsLoadingVoices(false)
        if (voicesRef.current.length === 0) {
          setVoiceError('Nenhuma voz disponível. Usando voz padrão do sistema.')
        }
      }
    }, 100)

    return () => clearInterval(retryInterval)
  }

  // Atualizar vozes disponíveis
  const updateAvailableVoices = (voices: SpeechSynthesisVoice[]) => {
    const femaleVoice = findBestVoice(voices, 'female')
    const maleVoice = findBestVoice(voices, 'male')

    const options: VoiceOption[] = [
      {
        voice: femaleVoice,
        label: femaleVoice?.name || 'Voz Feminina',
        emoji: '👩',
        gender: 'female',
      },
      {
        voice: maleVoice,
        label: maleVoice?.name || 'Voz Masculina',
        emoji: '👨',
        gender: 'male',
      },
    ]

    setAvailableVoices(options)
  }

  // Encontrar melhor voz para cada gênero
  const findBestVoice = (
    voices: SpeechSynthesisVoice[],
    gender: 'male' | 'female'
  ): SpeechSynthesisVoice | null => {
    if (voices.length === 0) return null

    const platform = getPlatform()

    // Filtrar vozes em inglês
    const englishVoices = voices.filter(v => v.lang.startsWith('en'))
    if (englishVoices.length === 0) {
      // Se não houver vozes em inglês, usar primeira voz disponível
      return voices[0] || null
    }

    // Keywords específicos por gênero e plataforma
    const maleKeywords = [
      'daniel',
      'george',
      'guy',
      'male',
      'man',
      'james',
      'david',
      'michael',
      'mark',
      'tom',
      'arthur',
      'brian',
      'richard',
      'alex',
      'aaron',
      'andrew',
    ]

    const femaleKeywords = [
      'samantha',
      'victoria',
      'karen',
      'female',
      'woman',
      'siri',
      'zira',
      'susan',
      'hazel',
      'emma',
      'sophie',
      'olivia',
      'moira',
      'tessa',
      'fiona',
      'alice',
      'kate',
      'molly',
      'ellen',
      'amy',
      'ava',
      'zoe',
    ]

    const keywords = gender === 'male' ? maleKeywords : femaleKeywords

    // Tentar encontrar voz por keyword (case-insensitive)
    for (const keyword of keywords) {
      const found = englishVoices.find(v =>
        v.name.toLowerCase().includes(keyword.toLowerCase())
      )
      if (found) return found
    }

    // Fallback: tentar usar atributo 'name' que pode indicar gênero
    const genderIndicator = gender === 'male' ? 'male' : 'female'
    const genderMatch = englishVoices.find(v =>
      v.name.toLowerCase().includes(genderIndicator)
    )
    if (genderMatch) return genderMatch

    // Fallback final: alternar entre vozes disponíveis
    // Geralmente a primeira é feminina e a segunda é masculina
    const index = gender === 'male' ? Math.min(1, englishVoices.length - 1) : 0
    return englishVoices[index] || englishVoices[0]
  }

  // Efeito para carregar vozes
  useEffect(() => {
    loadVoicesWithRetry()

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel()
      }
    }
  }, [])

  const speak = () => {
    if (!text.trim()) {
      toast({
        title: 'Erro',
        description: 'Por favor, digite algum texto',
        variant: 'destructive',
      })
      return
    }

    if (!synthRef.current) {
      toast({
        title: 'Erro',
        description: 'Speech Synthesis não está disponível neste navegador',
        variant: 'destructive',
      })
      return
    }

    // Cancelar qualquer fala em andamento
    synthRef.current.cancel()

    const utterance = new SpeechSynthesisUtterance(text.trim())

    // Tentar usar a voz selecionada
    const selectedVoiceOption = availableVoices.find(
      v => v.gender === selectedGender
    )
    const voice = selectedVoiceOption?.voice || findBestVoice(voicesRef.current, selectedGender)

    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = 'en-US'
    }

    // Ajustar pitch para efeito de gênero
    utterance.pitch = selectedGender === 'female' ? 1.1 : 0.9
    utterance.rate = speed

    // Garantir que rate está dentro dos limites
    utterance.rate = Math.max(0.1, Math.min(10, speed))

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = (event) => {
      setIsSpeaking(false)
      console.error('Speech synthesis error:', event.error)
      toast({
        title: 'Erro',
        description: `Erro ao reproduzir: ${event.error}`,
        variant: 'destructive',
      })
    }

    try {
      synthRef.current.speak(utterance)
    } catch (error) {
      console.error('Erro ao iniciar fala:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao iniciar reprodução de áudio',
        variant: 'destructive',
      })
      setIsSpeaking(false)
    }
  }

  const stop = () => {
    if (synthRef.current) {
      synthRef.current.cancel()
      setIsSpeaking(false)
    }
  }

  const getVoiceLabel = (gender: 'male' | 'female') => {
    const option = availableVoices.find(v => v.gender === gender)
    if (!option?.voice) return gender === 'male' ? 'James' : 'Emma'
    
    // Extrair nome mais curto da voz
    const voiceName = option.voice.name
    const shortName = voiceName.split(' ')[0] || voiceName
    return shortName
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
          {/* Error Alert */}
          {voiceError && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
              <CardContent className="p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    {voiceError}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    A aplicação pode usar a voz padrão do sistema.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading Indicator */}
          {isLoadingVoices && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
              <CardContent className="p-4 flex gap-3 items-center">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Carregando vozes disponíveis...
                </p>
              </CardContent>
            </Card>
          )}

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
                  disabled={isLoadingVoices}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedGender === 'female'
                      ? 'border-pink-400 bg-pink-50 dark:bg-pink-900/30'
                      : 'border-gray-200 hover:border-pink-200'
                  } ${isLoadingVoices ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="text-3xl mb-2 block">👩</span>
                  <span className="font-semibold text-sm">{getVoiceLabel('female')}</span>
                  <p className="text-xs text-gray-500 mt-1">Female Voice</p>
                </button>
                <button
                  onClick={() => setSelectedGender('male')}
                  disabled={isLoadingVoices}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedGender === 'male'
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 hover:border-blue-200'
                  } ${isLoadingVoices ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="text-3xl mb-2 block">👨</span>
                  <span className="font-semibold text-sm">{getVoiceLabel('male')}</span>
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
                <span className="font-mono text-sm bg-gray-100 px-2 rounded">
                  {speed.toFixed(1)}x
                </span>
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
