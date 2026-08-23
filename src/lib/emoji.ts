// カスタム絵文字の取得と IndexedDB キャッシュ。
// misskey.io は 13,000 件以上・3MB 超あるので localStorage には収まらない。

export type Emoji = {
  name: string
  url: string
  category: string | null
  aliases: string[]
}

export type EmojiCache = {
  host: string
  fetchedAt: number
  emojis: Emoji[]
}

const DB_NAME = 'decoskey'
const DB_VERSION = 1
const STORE = 'cache'
const TTL_MS = 24 * 60 * 60 * 1000

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb()
    return await new Promise<T | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return undefined
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // キャッシュに書けなくても動作は続ける
  }
}

async function fetchEmojis(host: string): Promise<Emoji[]> {
  // Content-Type を付けると CORS プリフライトが発生して弾かれるため、
  // 単純リクエストになる GET を使い、駄目なら本文なしの POST で再試行する。
  const url = import.meta.env.DEV ? `/misskey-api/${host}/api/emojis` : `https://${host}/api/emojis`
  let res = await fetch(url, { method: 'GET' })
  if (!res.ok) res = await fetch(url, { method: 'POST' })
  if (!res.ok) throw new Error(`${host} からの取得に失敗しました (HTTP ${res.status})`)
  const data = (await res.json()) as { emojis?: Emoji[] }
  if (!Array.isArray(data.emojis)) throw new Error(`${host} の応答を解釈できませんでした`)
  return data.emojis.map((e) => ({
    name: e.name,
    url: e.url,
    category: e.category ?? null,
    aliases: Array.isArray(e.aliases) ? e.aliases.filter((a) => a !== '') : [],
  }))
}

export type LoadResult = {
  emojis: Emoji[]
  fetchedAt: number
  /** キャッシュから復帰した場合 true */
  fromCache: boolean
  /** 取得に失敗してキャッシュで代用した場合のメッセージ */
  warning?: string
}

export async function loadEmojis(host: string, force = false): Promise<LoadResult> {
  const key = `emojis:${host}`
  const cached = await idbGet<EmojiCache>(key)
  const fresh = cached != null && Date.now() - cached.fetchedAt < TTL_MS

  if (cached && fresh && !force) {
    return { emojis: cached.emojis, fetchedAt: cached.fetchedAt, fromCache: true }
  }

  try {
    const emojis = await fetchEmojis(host)
    const fetchedAt = Date.now()
    await idbSet(key, { host, fetchedAt, emojis } satisfies EmojiCache)
    return { emojis, fetchedAt, fromCache: false }
  } catch (err) {
    if (cached) {
      return {
        emojis: cached.emojis,
        fetchedAt: cached.fetchedAt,
        fromCache: true,
        warning: `最新の絵文字を取得できなかったので保存済みの一覧を使っています（${(err as Error).message}）`,
      }
    }
    throw err
  }
}

export function buildEmojiMap(emojis: Emoji[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const e of emojis) map.set(e.name, e.url)
  return map
}

/** 名前とエイリアスの部分一致で絞り込む。名前の前方一致を優先して並べる。 */
export function searchEmojis(emojis: Emoji[], query: string): Emoji[] {
  const q = query.trim().toLowerCase()
  if (q === '') return emojis
  const starts: Emoji[] = []
  const includes: Emoji[] = []
  for (const e of emojis) {
    const name = e.name.toLowerCase()
    if (name.startsWith(q)) {
      starts.push(e)
    } else if (name.includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q))) {
      includes.push(e)
    }
  }
  return [...starts, ...includes]
}

export function listCategories(emojis: Emoji[]): string[] {
  const set = new Set<string>()
  for (const e of emojis) set.add(e.category ?? 'その他')
  return [...set].sort((a, b) => a.localeCompare(b, 'ja'))
}
