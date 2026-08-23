// 装飾ボタン群。ボタンの中身は構文名そのものに当の装飾を掛けた見本。

import { useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Smile } from 'lucide-react'
import { CATEGORIES, DECORATIONS, type CategoryId, type Deco } from '../lib/decorations'
import { MfmView } from '../lib/mfmRender'

type Props = {
  onPick: (deco: Deco) => void
  onOpenEmoji: () => void
  animateSamples: boolean
  useAnim: boolean
  advanced: boolean
}

/** ボタンにフォーカスを渡さず、入力欄の選択範囲を保ったままにする。 */
const keepSelection = (e: ReactMouseEvent) => e.preventDefault()

export function Toolbar({ onPick, onOpenEmoji, animateSamples, useAnim, advanced }: Props) {
  const [category, setCategory] = useState<CategoryId>('basic')
  const decos = DECORATIONS.filter((d) => d.category === category)

  return (
    <section className="toolbar">
      <div className="toolbar-tabs" role="tablist">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            className={`tab${category === c.id ? ' is-active' : ''}`}
            onMouseDown={keepSelection}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          className="tab tab-emoji"
          onMouseDown={keepSelection}
          onClick={onOpenEmoji}
          title="カスタム絵文字を挿入"
          aria-label="カスタム絵文字を挿入"
        >
          <Smile size={20} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>

      <div className={`deco-grid${animateSamples ? '' : ' is-frozen'}`}>
        {decos.map((deco) => (
          <button
            key={deco.id}
            type="button"
            className="deco-btn"
            title={deco.title}
            onMouseDown={keepSelection}
            onClick={() => onPick(deco)}
          >
            <span className="deco-sample" style={{ fontSize: `${(deco.sampleScale ?? 1) * 15}px` }}>
              <MfmView
                className="mfm"
                text={deco.sample ?? deco.token}
                useAnim={useAnim}
                advanced={advanced}
              />
            </span>
            {deco.advanced && !advanced ? <span className="deco-badge" title="「高度なMFM」が必要">高</span> : null}
            {deco.animated && !useAnim ? <span className="deco-badge" title="「動きのあるMFM」が必要">動</span> : null}
          </button>
        ))}
      </div>
    </section>
  )
}
