import { useState, useRef, useEffect, useCallback } from 'react'
import { findBestVoice } from '../lib/voice-manager'

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

  // Load voices on mount
  useEffect(() => {
    const isBrowser = typeof window !== 'undefined'
    
    if (!isBrowser) {
      return
    }

    const synth = window.speechSynthesis
    if (!synth) {
      return
    }

    synthRef.current = synth

    const loadVoices = () => {
      const availableVoices = synth.getVoices() || []
      if (availableVoices.length > 0) {
        setVoices(availableVoices)
        setIsLoading(false)
      }
    }

    // Load immediately
    loadVoices()

    // Setup listener for voice changes
    synth.onvoiceschanged = loadVoices

    // Retry mechanism
    let attempts = 0
    const maxAttempts = 50
    const retryInterval = setInterval(() => {
      attempts++
      const availableVoices = synth.getVoices() || []
      if (availableVoices.length > 0) {
        setVoices(availableVoices)
        setIsLoading(false)
        clearInterval(retryInterval)
      } else if (attempts >= maxAttempts) {
        setIsLoading(false)
        clearInterval(retryInterval)
      }
    }, 100)

    return () => {
      clearInterval(retryInterval)
      synth.onvoiceschanged = null
      synth.cancel()
    }
  }, [])

  // Speak function
  const speak = useCallback((options: SpeechSynthesisOptions) => {
    if (!synthRef.current) {
      setError('Speech Synthesis not available')
      return
    }

    if (!options.text.trim()) {
      setError('Empty text')
      return
    }

    try {
      synthRef.current.cancel()

      utteranceRef.current = new SpeechSynthesisUtterance(options.text.trim())

      if (options.voice) {
        utteranceRef.current.voice = options.voice
        utteranceRef.current.lang = options.voice.lang
      } else {
        // Prefer US English voice when available; fallback to English
        const defaultVoice =
          // Try to get a US English voice (first, female, then male possibilities)
          findBestVoice(voices, 'female', 'en-US') ?? findBestVoice(voices, 'male', 'en-US') ??
          // Final fallback: any English voice
          voices.find(v => v.lang.toLowerCase().startsWith('en'))
        if (defaultVoice) {
          utteranceRef.current.voice = defaultVoice
          utteranceRef.current.lang = defaultVoice.lang
        } else if (options.lang) {
          utteranceRef.current.lang = options.lang
        } else {
          utteranceRef.current.lang = 'en-US'
        }
      }

      utteranceRef.current.rate = Math.max(0.1, Math.min(10, options.rate || 1.0))
      utteranceRef.current.pitch = options.pitch || 1.0
      utteranceRef.current.volume = Math.max(0, Math.min(1, options.volume || 1.0))

      utteranceRef.current.onstart = () => setIsSpeaking(true)
      utteranceRef.current.onend = () => setIsSpeaking(false)
      utteranceRef.current.onpause = () => setIsSpeaking(false)
      utteranceRef.current.onresume = () => setIsSpeaking(true)
      utteranceRef.current.onerror = () => {
        setError('Speech error')
        setIsSpeaking(false)
      }

      synthRef.current.speak(utteranceRef.current)
      setError(null)
    } catch {
      setError('Failed to start speech')
      setIsSpeaking(false)
    }
  }, [])

  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel()
      setIsSpeaking(false)
    }
  }, [])

  const pause = useCallback(() => {
    if (synthRef.current && synthRef.current.pause) {
      synthRef.current.pause()
      setIsSpeaking(false)
    }
  }, [])

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
