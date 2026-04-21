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

  // Server-TTS proxy (optional)
  const playServerTTS = useCallback(async (text: string, language: string = 'en-US') => {
    const url = (process.env.NEXT_PUBLIC_SERVER_TTS_URL || '/api/tts')
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language })
    })
    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(err || 'Server TTS failed')
    }
    const blob = await resp.blob()
    const blobUrl = URL.createObjectURL(blob)
    const audio = new Audio(blobUrl)
    await audio.play()
    URL.revokeObjectURL(blobUrl)
  }, [])

  // Initialize
  useEffect(() => {
    const detectedPlatform = detectPlatform()
    setPlatform(detectedPlatform)
    
    console.log('TTS: Platform detected:', detectedPlatform)

    // Try Web Speech API first (works on iOS too in some cases)
    initWebSpeech()

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
      console.log('TTS: Loaded voices:', availableVoices.length)
      if (availableVoices.length > 0) {
        voicesRef.current = availableVoices
        setVoicesLoaded(true)
        setMethod('web-speech')
      }
    }

    loadVoices()

    // iOS Safari needs this event
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices
    }

    // Fallback polling - iOS can take time to load voices
    let attempts = 0
    const maxAttempts = 50
    const interval = setInterval(() => {
      attempts++
      const v = synthRef.current?.getVoices()
      console.log(`TTS: Polling voices attempt ${attempts}:`, v?.length || 0)
      if (v && v.length > 0) {
        voicesRef.current = v
        setVoicesLoaded(true)
        setMethod('web-speech')
        clearInterval(interval)
      } else if (attempts >= maxAttempts) {
        console.log('TTS: Max attempts reached, voices not loaded')
        clearInterval(interval)
      }
    }, 100)

    // Timeout after 5 seconds
    setTimeout(() => clearInterval(interval), 5000)
  }

  const getVoice = useCallback((gender: 'male' | 'female'): SpeechSynthesisVoice | null => {
    const voices = voicesRef.current
    console.log('TTS: Getting voice from', voices.length, 'voices, gender:', gender)
    if (voices.length === 0) return null

    // First try to find English voices
    const englishVoices = voices.filter(v => v.lang.startsWith('en'))
    console.log('TTS: English voices:', englishVoices.map(v => v.name))
    
    if (englishVoices.length === 0) {
      console.log('TTS: No English voices, using first available')
      return voices[0]
    }

    // Keywords for voice matching
    const maleKeywords = ['daniel', 'george', 'guy', 'male', 'man', 'james', 'david', 'michael', 'mark', 'tom', 'arthur', 'brian', 'richard', 'fred', 'ralph', 'alex']
    const femaleKeywords = ['samantha', 'victoria', 'karen', 'female', 'woman', 'siri', 'zira', 'susan', 'hazel', 'emma', 'sophie', 'olivia', 'moira', 'tessa', 'fiona', 'alice', 'kate', 'molly', 'ellen', 'siri']

    const keywords = gender === 'male' ? maleKeywords : femaleKeywords

    // Try to find matching voice
    for (const keyword of keywords) {
      const found = englishVoices.find(v => 
        v.name.toLowerCase().includes(keyword)
      )
      if (found) {
        console.log('TTS: Found voice:', found.name)
        return found
      }
    }

    // Fallback: use first English voice
    const fallback = englishVoices[0]
    console.log('TTS: Using fallback voice:', fallback.name)
    return fallback
  }, [])

  const speakWithWebSpeech = useCallback((text: string, speed: number = 1.0, gender: 'male' | 'female' = 'female'): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log('TTS: speakWithWebSpeech called')
      
      if (!synthRef.current) {
        console.error('TTS: speechSynthesis not available')
        reject(new Error('Speech synthesis not available'))
        return
      }

      // Cancel any ongoing speech
      synthRef.current.cancel()

      // Wait a bit for cancel to take effect
      setTimeout(() => {
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
        utterance.volume = 1.0

        utterance.onstart = () => {
          console.log('TTS: Speech started')
          setIsSpeaking(true)
          setIsLoading(false)
        }

        utterance.onend = () => {
          console.log('TTS: Speech ended')
          setIsSpeaking(false)
          resolve()
        }

        utterance.onerror = (event) => {
          console.error('TTS: Speech error:', event.error)
          setIsSpeaking(false)
          
          // If Web Speech fails, we could try server TTS here
          // For now, just reject
          reject(new Error(event.error || 'Speech synthesis error'))
        }

        currentUtteranceRef.current = utterance
        
        console.log('TTS: Calling speak()')
        synthRef.current.speak(utterance)
        
        // iOS Safari hack: sometimes speak() doesn't work without this
        // Resume if paused
        if (synthRef.current.paused) {
          console.log('TTS: Resuming paused synthesis')
          synthRef.current.resume()
        }
      }, 50)
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

    console.log('TTS: speak() called, method:', method, 'voicesLoaded:', voicesLoaded)

    // If configured to use Server-TTS, try that first
    if (method === 'server-tts') {
      try {
        await playServerTTS(trimmedText, 'en-US')
        return
      } catch (err) {
        console.error('Server TTS failed, falling back to Web Speech', err)
      }
    }

    // Fall back to Web Speech API
    if (synthRef.current && voicesRef.current.length > 0) {
      console.log('TTS: Using Web Speech API')
      try {
        await speakWithWebSpeech(trimmedText, speed, gender)
        return
      } catch (error) {
        console.error('TTS: Web Speech failed:', error)
        throw error
      }
    } else {
      console.error('TTS: No voices available')
      throw new Error('Speech synthesis not ready. Please refresh the page.')
    }
  }, [method, voicesLoaded, speakWithWebSpeech])

  const stop = useCallback(() => {
    console.log('TTS: stop() called')
    if (synthRef.current) {
      synthRef.current.cancel()
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsSpeaking(false)
    setIsLoading(false)
  }, [])

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
