// カスタム絵文字ピッカー。
// ・入力はデバウンスし、モーダルの高さは固定なので打つたびに画面が動かない
// ・スクロールで継ぎ足し読み込みするので件数制限はない

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { listCategories, searchEmojis, type Emoji } from '../lib/emoji'

type Props = {
  emojis: Emoji[]
  recent: string[]
  loading: boolean
  error: string | null
  host: string
  size: number
  onChangeSize: (size: number) => void
  onPick: (name: string) => void
  onClose: () => void
  onReload: () => void
}

const BATCH = 200
const DEBOUNCE_MS = 180

export function EmojiPicker({
  emojis,
  recent,
  loading,
  error,
  host,
  size,
  onChangeSize,
  onPick,
  onClose,
  onReload,
}: Props) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [category, setCategory] = useState('')
  const [visibleCount, setVisibleCount] = useState(BATCH)
  const inputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [query])

  const categories = useMemo(() => listCategories(emojis), [emojis])
  const byName = useMemo(() => new Map(emojis.map((e) => [e.name, e])), [emojis])

  const filtered = useMemo(() => {
    const base = category === '' ? emojis : emojis.filter((e) => (e.category ?? 'その他') === category)
    return searchEmojis(base, debounced)
  }, [emojis, category, debounced])

  // 条件が変わったら先頭に戻して読み込み量もリセットする
  useEffect(() => {
    setVisibleCount(BATCH)
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [debounced, category])

  // 末尾が見えたら継ぎ足す
  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = bodyRef.current
    if (!sentinel || !root) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => (count >= filtered.length ? count : count + BATCH))
        }
      },
      { root, rootMargin: '300px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [filtered.length])

  const shown = filtered.slice(0, visibleCount)
  const showRecent = debounced === '' && category === ''
  const recentEmojis = showRecent
    ? recent.map((name) => byName.get(name)).filter((e): e is Emoji => e != null)
    : []

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal emoji-modal" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <input
            ref={inputRef}
            className="emoji-search"
            type="search"
            placeholder="絵文字を名前で検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="emoji-category">
            <option value="">すべてのカテゴリ</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            閉じる
          </button>
        </header>

        <div className="emoji-subhead">
          <label className="emoji-size">
            <span className="param-label">大きさ</span>
            <input
              type="range"
              min={32}
              max={128}
              step={4}
              value={size}
              onChange={(e) => onChangeSize(Number(e.target.value))}
            />
            <span className="param-value">{size}px</span>
          </label>
        </div>

        <div className="emoji-body" ref={bodyRef} style={{ '--emoji-size': `${size}px` } as CSSProperties}>
          {loading ? <p className="emoji-note">{host} の絵文字を読み込んでいます…</p> : null}
          {error ? (
            <p className="emoji-note emoji-error">
              {error}
              <button type="button" className="btn btn-ghost btn-sm" onClick={onReload}>
                再取得
              </button>
            </p>
          ) : null}

          {recentEmojis.length > 0 ? (
            <>
              <h3 className="emoji-heading">最近使った絵文字</h3>
              <div className="emoji-grid">
                {recentEmojis.map((e) => (
                  <EmojiCell key={`recent-${e.name}`} emoji={e} onPick={onPick} />
                ))}
              </div>
              <div className="emoji-divider" />
            </>
          ) : null}

          <h3 className="emoji-heading">
            {category === '' ? 'すべて' : category}
            <span className="emoji-count">{filtered.length.toLocaleString('ja-JP')} 件</span>
          </h3>
          <div className="emoji-grid">
            {shown.map((e) => (
              <EmojiCell key={e.name} emoji={e} onPick={onPick} />
            ))}
          </div>
          {!loading && filtered.length === 0 ? <p className="emoji-note">見つかりませんでした。</p> : null}
          <div className="emoji-sentinel" ref={sentinelRef} />
        </div>
      </div>
    </div>
  )
}

function EmojiCell({ emoji, onPick }: { emoji: Emoji; onPick: (name: string) => void }) {
  return (
    <button type="button" className="emoji-cell" title={`:${emoji.name}:`} onClick={() => onPick(emoji.name)}>
      <img src={emoji.url} alt={emoji.name} loading="lazy" decoding="async" />
    </button>
  )
}
