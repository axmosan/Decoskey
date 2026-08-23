// 設定・下書き・よく使う絵文字の保存（localStorage）。

export type Settings = {
  /** 絵文字を取りに行くサーバー */
  host: string
  /** 「動きのある MFM」を再現するか */
  useAnim: boolean
  /** 「高度な MFM」を再現するか */
  advanced: boolean
  /** 画面全体のテーマ（Misskey の Mi Dark / Mi Light 相当） */
  theme: 'dark' | 'light'
  /** 装飾ボタンの見本を動かすか */
  animateSamples: boolean
  /** 絵文字ピッカーの1マスの大きさ（px） */
  emojiSize: number
}

export const DEFAULT_SETTINGS: Settings = {
  host: 'misskey.io',
  useAnim: true,
  advanced: true,
  theme: 'dark',
  animateSamples: true,
  emojiSize: 46,
}

const KEY_SETTINGS = 'decoskey.settings'
const KEY_DRAFT = 'decoskey.draft'
const KEY_RECENT_EMOJI = 'decoskey.recentEmoji'
const RECENT_LIMIT = 32

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return { ...fallback, ...(JSON.parse(raw) as object) } as T
  } catch {
    return fallback
  }
}

export function loadSettings(): Settings {
  return read<Settings>(KEY_SETTINGS, DEFAULT_SETTINGS)
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings))
  } catch {
    /* 保存できなくても続行 */
  }
}

export function loadDraft(): string {
  try {
    return localStorage.getItem(KEY_DRAFT) ?? ''
  } catch {
    return ''
  }
}

export function saveDraft(text: string): void {
  try {
    localStorage.setItem(KEY_DRAFT, text)
  } catch {
    /* 保存できなくても続行 */
  }
}

export function loadRecentEmoji(): string[] {
  try {
    const raw = localStorage.getItem(KEY_RECENT_EMOJI)
    const list = raw == null ? [] : (JSON.parse(raw) as unknown)
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function pushRecentEmoji(name: string): string[] {
  const next = [name, ...loadRecentEmoji().filter((n) => n !== name)].slice(0, RECENT_LIMIT)
  try {
    localStorage.setItem(KEY_RECENT_EMOJI, JSON.stringify(next))
  } catch {
    /* 保存できなくても続行 */
  }
  return next
}
