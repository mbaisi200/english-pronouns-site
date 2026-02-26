'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export interface HybridSpeechRecognitionResult {
  transcript: string
  confidence: number
  method: 'web-speech' | 'server-asr'
}

export interface HybridSpeechRecognitionOptions {
  language?: string
  onResult?: (result: HybridSpeechRecognitionResult) => void
  onError?: (error: string) => void
  onStart?: () => void
  onEnd?: () => void
}

export interface UseHybridSpeechRecognitionReturn {
  isRecording: boolean
  isProcessing: boolean
  isSupported: boolean
  method: 'web-speech' | 'server-asr' | 'none'
  startRecording: () => Promise<void>
  stopRecording: () => void
  transcript: string
  error: string | null
  platform: Platform
}

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

// Check if Web Speech API is available
const isWebSpeechAvailable = (): boolean => {
  if (typeof window === 'undefined') return false
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

// Check if MediaRecorder is available
const isMediaRecorderAvailable = (): boolean => {
  if (typeof window === 'undefined') return false
  return !!window.MediaRecorder
}

export const useHybridSpeechRecognition = (
  options: HybridSpeechRecognitionOptions = {}
): UseHybridSpeechRecognitionReturn => {
  const { language = 'en-US', onResult, onError, onStart, onEnd } = options

  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [method, setMethod] = useState<'web-speech' | 'server-asr' | 'none'>('none')

  const platformRef = useRef<Platform>('unknown')
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  // Initialize on mount
  useEffect(() => {
    platformRef.current = detectPlatform()

    // Determine best method based on platform
    const webSpeech = isWebSpeechAvailable()
    const mediaRecorder = isMediaRecorderAvailable()

    if (webSpeech && platformRef.current !== 'ios') {
      // Use Web Speech API for non-iOS platforms
      setMethod('web-speech')
      initWebSpeech()
    } else if (mediaRecorder) {
      // Use MediaRecorder + server ASR for iOS or when Web Speech is not available
      setMethod('server-asr')
    } else {
      setMethod('none')
    }

    return () => {
      cleanup()
    }
  }, [])

  const initWebSpeech = () => {
    if (typeof window === 'undefined') return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    recognitionRef.current = new SpeechRecognition()
    recognitionRef.current.continuous = false
    recognitionRef.current.interimResults = false
    recognitionRef.current.lang = language
    recognitionRef.current.maxAlternatives = 1

    recognitionRef.current.onstart = () => {
      setIsRecording(true)
      setError(null)
      onStart?.()
    }

    recognitionRef.current.onresult = (event) => {
      const result = event.results[0][0]
      const newTranscript = result.transcript
      setTranscript(newTranscript)
      onResult?.({
        transcript: newTranscript,
        confidence: result.confidence,
        method: 'web-speech'
      })
    }

    recognitionRef.current.onerror = (event) => {
      console.error('Web Speech error:', event.error)
      setError(event.error)
      setIsRecording(false)

      // On iOS, if Web Speech fails, try MediaRecorder fallback
      if (platformRef.current === 'ios' && isMediaRecorderAvailable()) {
        setMethod('server-asr')
      }

      onError?.(event.error)
    }

    recognitionRef.current.onend = () => {
      setIsRecording(false)
      onEnd?.()
    }
  }

  const cleanup = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {
        // Ignore errors on cleanup
      }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // Ignore errors on cleanup
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
  }

  const startRecording = useCallback(async () => {
    setError(null)
    setTranscript('')

    if (method === 'web-speech' && recognitionRef.current) {
      try {
        // Web Speech API
        recognitionRef.current.start()
      } catch (err) {
        console.error('Failed to start Web Speech:', err)
        // Fallback to MediaRecorder
        if (isMediaRecorderAvailable()) {
          setMethod('server-asr')
          await startMediaRecorder()
        } else {
          setError('Failed to start speech recognition')
          onError?.('Failed to start speech recognition')
        }
      }
    } else if (method === 'server-asr' || platformRef.current === 'ios') {
      // MediaRecorder + Server ASR
      await startMediaRecorder()
    } else {
      setError('Speech recognition not supported')
      onError?.('Speech recognition not supported')
    }
  }, [method, onError, onStart])

  const startMediaRecorder = async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      })

      streamRef.current = stream
      audioChunksRef.current = []

      // Determine best MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : 'audio/wav'

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      })

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.onstart = () => {
        setIsRecording(true)
        onStart?.()
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        setIsRecording(false)
        setIsProcessing(true)

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())

        // Process audio
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        await processAudioWithServerASR(audioBlob)

        setIsProcessing(false)
        onEnd?.()
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        setError('Recording failed')
        setIsRecording(false)
        onError?.('Recording failed')
      }

      mediaRecorder.start(100) // Collect data every 100ms

      // Auto-stop after 30 seconds (safety limit)
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording()
        }
      }, 30000)

    } catch (err) {
      console.error('Failed to start MediaRecorder:', err)
      const errorMessage = err instanceof Error ? err.message : 'Microphone access denied'
      setError(errorMessage)
      onError?.(errorMessage)
    }
  }

  const processAudioWithServerASR = async (audioBlob: Blob) => {
    try {
      // Convert to base64
      const arrayBuffer = await audioBlob.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      )

      // Send to server ASR
      const response = await fetch('/api/asr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audio_base64: base64
        })
      })

      if (!response.ok) {
        throw new Error('ASR request failed')
      }

      const data = await response.json()

      if (data.success && data.transcription) {
        setTranscript(data.transcription)
        onResult?.({
          transcript: data.transcription,
          confidence: 1.0,
          method: 'server-asr'
        })
      } else {
        throw new Error(data.error || 'No transcription returned')
      }

    } catch (err) {
      console.error('ASR processing error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to process audio'
      setError(errorMessage)
      onError?.(errorMessage)
    }
  }

  const stopRecording = useCallback(() => {
    if (method === 'web-speech' && recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // Ignore errors
      }
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // Ignore errors
      }
    }

    setIsRecording(false)
  }, [method])

  return {
    isRecording,
    isProcessing,
    isSupported: method !== 'none',
    method,
    startRecording,
    stopRecording,
    transcript,
    error,
    platform: platformRef.current
  }
}
