'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type Platform = 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown'

// Detect platform
const detectPlatform = (): Platform => {
  if (typeof window === 'undefined') return 'unknown'
  const ua = navigator.userAgent.toLowerCase()
  if (/ipad|iphone|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  if (/windows|win32|win64|wow64/.test(ua)) return 'windows'
  if (/macintosh|mac os x/.test(ua)) return 'macos'
  if (/linux|x11/.test(ua)) return 'linux'
  return 'unknown'
}

export interface UseHybridTTSHook {
  speak: (text: string, options?: { speed?: number; gender?: 'male' | 'female' }) => Promise<void>
  stop: () => void
  isSpeaking: boolean
  isLoading: boolean
  voicesLoaded: boolean
  platform: Platform
  method: 'web-speech' | 'server-tts'
}

export const useHybridTTS = (): UseHybridTTSHook => {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  const [platform, setPlatform] = useState<Platform>('unknown')
  const [method, setMethod] = useState<'web-speech' | 'server-tts'>('web-speech')

  const synthRef = useRef<SpeechSynthesis | null>(null)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Initialize
  useEffect(() => {
    const detectedPlatform = detectPlatform()
    setPlatform(detectedPlatform)

    // iOS needs server-side TTS
    if (detectedPlatform === 'ios') {
      setMethod('server-tts')
    } else {
      setMethod('web-speech')
      initWebSpeech()
    }

    // Cleanup
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel()
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const initWebSpeech = () => {
    if (typeof window === 'undefined') return

    synthRef.current = window.speechSynthesis

    const loadVoices = () => {
      const availableVoices = synthRef.current?.getVoices() || []
      if (availableVoices.length > 0) {
        voicesRef.current = availableVoices
        setVoicesLoaded(true)
      }
    }

    loadVoices()

    // iOS Safari needs this event
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices
    }

    // Fallback polling
    const interval = setInterval(() => {
      const v = synthRef.current?.getVoices()
      if (v && v.length > 0) {
        voicesRef.current = v
        setVoicesLoaded(true)
        clearInterval(interval)
      }
    }, 100)

    // Timeout after 5 seconds
    setTimeout(() => clearInterval(interval), 5000)
  }

  const getVoice = useCallback((gender: 'male' | 'female'): SpeechSynthesisVoice | null => {
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
  }, [])

  const speakWithServerTTS = useCallback(async (text: string, speed: number = 1.0) => {
    try {
      setIsLoading(true)
      
      // Call server TTS API
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          speed: speed,
          voice: 'tongtong' // Server TTS voice
        })
      })

      if (!response.ok) {
        throw new Error('TTS request failed')
      }

      // Get audio blob
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      // Create and play audio
      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onplay = () => {
        setIsSpeaking(true)
        setIsLoading(false)
      }

      audio.onended = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
      }

      audio.onerror = () => {
        setIsSpeaking(false)
        setIsLoading(false)
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
      }

      await audio.play()

    } catch (error) {
      console.error('Server TTS error:', error)
      setIsSpeaking(false)
      setIsLoading(false)
      throw error
    }
  }, [])

  const speakWithWebSpeech = useCallback((text: string, speed: number = 1.0, gender: 'male' | 'female' = 'female') => {
    return new Promise<void>((resolve, reject) => {
      if (!synthRef.current) {
        reject(new Error('Speech synthesis not available'))
        return
      }

      // Cancel any ongoing speech
      synthRef.current.cancel()

      const utterance = new SpeechSynthesisUtterance(text.trim())
      const voice = getVoice(gender)
      
      if (voice) {
        utterance.voice = voice
        utterance.lang = voice.lang
      } else {
        utterance.lang = 'en-US'
      }
      
      utterance.pitch = gender === 'female' ? 1.1 : 0.9
      utterance.rate = speed

      utterance.onstart = () => {
        setIsSpeaking(true)
      }

      utterance.onend = () => {
        setIsSpeaking(false)
        resolve()
      }

      utterance.onerror = (event) => {
        setIsSpeaking(false)
        reject(new Error(event.error))
      }

      currentUtteranceRef.current = utterance
      synthRef.current.speak(utterance)
    })
  }, [getVoice])

  const speak = useCallback(async (
    text: string, 
    options?: { speed?: number; gender?: 'male' | 'female' }
  ) => {
    const { speed = 1.0, gender = 'female' } = options || {}
    const trimmedText = text.trim()

    if (!trimmedText) {
      throw new Error('Empty text')
    }

    if (method === 'server-tts') {
      await speakWithServerTTS(trimmedText, speed)
    } else {
      await speakWithWebSpeech(trimmedText, speed, gender)
    }
  }, [method, speakWithServerTTS, speakWithWebSpeech])

  const stop = useCallback(() => {
    if (method === 'web-speech' && synthRef.current) {
      synthRef.current.cancel()
    }
    if (method === 'server-tts' && audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsSpeaking(false)
  }, [method])

  return {
    speak,
    stop,
    isSpeaking,
    isLoading,
    voicesLoaded,
    platform,
    method
  }
}
