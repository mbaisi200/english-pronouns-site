/**
 * Gerenciador de vozes com suporte multi-plataforma
 * Otimizado para iOS, Android, Windows, macOS e Linux
 */

export type Platform = 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown'

export interface VoiceProfile {
  voice: SpeechSynthesisVoice | null
  name: string
  platform: Platform
  language: string
  gender: 'male' | 'female'
}

/**
 * Detectar a plataforma do usuário
 */
export const detectPlatform = (): Platform => {
  if (typeof window === 'undefined') return 'unknown'

  const ua = navigator.userAgent.toLowerCase()

  if (/ipad|iphone|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  if (/windows|win32|win64|wow64/.test(ua)) return 'windows'
  if (/macintosh|mac os x/.test(ua)) return 'macos'
  if (/linux|x11/.test(ua)) return 'linux'

  return 'unknown'
}

/**
 * Palavras-chave para identificar vozes masculinas
 */
const MALE_VOICE_KEYWORDS = [
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
  'charles',
  'christopher',
  'edward',
  'frank',
  'henry',
  'john',
  'joseph',
  'paul',
  'peter',
  'robert',
  'thomas',
  'william',
  'ryan',
  'kevin',
  'eric',
  'jason',
  'matthew',
  'anthony',
  'donald',
  'steven',
  'paul',
  'andrew',
  'joshua',
  'kenneth',
  'kevin',
  'brian',
  'george',
  'edward',
  'ronald',
  'timothy',
  'jason',
  'jeffrey',
  'ryan',
  'jacob',
  'gary',
  'nicholas',
  'eric',
  'jonathan',
  'stephen',
  'larry',
  'justin',
  'scott',
  'brandon',
  'benjamin',
  'samuel',
  'frank',
  'gregory',
  'alexander',
  'raymond',
  'patrick',
  'jack',
  'dennis',
  'jerry',
  'tyler',
  'aaron',
  'jose',
  'adam',
  'henry',
  'douglas',
  'zachary',
  'peter',
  'kyle',
  'walter',
  'harold',
  'keith',
  'christian',
  'terry',
  'sean',
  'austin',
  'gerald',
  'carl',
  'roger',
  'keith',
  'samuel',
  'willie',
  'ralph',
  'lawrence',
  'nicholas',
  'roy',
  'benjamin',
  'bruce',
  'brandon',
  'adam',
  'harry',
  'fred',
  'wayne',
  'billy',
  'joe',
  'jesse',
  'christian',
  'john',
  'blaine',
  'juan',
  'gary',
  'edward',
  'che',
  'logan',
  'craig',
  'curtis',
  'ivan',
  'jared',
  'frederick',
  'samuel',
  'rick',
  'sascha',
  'alexander',
  'rory',
  'stefan',
  'bretton',
]

/**
 * Palavras-chave para identificar vozes femininas
 */
const FEMALE_VOICE_KEYWORDS = [
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
  'anna',
  'bella',
  'chloe',
  'diana',
  'eva',
  'grace',
  'hannah',
  'iris',
  'julia',
  'kara',
  'laura',
  'maria',
  'nora',
  'paula',
  'quinn',
  'rachel',
  'sarah',
  'tina',
  'ursula',
  'vanessa',
  'wendy',
  'xenia',
  'yasmine',
  'zara',
  'amber',
  'bianca',
  'crystal',
  'daisy',
  'eden',
  'faye',
  'georgia',
  'holly',
  'ivy',
  'jasmine',
  'kimberly',
  'lily',
  'maya',
  'natalie',
  'ophelia',
  'poppy',
  'quinn',
  'ruby',
  'stella',
  'tabitha',
  'unity',
  'violet',
  'willow',
  'xandra',
  'yara',
  'zoe',
  'allison',
  'brittany',
  'charlotte',
  'danielle',
  'elizabeth',
  'faith',
  'gabrielle',
  'heather',
  'iris',
  'jessica',
  'katherine',
  'lindsey',
  'michelle',
  'nicole',
  'olivia',
  'patricia',
  'quinn',
  'rachel',
  'stephanie',
  'tanya',
  'unity',
  'veronica',
  'whitney',
  'xenia',
  'yolanda',
  'zoe',
  'abigail',
  'bridget',
  'catherine',
  'donna',
  'emily',
  'felicity',
  'gloria',
  'helen',
  'iris',
  'joanna',
  'karen',
  'louise',
  'margaret',
  'nancy',
  'opal',
  'pamela',
  'rachel',
  'sandra',
  'teresa',
  'ursula',
  'veronica',
  'wendy',
  'xandra',
  'yvonne',
  'zara',
  'agnes',
  'barbara',
  'carol',
  'deborah',
  'eleanor',
  'frances',
  'gladys',
  'harriet',
  'iris',
  'joan',
  'katherine',
  'louise',
  'martha',
  'nancy',
  'olive',
  'phyllis',
  'rachel',
  'stella',
  'theresa',
  'ursula',
  'violet',
  'winifred',
  'xiomara',
  'yolanda',
  'zelda',
]

/**
 * Encontrar a melhor voz para um gênero específico
 */
export const findBestVoice = (
  voices: SpeechSynthesisVoice[],
  gender: 'male' | 'female',
  preferredLanguage: string = 'en'
): SpeechSynthesisVoice | null => {
  if (voices.length === 0) return null

  // Filtrar vozes no idioma preferido
  const preferredVoices = voices.filter(v => v.lang.startsWith(preferredLanguage))
  const searchVoices = preferredVoices.length > 0 ? preferredVoices : voices

  const keywords = gender === 'male' ? MALE_VOICE_KEYWORDS : FEMALE_VOICE_KEYWORDS

  // Procurar por palavra-chave (case-insensitive)
  for (const keyword of keywords) {
    const found = searchVoices.find(v =>
      v.name.toLowerCase().includes(keyword.toLowerCase())
    )
    if (found) return found
  }

  // Fallback: procurar por indicador de gênero no nome
  const genderIndicator = gender === 'male' ? 'male' : 'female'
  const genderMatch = searchVoices.find(v =>
    v.name.toLowerCase().includes(genderIndicator)
  )
  if (genderMatch) return genderMatch

  // Fallback: usar índice (geralmente primeira é feminina, segunda é masculina)
  const index = gender === 'male' ? Math.min(1, searchVoices.length - 1) : 0
  return searchVoices[index] || searchVoices[0]
}

/**
 * Obter todas as vozes em inglês
 */
export const getEnglishVoices = (
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice[] => {
  return voices.filter(v => v.lang.startsWith('en'))
}

/**
 * Obter vozes por gênero
 */
export const getVoicesByGender = (
  voices: SpeechSynthesisVoice[],
  gender: 'male' | 'female'
): SpeechSynthesisVoice[] => {
  const keywords = gender === 'male' ? MALE_VOICE_KEYWORDS : FEMALE_VOICE_KEYWORDS

  return voices.filter(voice =>
    keywords.some(keyword =>
      voice.name.toLowerCase().includes(keyword.toLowerCase())
    )
  )
}

/**
 * Obter nome curto da voz (primeira palavra)
 */
export const getShortVoiceName = (voice: SpeechSynthesisVoice | null): string => {
  if (!voice) return 'Default'
  const parts = voice.name.split(' ')
  return parts[0] || voice.name
}

/**
 * Validar se a plataforma suporta Web Speech API
 */
export const isWebSpeechSupported = (): boolean => {
  if (typeof window === 'undefined') return false

  const synth = window.speechSynthesis
  const SpeechSynthesisUtterance =
    window.SpeechSynthesisUtterance || (window as any).webkitSpeechSynthesisUtterance

  return !!(synth && SpeechSynthesisUtterance)
}

/**
 * Obter informações sobre o suporte de vozes por plataforma
 */
export const getPlatformVoiceInfo = (platform: Platform): string => {
  const info: Record<Platform, string> = {
    ios: 'iOS suporta vozes nativas do Siri. Pode levar tempo para carregar.',
    android: 'Android usa vozes do Google Text-to-Speech. Qualidade varia por dispositivo.',
    windows: 'Windows oferece vozes nativas de alta qualidade.',
    macos: 'macOS oferece vozes nativas excelentes.',
    linux: 'Linux pode ter suporte limitado. Instale espeak ou festival para melhor compatibilidade.',
    unknown: 'Plataforma desconhecida. Suporte de vozes pode variar.',
  }

  return info[platform]
}

/**
 * Criar perfil de voz
 */
export const createVoiceProfile = (
  voice: SpeechSynthesisVoice | null,
  gender: 'male' | 'female'
): VoiceProfile => {
  const platform = detectPlatform()
  const language = voice?.lang || 'en-US'
  const name = voice?.name || (gender === 'male' ? 'Default Male' : 'Default Female')

  return {
    voice,
    name,
    platform,
    language,
    gender,
  }
}
