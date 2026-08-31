// カーソルが乗っている $[...] のパラメータをその場で調整するパネル。

import { Fragment } from 'react'
import { DECO_BY_FN, type DecoParam } from '../lib/decorations'
import type { FnArgs, FnSpan } from '../lib/mfmSyntax'

type Props = {
  span: FnSpan | null
  /** カーソルを囲む装飾（外側 → 内側）。入れ子のときはここから選び分ける。 */
  chain: FnSpan[]
  onSelectSpan: (span: FnSpan) => void
  onChangeArgs: (args: FnArgs) => void
  onUnwrap: () => void
}

function timeToNumber(value: string | true | undefined, def: string): number {
  const raw = typeof value === 'string' ? value : def
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

function hexToInputColor(value: string | true | undefined, def: string): string {
  const raw = typeof value === 'string' && value !== '' ? value : def
  if (raw === '') return '#3b82f6'
  const hex = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.slice(0, 6)
  return `#${hex.padEnd(6, '0')}`
}

export function ParamPanel({ span, chain, onSelectSpan, onChangeArgs, onUnwrap }: Props) {
  if (!span) {
    return <section className="params params-empty" />
  }

  const deco = DECO_BY_FN[span.name]
  const params: DecoParam[] = deco?.params ?? []

  const setArg = (key: string, value: string | true | undefined) => {
    const next: FnArgs = { ...span.args }
    if (value === undefined) delete next[key]
    else next[key] = value
    onChangeArgs(next)
  }

  const setFlagSet = (keys: string[], value: string) => {
    const next: FnArgs = { ...span.args }
    for (const k of keys) delete next[k]
    for (const k of value.split(',')) {
      if (k !== '') next[k] = true
    }
    onChangeArgs(next)
  }

  return (
    <section className="params">
      <header className="params-head">
        {chain.length > 1 ? (
          <div className="params-chain">
            {chain.map((s, i) => (
              <Fragment key={s.start}>
                {i > 0 ? (
                  <span className="params-chain-sep" aria-hidden="true">
                    ›
                  </span>
                ) : null}
                <button
                  type="button"
                  className={`params-crumb${s.start === span.start ? ' is-active' : ''}`}
                  title={`$[${s.head} …] を調整する`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSelectSpan(s)}
                >
                  {s.name}
                </button>
              </Fragment>
            ))}
          </div>
        ) : null}
        <code className="params-name">$[{span.head} …]</code>
        <button
          type="button"
          className="btn btn-ghost btn-sm params-unwrap"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onUnwrap}
          title="この装飾だけを外す"
        >
          解除
        </button>
      </header>

      {params.length === 0 ? (
        <p className="params-note">この装飾に調整できる値はありません。</p>
      ) : (
        <div className="params-body">
          {params.map((param) => {
            if (param.kind === 'time') {
              const n = timeToNumber(span.args[param.key], param.def)
              return (
                <label key={param.key} className="param">
                  <span className="param-label">{param.label}</span>
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={n}
                    onChange={(e) => setArg(param.key, `${e.target.value}s`)}
                  />
                  <span className="param-value">{n}s</span>
                </label>
              )
            }
            if (param.kind === 'number') {
              const raw = span.args[param.key]
              const n = typeof raw === 'string' ? Number.parseFloat(raw) : param.def
              return (
                <label key={param.key} className="param">
                  <span className="param-label">{param.label}</span>
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={Number.isFinite(n) ? n : param.def}
                    onChange={(e) => setArg(param.key, e.target.value)}
                  />
                  <span className="param-value">{Number.isFinite(n) ? n : param.def}</span>
                </label>
              )
            }
            if (param.kind === 'color') {
              const current = span.args[param.key]
              return (
                <label key={param.key} className="param">
                  <span className="param-label">{param.label}</span>
                  <input
                    type="color"
                    value={hexToInputColor(current, param.def)}
                    onChange={(e) => setArg(param.key, e.target.value.replace('#', ''))}
                  />
                  <input
                    className="param-text"
                    type="text"
                    inputMode="text"
                    placeholder={param.def || 'f00'}
                    value={typeof current === 'string' ? current : ''}
                    onChange={(e) => setArg(param.key, e.target.value.replace('#', '') || undefined)}
                  />
                </label>
              )
            }
            if (param.kind === 'select') {
              const current = span.args[param.key]
              return (
                <label key={param.key} className="param">
                  <span className="param-label">{param.label}</span>
                  <select
                    value={typeof current === 'string' ? current : param.def}
                    onChange={(e) => setArg(param.key, e.target.value)}
                  >
                    {param.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )
            }
            if (param.kind === 'flagSet') {
              const current = param.keys.filter((k) => span.args[k] === true).join(',')
              return (
                <label key={param.id} className="param">
                  <span className="param-label">{param.label}</span>
                  <select value={current} onChange={(e) => setFlagSet(param.keys, e.target.value)}>
                    {param.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )
            }
            return (
              <label key={param.key} className="param param-toggle">
                <input
                  type="checkbox"
                  checked={span.args[param.key] === true}
                  onChange={(e) => setArg(param.key, e.target.checked ? true : undefined)}
                />
                <span className="param-label">{param.label}</span>
              </label>
            )
          })}
        </div>
      )}
    </section>
  )
}
