import { useState, useRef, useEffect, useCallback } from 'react'

export interface SpeechSynthesisOptions {
  text: string
  rate?: number
  pitch?: number
  volume?: number
  voice?: SpeechSynthesisVoice | null
  lang?: string
}

export interface UseSpeechSynthesisReturn {
  isSpeaking: boolean
  isLoading: boolean
  voices: SpeechSynthesisVoice[]
  error: string | null
  speak: (options: SpeechSynthesisOptions) => void
  stop: () => void
  pause: () => void
  resume: () => void
}

export const useSpeechSynthesis = (): UseSpeechSynthesisReturn => {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [error, setError] = useState<string | null>(null)

  const synthRef = useRef<SpeechSynthesis | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const loadAttemptsRef = useRef(0)
  const maxAttemptsRef = useRef(50)

  // Carregar vozes com retry
  const loadVoices = useCallback(() => {
    if (typeof window === 'undefined') {
      setError('Web Speech API não está disponível')
      setIsLoading(false)
      return
    }

    synthRef.current = window.speechSynthesis

    if (!synthRef.current) {
      setError('Speech Synthesis não suportado')
      setIsLoading(false)
      return
    }

    const tryLoadVoices = () => {
      try {
        const availableVoices = synthRef.current?.getVoices() || []

        if (availableVoices.length > 0) {
          setVoices(availableVoices)
          setError(null)
          setIsLoading(false)
          loadAttemptsRef.current = 0
          return true
        }

        return false
      } catch (err) {
        console.error('Erro ao carregar vozes:', err)
        setError('Erro ao carregar vozes')
        setIsLoading(false)
        return false
      }
    }

    // Tentar carregar imediatamente
    if (tryLoadVoices()) return

    // Configurar listener
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = tryLoadVoices
    }

    // Retry com backoff
    const retryInterval = setInterval(() => {
      loadAttemptsRef.current++

      if (tryLoadVoices()) {
        clearInterval(retryInterval)
        return
      }

      if (loadAttemptsRef.current >= maxAttemptsRef.current) {
        clearInterval(retryInterval)
        setIsLoading(false)
        if (voices.length === 0) {
          setError('Nenhuma voz disponível')
        }
      }
    }, 100)

    return () => clearInterval(retryInterval)
  }, [])

  // Inicializar ao montar
  useEffect(() => {
    const cleanup = loadVoices()
    return () => {
      if (cleanup) cleanup()
      if (synthRef.current) {
        synthRef.current.cancel()
      }
    }
  }, [loadVoices])

  // Função para falar
  const speak = useCallback((options: SpeechSynthesisOptions) => {
    if (!synthRef.current) {
      setError('Speech Synthesis não disponível')
      return
    }

    if (!options.text.trim()) {
      setError('Texto vazio')
      return
    }

    try {
      // Cancelar fala anterior
      synthRef.current.cancel()

      utteranceRef.current = new SpeechSynthesisUtterance(options.text.trim())

      // Configurar propriedades
      if (options.voice) {
        utteranceRef.current.voice = options.voice
        utteranceRef.current.lang = options.voice.lang
      } else if (options.lang) {
        utteranceRef.current.lang = options.lang
      } else {
        utteranceRef.current.lang = 'en-US'
      }

      utteranceRef.current.rate = Math.max(0.1, Math.min(10, options.rate || 1.0))
      utteranceRef.current.pitch = options.pitch || 1.0
      utteranceRef.current.volume = Math.max(0, Math.min(1, options.volume || 1.0))

      // Configurar callbacks
      utteranceRef.current.onstart = () => setIsSpeaking(true)
      utteranceRef.current.onend = () => setIsSpeaking(false)
      utteranceRef.current.onpause = () => setIsSpeaking(false)
      utteranceRef.current.onresume = () => setIsSpeaking(true)
      utteranceRef.current.onerror = (event) => {
        console.error('Speech synthesis error:', event.error)
        setError(`Erro: ${event.error}`)
        setIsSpeaking(false)
      }

      synthRef.current.speak(utteranceRef.current)
      setError(null)
    } catch (err) {
      console.error('Erro ao iniciar fala:', err)
      setError('Erro ao iniciar reprodução')
      setIsSpeaking(false)
    }
  }, [])

  // Função para parar
  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel()
      setIsSpeaking(false)
    }
  }, [])

  // Função para pausar
  const pause = useCallback(() => {
    if (synthRef.current && synthRef.current.pause) {
      synthRef.current.pause()
      setIsSpeaking(false)
    }
  }, [])

  // Função para retomar
  const resume = useCallback(() => {
    if (synthRef.current && synthRef.current.resume) {
      synthRef.current.resume()
      setIsSpeaking(true)
    }
  }, [])

  return {
    isSpeaking,
    isLoading,
    voices,
    error,
    speak,
    stop,
    pause,
    resume,
  }
}
