import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Redo2, Settings as SettingsIcon, Smile, Undo2 } from 'lucide-react'
import { Toolbar } from './components/Toolbar'
import { Preview } from './components/Preview'
import { ParamPanel } from './components/ParamPanel'
import { EmojiPicker } from './components/EmojiPicker'
import { SettingsModal } from './components/SettingsModal'
import type { Deco } from './lib/decorations'
import {
  applyTemplate,
  emojiTokenAt,
  insertText,
  toggleLinePrefix,
  wrapSelection,
  type Edit,
} from './lib/apply'
import { buildFnHead, enclosingFnChain, replaceFnArgs, unwrapFn, type FnArgs, type FnSpan } from './lib/mfmSyntax'
import { buildEmojiMap, loadEmojis, type Emoji } from './lib/emoji'
import {
  DEFAULT_SETTINGS,
  loadDraft,
  loadRecentEmoji,
  loadSettings,
  pushRecentEmoji,
  saveDraft,
  saveSettings,
  type Settings,
} from './lib/storage'

const TEXT_LIMIT = 3000
/** 取り消し履歴の上限と、連続操作を 1 手にまとめる間隔 */
const HISTORY_LIMIT = 100
const COALESCE_MS = 800

type Snapshot = { text: string; selStart: number; selEnd: number }

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [text, setText] = useState<string>(() => loadDraft())
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  /** パラメータパネルが掴んでいる fn の開始位置。null なら「最も内側」を自動で選ぶ。 */
  const [pinnedFnStart, setPinnedFnStart] = useState<number | null>(null)
  const [emojis, setEmojis] = useState<Emoji[]>([])
  const [emojiFetchedAt, setEmojiFetchedAt] = useState<number | null>(null)
  const [emojiLoading, setEmojiLoading] = useState(false)
  const [emojiError, setEmojiError] = useState<string | null>(null)
  const [recent, setRecent] = useState<string[]>(() => loadRecentEmoji())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelection = useRef<{ start: number; end: number; focus: boolean } | null>(null)
  /** クリックで自動選択した絵文字。同じ所をもう一度押したらキャレットを置かせる。 */
  const autoSelected = useRef<{ start: number; end: number } | null>(null)
  /**
   * 取り消し／やり直しの履歴。ブラウザ標準の undo は、React が値を差し替える
   * 装飾ボタンやスライダーの操作で壊れてしまうので自前で持つ。
   */
  const historyRef = useRef<{
    past: Snapshot[]
    future: Snapshot[]
    lastKind: string | null
    lastAt: number
  }>({ past: [], future: [], lastKind: null, lastAt: 0 })
  /** ボタンの活性だけを state に写す（履歴の実体は ref 側） */
  const [history, setHistory] = useState({ canUndo: false, canRedo: false })
  const syncHistory = useCallback(() => {
    const h = historyRef.current
    setHistory({ canUndo: h.past.length > 0, canRedo: h.future.length > 0 })
  }, [])

  // ── 保存 ────────────────────────────────────────────────
  useEffect(() => {
    const id = window.setTimeout(() => saveDraft(text), 400)
    return () => window.clearTimeout(id)
  }, [text])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  // ── 絵文字の取得 ────────────────────────────────────────
  const fetchEmoji = useCallback(
    async (host: string, force: boolean) => {
      setEmojiLoading(true)
      setEmojiError(null)
      try {
        const result = await loadEmojis(host, force)
        setEmojis(result.emojis)
        setEmojiFetchedAt(result.fetchedAt)
        if (result.warning) setEmojiError(result.warning)
      } catch (err) {
        setEmojis([])
        setEmojiFetchedAt(null)
        setEmojiError((err as Error).message)
      } finally {
        setEmojiLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void fetchEmoji(settings.host, false)
  }, [settings.host, fetchEmoji])

  const emojiMap = useMemo(() => buildEmojiMap(emojis), [emojis])

  // ── 選択範囲の復元 ──────────────────────────────────────
  useLayoutEffect(() => {
    const pending = pendingSelection.current
    const el = textareaRef.current
    if (!pending || !el) return
    pendingSelection.current = null
    setSelection({ start: pending.start, end: pending.end })
    // スライダー操作中に入力欄へ触ると、スクロールが走ってドラッグが外れる
    if (!pending.focus) return
    el.focus()
    el.setSelectionRange(pending.start, pending.end)
  }, [text])

  /**
   * 取り消し履歴に「今の状態」を積む。
   * kind が前回と同じで、かつ間が空いていなければ 1 手にまとめる
   * （1 文字ずつ・スライダー 1 目盛りずつ戻さないため）。kind が null なら必ず 1 手として積む。
   */
  const record = useCallback(
    (kind: string | null) => {
      const h = historyRef.current
      const now = performance.now()
      const merge = kind !== null && kind === h.lastKind && now - h.lastAt < COALESCE_MS
      if (!merge) {
        h.past.push({ text, selStart: selection.start, selEnd: selection.end })
        if (h.past.length > HISTORY_LIMIT) h.past.shift()
      }
      h.future = []
      h.lastKind = kind
      h.lastAt = now
      syncHistory()
    },
    [selection.end, selection.start, syncHistory, text],
  )

  /** 履歴に積まずにテキストを差し替える。全ての編集はここを通る。 */
  const applyEdit = useCallback(
    (edit: Edit, focus = true, pin: number | null = null, kind?: string | null) => {
      if (kind !== undefined) record(kind)
      pendingSelection.current = { start: edit.selStart, end: edit.selEnd, focus }
      autoSelected.current = null
      setPinnedFnStart(pin)
      setText(edit.text)
    },
    [record],
  )

  const undo = useCallback(() => {
    const h = historyRef.current
    const prev = h.past.pop()
    if (!prev) return
    h.future.push({ text, selStart: selection.start, selEnd: selection.end })
    h.lastKind = null
    syncHistory()
    applyEdit({ text: prev.text, selStart: prev.selStart, selEnd: prev.selEnd })
  }, [applyEdit, selection.end, selection.start, syncHistory, text])

  const redo = useCallback(() => {
    const h = historyRef.current
    const next = h.future.pop()
    if (!next) return
    h.past.push({ text, selStart: selection.start, selEnd: selection.end })
    h.lastKind = null
    syncHistory()
    applyEdit({ text: next.text, selStart: next.selStart, selEnd: next.selEnd })
  }, [applyEdit, selection.end, selection.start, syncHistory, text])

  /** 入力欄側の操作で選択が動いたとき。パネルの掴み直しもここで解除する。 */
  const syncSelection = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    setPinnedFnStart(null)
    setSelection({ start: el.selectionStart, end: el.selectionEnd })
  }, [])

  /**
   * `:emoji:` の上をクリックしたら、そのトークンごと選択する。
   * そのまま装飾ボタンを押せば絵文字 1 個だけを囲める。
   * 同じトークンをもう一度クリックしたときは素通しして、キャレットを置けるようにする。
   */
  const handleClickEditor = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    const caret = el.selectionStart
    if (caret === el.selectionEnd) {
      const token = emojiTokenAt(text, caret)
      const prev = autoSelected.current
      if (token && !(prev && prev.start === token.start && prev.end === token.end)) {
        el.setSelectionRange(token.start, token.end)
        autoSelected.current = token
        syncSelection()
        return
      }
    }
    autoSelected.current = null
    syncSelection()
  }, [syncSelection, text])

  /** 入力欄が今フォーカスされていればその選択、そうでなければ最後に覚えた選択を使う。 */
  const readSelection = useCallback(() => {
    const el = textareaRef.current
    if (el && document.activeElement === el) {
      return { start: el.selectionStart, end: el.selectionEnd }
    }
    return selection
  }, [selection])

  // ── 装飾の適用 ──────────────────────────────────────────
  const handlePick = useCallback(
    (deco: Deco) => {
      const { start, end } = readSelection()
      const insert = deco.insert

      if (insert.type === 'wrap') {
        applyEdit(wrapSelection(text, start, end, insert.before, insert.after), true, null, null)
        return
      }
      if (insert.type === 'linePrefix') {
        applyEdit(toggleLinePrefix(text, start, end, insert.prefix), true, null, null)
        return
      }
      if (insert.type === 'template') {
        applyEdit(applyTemplate(text, start, end, insert.template, insert.placeholders), true, null, null)
        return
      }
      const head = buildFnHead(insert.name, deco.initialArgs ?? {})
      applyEdit(wrapSelection(text, start, end, `$[${head} `, ']'), true, null, null)
    },
    [applyEdit, readSelection, text],
  )

  // ── カーソル位置の装飾 ──────────────────────────────────
  /** カーソルを囲む装飾を外側から内側の順に。入れ子はパネルのタブで選び分ける。 */
  const fnChain = useMemo(
    () => enclosingFnChain(text, selection.start, selection.end),
    [text, selection.start, selection.end],
  )

  const currentSpan = useMemo(() => {
    if (pinnedFnStart !== null) {
      const pinned = fnChain.find((s) => s.start === pinnedFnStart)
      if (pinned) return pinned
    }
    return fnChain.at(-1) ?? null
  }, [fnChain, pinnedFnStart])

  const handleChangeArgs = useCallback(
    (args: FnArgs, changedKey: string) => {
      if (!currentSpan) return
      const result = replaceFnArgs(text, currentSpan, args)
      // 引数の長さが変わってもキャレットは元の場所に留める。
      // contentStart へ飛ばすと、そこが内側の fn の開始位置と重なって
      // パネルが内側（scale など）に切り替わってしまう。
      const headStart = currentSpan.start + 2
      const oldHeadEnd = headStart + currentSpan.head.length
      const newHeadEnd = headStart + result.span.head.length
      const shift = (pos: number) => {
        if (pos <= headStart) return pos
        if (pos >= oldHeadEnd) return pos + (newHeadEnd - oldHeadEnd)
        return Math.min(pos, newHeadEnd)
      }
      // スライダー操作中に入力欄へフォーカスを奪わない。掴んでいる fn は保つ。
      // 同じつまみを続けて動かしている間は取り消し履歴を 1 手にまとめる。
      applyEdit(
        { text: result.text, selStart: shift(selection.start), selEnd: shift(selection.end) },
        false,
        currentSpan.start,
        `param:${currentSpan.start}:${changedKey}`,
      )
    },
    [applyEdit, currentSpan, selection.end, selection.start, text],
  )

  const handleUnwrap = useCallback(() => {
    if (!currentSpan) return
    applyEdit(unwrapFn(text, currentSpan), true, null, null)
  }, [applyEdit, currentSpan, text])

  const handleSelectFn = useCallback((span: FnSpan) => {
    setPinnedFnStart(span.start)
  }, [])

  // ── 絵文字の挿入 ────────────────────────────────────────
  const handlePickEmoji = useCallback(
    (name: string) => {
      const { start, end } = readSelection()
      applyEdit(insertText(text, start, end, `:${name}:`), true, null, null)
      setRecent(pushRecentEmoji(name))
      setPickerOpen(false)
    },
    [applyEdit, readSelection, text],
  )

  // ── 出力 ────────────────────────────────────────────────
  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2000)
  }, [])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('構文をコピーしました')
    } catch {
      const el = textareaRef.current
      el?.select()
      showToast('コピーできませんでした。Ctrl+C を押してください')
    }
  }, [showToast, text])

  const handleShare = useCallback(() => {
    const url = `https://${settings.host}/share?text=${encodeURIComponent(text)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [settings.host, text])

  const handleClear = useCallback(() => {
    if (text === '') return // 変化しない編集を履歴に積まない
    if (text.trim() !== '' && !window.confirm('入力内容を消します。よろしいですか？')) return
    applyEdit({ text: '', selStart: 0, selEnd: 0 }, true, null, null)
  }, [applyEdit, text])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      const el = e.currentTarget
      if (key === 'b') {
        e.preventDefault()
        applyEdit(wrapSelection(text, el.selectionStart, el.selectionEnd, '**', '**'), true, null, null)
      } else if (key === 'i') {
        e.preventDefault()
        applyEdit(wrapSelection(text, el.selectionStart, el.selectionEnd, '<i>', '</i>'), true, null, null)
      }
    },
    [applyEdit, text],
  )

  // Ctrl+Z / Ctrl+Y（Ctrl+Shift+Z）。スライダーを触った直後でも効くよう window で拾い、
  // 絵文字検索や設定の入力欄ではブラウザ標準の取り消しに任せる。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.isComposing) return
      const key = e.key.toLowerCase()
      if (key !== 'z' && key !== 'y') return
      if (pickerOpen || settingsOpen) return
      const el = e.target as HTMLElement | null
      if (el && el !== textareaRef.current) {
        if (el.isContentEditable) return
        if (el instanceof HTMLInputElement && el.type !== 'range' && el.type !== 'color') return
      }
      e.preventDefault()
      if (key === 'y' || e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pickerOpen, redo, settingsOpen, undo])

  const overLimit = text.length > TEXT_LIMIT

  return (
    <div className="app" data-theme={settings.theme}>
      <header className="app-header">
        <h1 className="app-title">
          Deco<span className="app-title-accent">skey</span>
        </h1>
        <span className="app-host" title="絵文字の取得元">
          {settings.host}
          {emojiLoading ? '（絵文字取得中…）' : emojis.length > 0 ? `（絵文字 ${emojis.length.toLocaleString('ja-JP')}）` : ''}
        </span>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setSettingsOpen(true)}
          title="設定"
          aria-label="設定"
        >
          <SettingsIcon size={19} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </header>

      <div className="shell">
        <section className="card">
          <Toolbar
            onPick={handlePick}
            animateSamples={settings.animateSamples}
            useAnim={settings.useAnim}
            advanced={settings.advanced}
          />
          <textarea
            ref={textareaRef}
            className="editor"
            value={text}
            spellCheck={false}
            placeholder="ここに文章を書いて、装飾したい部分を選んでからボタンを押します"
            onChange={(e) => {
              record('type')
              autoSelected.current = null
              setPinnedFnStart(null)
              setText(e.target.value)
              setSelection({ start: e.target.selectionStart, end: e.target.selectionEnd })
            }}
            onSelect={syncSelection}
            onClick={handleClickEditor}
            onKeyUp={syncSelection}
            onKeyDown={handleKeyDown}
          />
          <div className="editor-bar">
            <div className="editor-bar-group">
              <button
                type="button"
                className="icon-btn"
                disabled={!history.canUndo}
                onMouseDown={(e) => e.preventDefault()}
                onClick={undo}
                title="元に戻す (Ctrl+Z)"
                aria-label="元に戻す"
              >
                <Undo2 size={20} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-btn"
                disabled={!history.canRedo}
                onMouseDown={(e) => e.preventDefault()}
                onClick={redo}
                title="やり直す (Ctrl+Y)"
                aria-label="やり直す"
              >
                <Redo2 size={20} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              className="icon-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setPickerOpen(true)}
              title="カスタム絵文字を挿入"
              aria-label="カスタム絵文字を挿入"
            >
              <Smile size={21} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
          <ParamPanel
            span={currentSpan}
            chain={fnChain}
            onSelectSpan={handleSelectFn}
            onChangeArgs={handleChangeArgs}
            onUnwrap={handleUnwrap}
          />
        </section>

        <section className="card card-preview">
          <div className="card-head">
            <span>プレビュー</span>
            <span className={`counter${overLimit ? ' is-over' : ''}`}>
              {text.length.toLocaleString('ja-JP')} / {TEXT_LIMIT.toLocaleString('ja-JP')}
            </span>
          </div>
          <Preview
            text={text}
            emojiMap={emojiMap}
            useAnim={settings.useAnim}
            advanced={settings.advanced}
            emojiLoading={emojiLoading}
          />
        </section>
      </div>

      <footer className="actionbar">
        <button type="button" className="btn btn-ghost" onClick={handleClear}>
          クリア
        </button>
        <div className="actionbar-main">
          <button type="button" className="btn btn-primary" onClick={handleCopy}>
            構文をコピー
          </button>
          <button type="button" className="btn btn-outline" onClick={handleShare}>
            {settings.host} で投稿
          </button>
        </div>
      </footer>

      {toast ? <div className="toast">{toast}</div> : null}

      {pickerOpen ? (
        <EmojiPicker
          emojis={emojis}
          recent={recent}
          loading={emojiLoading}
          error={emojiError}
          host={settings.host}
          size={settings.emojiSize}
          onChangeSize={(size) => setSettings({ ...settings, emojiSize: size })}
          onPick={handlePickEmoji}
          onClose={() => setPickerOpen(false)}
          onReload={() => void fetchEmoji(settings.host, true)}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsModal
          settings={settings}
          emojiCount={emojis.length}
          fetchedAt={emojiFetchedAt}
          loading={emojiLoading}
          onChange={(next) => setSettings({ ...DEFAULT_SETTINGS, ...next })}
          onReloadEmoji={() => void fetchEmoji(settings.host, true)}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  )
}
