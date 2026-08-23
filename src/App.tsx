import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Settings as SettingsIcon, Smile } from 'lucide-react'
import { Toolbar } from './components/Toolbar'
import { Preview } from './components/Preview'
import { ParamPanel } from './components/ParamPanel'
import { EmojiPicker } from './components/EmojiPicker'
import { SettingsModal } from './components/SettingsModal'
import type { Deco } from './lib/decorations'
import { applyTemplate, insertText, toggleLinePrefix, wrapSelection, type Edit } from './lib/apply'
import { buildFnHead, findEnclosingFn, replaceFnArgs, unwrapFn, type FnArgs } from './lib/mfmSyntax'
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

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [text, setText] = useState<string>(() => loadDraft())
  const [selection, setSelection] = useState({ start: 0, end: 0 })
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

  const applyEdit = useCallback((edit: Edit, focus = true) => {
    pendingSelection.current = { start: edit.selStart, end: edit.selEnd, focus }
    setText(edit.text)
  }, [])

  const syncSelection = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    setSelection({ start: el.selectionStart, end: el.selectionEnd })
  }, [])

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
        applyEdit(wrapSelection(text, start, end, insert.before, insert.after))
        return
      }
      if (insert.type === 'linePrefix') {
        applyEdit(toggleLinePrefix(text, start, end, insert.prefix))
        return
      }
      if (insert.type === 'template') {
        applyEdit(applyTemplate(text, start, end, insert.template, insert.placeholders))
        return
      }
      const head = buildFnHead(insert.name, deco.initialArgs ?? {})
      applyEdit(wrapSelection(text, start, end, `$[${head} `, ']'))
    },
    [applyEdit, readSelection, text],
  )

  // ── カーソル位置の装飾 ──────────────────────────────────
  const currentSpan = useMemo(
    () => findEnclosingFn(text, selection.start, selection.end),
    [text, selection.start, selection.end],
  )

  const handleChangeArgs = useCallback(
    (args: FnArgs) => {
      if (!currentSpan) return
      const result = replaceFnArgs(text, currentSpan, args)
      // スライダー操作中に入力欄へフォーカスを奪わない
      applyEdit({ text: result.text, selStart: result.span.contentStart, selEnd: result.span.contentStart }, false)
    },
    [applyEdit, currentSpan, text],
  )

  const handleUnwrap = useCallback(() => {
    if (!currentSpan) return
    applyEdit(unwrapFn(text, currentSpan))
  }, [applyEdit, currentSpan, text])

  // ── 絵文字の挿入 ────────────────────────────────────────
  const handlePickEmoji = useCallback(
    (name: string) => {
      const { start, end } = readSelection()
      applyEdit(insertText(text, start, end, `:${name}:`))
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
    if (text.trim() !== '' && !window.confirm('入力内容を消します。よろしいですか？')) return
    applyEdit({ text: '', selStart: 0, selEnd: 0 })
  }, [applyEdit, text])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      const el = e.currentTarget
      if (key === 'b') {
        e.preventDefault()
        applyEdit(wrapSelection(text, el.selectionStart, el.selectionEnd, '**', '**'))
      } else if (key === 'i') {
        e.preventDefault()
        applyEdit(wrapSelection(text, el.selectionStart, el.selectionEnd, '<i>', '</i>'))
      }
    },
    [applyEdit, text],
  )

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
              setText(e.target.value)
              setSelection({ start: e.target.selectionStart, end: e.target.selectionEnd })
            }}
            onSelect={syncSelection}
            onClick={syncSelection}
            onKeyUp={syncSelection}
            onKeyDown={handleKeyDown}
          />
          <div className="editor-bar">
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
          <ParamPanel span={currentSpan} onChangeArgs={handleChangeArgs} onUnwrap={handleUnwrap} />
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
