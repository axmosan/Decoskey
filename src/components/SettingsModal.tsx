// 設定。サーバー・プレビューの再現条件・見本の動きを切り替える。

import { useState } from 'react'
import type { Settings } from '../lib/storage'

type Props = {
  settings: Settings
  emojiCount: number
  fetchedAt: number | null
  loading: boolean
  onChange: (settings: Settings) => void
  onReloadEmoji: () => void
  onClose: () => void
}

export function SettingsModal({
  settings,
  emojiCount,
  fetchedAt,
  loading,
  onChange,
  onReloadEmoji,
  onClose,
}: Props) {
  const [host, setHost] = useState(settings.host)

  const applyHost = () => {
    const next = host.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (next !== '' && next !== settings.host) onChange({ ...settings, host: next })
    else setHost(settings.host)
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal settings-modal" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>設定</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            閉じる
          </button>
        </header>

        <div className="settings-body">
          <label className="setting">
            <span className="setting-label">絵文字を読み込むサーバー</span>
            <span className="setting-row">
              <input
                type="text"
                value={host}
                placeholder="misskey.io"
                onChange={(e) => setHost(e.target.value)}
                onBlur={applyHost}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyHost()
                }}
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={onReloadEmoji} disabled={loading}>
                {loading ? '取得中…' : '再取得'}
              </button>
            </span>
            <span className="setting-note">
              {emojiCount > 0
                ? `${emojiCount.toLocaleString('ja-JP')} 件を読み込み済み${
                    fetchedAt ? `（${new Date(fetchedAt).toLocaleString('ja-JP')} 取得）` : ''
                  }`
                : '絵文字は未取得です'}
            </span>
          </label>

          <label className="setting setting-check">
            <input
              type="checkbox"
              checked={settings.useAnim}
              onChange={(e) => onChange({ ...settings, useAnim: e.target.checked })}
            />
            <span>
              <span className="setting-label">動きのある MFM を再現する</span>
              <span className="setting-note">
                受け取り手がこの設定を切っていると、アニメーションは止まって見えます。
              </span>
            </span>
          </label>

          <label className="setting setting-check">
            <input
              type="checkbox"
              checked={settings.advanced}
              onChange={(e) => onChange({ ...settings, advanced: e.target.checked })}
            />
            <span>
              <span className="setting-label">高度な MFM を再現する</span>
              <span className="setting-note">x2〜x4・scale・position の効き方が変わります。</span>
            </span>
          </label>

          <label className="setting setting-check">
            <input
              type="checkbox"
              checked={settings.animateSamples}
              onChange={(e) => onChange({ ...settings, animateSamples: e.target.checked })}
            />
            <span>
              <span className="setting-label">ボタンの見本を動かす</span>
              <span className="setting-note">切ると、ボタンにカーソルを乗せた時だけ動きます。</span>
            </span>
          </label>

          <div className="setting">
            <span className="setting-label">テーマ</span>
            <span className="setting-note">Misskey の Mi Dark / Mi Light と同じ配色です。</span>
            <div className="segmented">
              {(['dark', 'light'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`segmented-item${settings.theme === t ? ' is-active' : ''}`}
                  onClick={() => onChange({ ...settings, theme: t })}
                >
                  {t === 'dark' ? 'ダーク' : 'ライト'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
