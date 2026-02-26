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

// Convert audio blob to WAV format using Web Audio API
const convertToWav = async (audioBlob: Blob): Promise<Blob> => {
  try {
    const arrayBuffer = await audioBlob.arrayBuffer()
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
      sampleRate: 16000
    })
    
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    
    // Get audio data
    const numberOfChannels = 1 // Mono
    const length = audioBuffer.length
    const sampleRate = audioBuffer.sampleRate
    
    // Create WAV buffer
    const wavBuffer = new ArrayBuffer(44 + length * 2)
    const view = new DataView(wavBuffer)
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }
    
    writeString(0, 'RIFF')
    view.setUint32(4, 36 + length * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true) // Subchunk1Size
    view.setUint16(20, 1, true) // AudioFormat (PCM)
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numberOfChannels * 2, true) // ByteRate
    view.setUint16(32, numberOfChannels * 2, true) // BlockAlign
    view.setUint16(34, 16, true) // BitsPerSample
    writeString(36, 'data')
    view.setUint32(40, length * 2, true)
    
    // Write audio data (convert float to 16-bit PCM)
    const channelData = audioBuffer.getChannelData(0)
    let offset = 44
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      offset += 2
    }
    
    await audioContext.close()
    
    return new Blob([wavBuffer], { type: 'audio/wav' })
  } catch (error) {
    console.error('Error converting to WAV:', error)
    throw error
  }
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
  const mimeTypeRef = useRef<string>('audio/webm')

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
          sampleRate: 16000,
          channelCount: 1
        }
      })

      streamRef.current = stream
      audioChunksRef.current = []

      // Determine best MIME type - prefer formats that work well with ASR
      let mimeType = ''
      
      // Try different formats in order of preference
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/wav'
      ]
      
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type
          break
        }
      }
      
      if (!mimeType) {
        // Fallback - let browser choose
        mimeType = ''
      }
      
      mimeTypeRef.current = mimeType
      console.log('Using MIME type:', mimeType || 'default')

      const mediaRecorderOptions: MediaRecorderOptions = {}
      if (mimeType) {
        mediaRecorderOptions.mimeType = mimeType
      }
      mediaRecorderOptions.audioBitsPerSecond = 128000

      const mediaRecorder = new MediaRecorder(stream, mediaRecorderOptions)

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
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mimeTypeRef.current || 'audio/webm' 
        })
        
        console.log('Audio blob size:', audioBlob.size, 'type:', audioBlob.type)
        
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
      console.log('Processing audio, original size:', audioBlob.size, 'type:', audioBlob.type)
      
      // Convert to WAV for better compatibility with ASR
      let wavBlob: Blob
      try {
        wavBlob = await convertToWav(audioBlob)
        console.log('Converted to WAV, size:', wavBlob.size)
      } catch (conversionError) {
        console.warn('Could not convert to WAV, using original:', conversionError)
        wavBlob = audioBlob
      }
      
      // Convert to base64
      const arrayBuffer = await wavBlob.arrayBuffer()
      
      // Use FileReader for better binary handling
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          // Extract base64 part from data URL
          const base64Part = dataUrl.split(',')[1]
          if (base64Part) {
            resolve(base64Part)
          } else {
            reject(new Error('Failed to extract base64'))
          }
        }
        reader.onerror = () => reject(new Error('FileReader failed'))
        reader.readAsDataURL(wavBlob)
      })

      console.log('Base64 length:', base64.length)

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

      const data = await response.json()
      console.log('ASR response:', data)

      if (!response.ok) {
        throw new Error(data.error || `ASR request failed with status ${response.status}`)
      }

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
