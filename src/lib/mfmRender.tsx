// mfm-js の AST を React 要素に描画する。
// 各ファンクションの既定値・挙動は Misskey の仕様に合わせてある
// （tada は 150% 拡大、spin の既定は 1.5s / z 軸、rotate の既定は 90deg …）。

import { useMemo, type CSSProperties, type ReactNode } from 'react'
import * as mfm from 'mfm-js'

export type EmojiMap = Map<string, string>

export type MfmRenderOptions = {
  emojiMap?: EmojiMap
  /** 「動きのある MFM」相当。false でアニメーションを止める */
  useAnim?: boolean
  /** 「高度な MFM」相当。false で x2〜x4 / scale / position を無効化 */
  advanced?: boolean
}

const TIME_RE = /^-?[0-9.]+m?s$/
const COLOR_RE = /^[0-9a-f]{3,8}$/i

function validTime(value: string | true | undefined): string | null {
  return typeof value === 'string' && TIME_RE.test(value) ? value : null
}

function validColor(value: string | true | undefined): string | null {
  return typeof value === 'string' && COLOR_RE.test(value) ? value : null
}

function numArg(value: string | true | undefined, fallback: number): number {
  if (typeof value !== 'string') return fallback
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : fallback
}

function formatUnixtime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '-'
  const d = new Date(seconds * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

type Ctx = Required<Pick<MfmRenderOptions, 'useAnim' | 'advanced'>> & { emojiMap: EmojiMap }

function renderFn(node: mfm.MfmFn, ctx: Ctx, key: string): ReactNode {
  const { name, args } = node.props
  const children = renderNodes(node.children, ctx)
  let style: CSSProperties | null = null
  let className = ''

  const anim = (keyframes: string, defSpeed: string, timing = 'linear', extra: CSSProperties = {}) => {
    const speed = validTime(args.speed) ?? defSpeed
    const delay = validTime(args.delay) ?? '0s'
    return ctx.useAnim
      ? { animation: `${keyframes} ${speed} ${timing} infinite both`, animationDelay: delay, ...extra }
      : { ...extra }
  }

  switch (name) {
    case 'tada':
      style = { fontSize: '150%', ...anim('mfm-tada', '1s') }
      break
    case 'jelly':
      style = anim('mfm-jelly', '1s')
      break
    case 'twitch':
      style = anim('mfm-twitch', '0.5s', 'ease')
      break
    case 'shake':
      style = anim('mfm-shake', '0.5s', 'ease')
      break
    case 'jump':
      style = anim('mfm-jump', '0.75s')
      break
    case 'bounce':
      style = anim('mfm-bounce', '0.75s', 'linear', { transformOrigin: 'center bottom' })
      break
    case 'spin': {
      const keyframes = args.x ? 'mfm-spin-x' : args.y ? 'mfm-spin-y' : 'mfm-spin'
      const direction = args.left ? 'reverse' : args.alternate ? 'alternate' : 'normal'
      style = { ...anim(keyframes, '1.5s'), animationDirection: direction }
      break
    }
    case 'rainbow': {
      if (!ctx.useAnim) {
        className = 'mfm-rainbow-static'
        break
      }
      style = anim('mfm-rainbow', '1s')
      break
    }
    case 'sparkle': {
      if (!ctx.useAnim) return <span key={key}>{children}</span>
      return (
        <span key={key} className="mfm-sparkle">
          {children}
        </span>
      )
    }
    case 'flip': {
      const transform =
        args.h && args.v ? 'scale(-1, -1)' : args.v ? 'scaleY(-1)' : 'scaleX(-1)'
      style = { transform }
      break
    }
    case 'x2':
    case 'x3':
    case 'x4':
      return (
        <span key={key} className={ctx.advanced ? `mfm-${name}` : undefined}>
          {children}
        </span>
      )
    case 'font': {
      const family = (['serif', 'monospace', 'cursive', 'fantasy', 'emoji', 'math'] as const).find((f) => args[f])
      if (family) style = { fontFamily: family }
      break
    }
    case 'blur':
      return (
        <span key={key} className="mfm-blur">
          {children}
        </span>
      )
    case 'rotate': {
      const deg = numArg(args.deg, 90)
      style = { transform: `rotate(${deg}deg)`, transformOrigin: 'center center' }
      break
    }
    case 'position': {
      if (!ctx.advanced) break
      const x = numArg(args.x, 0)
      const y = numArg(args.y, 0)
      style = { transform: `translateX(${x}em) translateY(${y}em)` }
      break
    }
    case 'scale': {
      if (!ctx.advanced) {
        style = {}
        break
      }
      const x = Math.min(numArg(args.x, 1), 5)
      const y = Math.min(numArg(args.y, 1), 5)
      style = { transform: `scale(${x}, ${y})` }
      break
    }
    case 'fg': {
      style = { color: `#${validColor(args.color) ?? 'f00'}`, overflowWrap: 'anywhere' }
      break
    }
    case 'bg': {
      style = { backgroundColor: `#${validColor(args.color) ?? 'f00'}`, overflowWrap: 'anywhere' }
      break
    }
    case 'border': {
      const color = validColor(args.color)
      const styles = ['hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset']
      const borderStyle = typeof args.style === 'string' && styles.includes(args.style) ? args.style : 'solid'
      style = {
        border: `${numArg(args.width, 1)}px ${borderStyle} ${color ? `#${color}` : 'var(--accent)'}`,
        borderRadius: `${numArg(args.radius, 0)}px`,
        overflow: args.noclip ? undefined : 'clip',
      }
      break
    }
    case 'ruby': {
      const nodes = node.children
      if (nodes.length === 1 && nodes[0].type === 'text') {
        const [body, reading] = nodes[0].props.text.split(' ')
        return (
          <ruby key={key}>
            {body}
            <rt>{reading}</rt>
          </ruby>
        )
      }
      const last = nodes.at(-1)
      const reading = last && last.type === 'text' ? last.props.text.trim() : ''
      return (
        <ruby key={key}>
          {renderNodes(nodes.slice(0, -1), ctx)}
          <rt>{reading}</rt>
        </ruby>
      )
    }
    case 'unixtime': {
      const first = node.children[0]
      const seconds = Number.parseInt(first && first.type === 'text' ? first.props.text : '', 10)
      return (
        <span key={key} className="mfm-unixtime">
          🕒 {formatUnixtime(seconds)}
        </span>
      )
    }
  }

  if (style === null && className === '') {
    // 未知のファンクションは Misskey と同じく記法のまま表示する
    return <span key={key}>{['$[', name, ' ', children, ']']}</span>
  }
  return (
    <span key={key} className={className || undefined} style={{ display: 'inline-block', ...(style ?? {}) }}>
      {children}
    </span>
  )
}

function renderNode(node: mfm.MfmNode, ctx: Ctx, key: string): ReactNode {
  switch (node.type) {
    case 'text':
      return <span key={key}>{node.props.text}</span>
    case 'bold':
      return <b key={key}>{renderNodes(node.children, ctx)}</b>
    case 'italic':
      return (
        <i key={key} style={{ fontStyle: 'oblique' }}>
          {renderNodes(node.children, ctx)}
        </i>
      )
    case 'strike':
      return <del key={key}>{renderNodes(node.children, ctx)}</del>
    case 'small':
      return (
        <small key={key} style={{ opacity: 0.7 }}>
          {renderNodes(node.children, ctx)}
        </small>
      )
    case 'center':
      return (
        <div key={key} style={{ textAlign: 'center' }}>
          {renderNodes(node.children, ctx)}
        </div>
      )
    case 'quote':
      return (
        <blockquote key={key} className="mfm-quote">
          {renderNodes(node.children, ctx)}
        </blockquote>
      )
    case 'plain':
      return <span key={key}>{renderNodes(node.children, ctx)}</span>
    case 'inlineCode':
      return (
        <code key={key} className="mfm-code-inline">
          {node.props.code}
        </code>
      )
    case 'blockCode':
      return (
        <pre key={key} className="mfm-code-block">
          <code>{node.props.code}</code>
        </pre>
      )
    case 'mathInline':
      return (
        <code key={key} className="mfm-code-inline">
          {node.props.formula}
        </code>
      )
    case 'mathBlock':
      return (
        <pre key={key} className="mfm-code-block">
          <code>{node.props.formula}</code>
        </pre>
      )
    case 'url':
      return (
        <a key={key} className="mfm-link" href={node.props.url} target="_blank" rel="noopener noreferrer">
          {node.props.url}
        </a>
      )
    case 'link':
      return (
        <a key={key} className="mfm-link" href={node.props.url} target="_blank" rel="noopener noreferrer">
          {renderNodes(node.children, ctx)}
        </a>
      )
    case 'mention':
      return (
        <span key={key} className="mfm-mention">
          {node.props.acct}
        </span>
      )
    case 'hashtag':
      return (
        <span key={key} className="mfm-hashtag">
          #{node.props.hashtag}
        </span>
      )
    case 'search':
      return (
        <span key={key} className="mfm-search">
          <span className="mfm-search-query">{node.props.query}</span>
          <span className="mfm-search-button">検索</span>
        </span>
      )
    case 'emojiCode': {
      const url = ctx.emojiMap.get(node.props.name)
      if (!url) {
        return (
          <span key={key} className="mfm-emoji-missing" title="この絵文字はサーバーに見つかりません">
            :{node.props.name}:
          </span>
        )
      }
      return (
        <img key={key} className="mfm-emoji" src={url} alt={`:${node.props.name}:`} title={`:${node.props.name}:`} loading="lazy" decoding="async" />
      )
    }
    case 'unicodeEmoji':
      return <span key={key}>{node.props.emoji}</span>
    case 'fn':
      return renderFn(node, ctx, key)
    default:
      return null
  }
}

function renderNodes(nodes: mfm.MfmNode[], ctx: Ctx): ReactNode[] {
  return nodes.map((node, i) => renderNode(node, ctx, String(i)))
}

export function MfmView({
  text,
  emojiMap,
  useAnim = true,
  advanced = true,
  className,
  style,
}: MfmRenderOptions & { text: string; className?: string; style?: CSSProperties }) {
  const nodes = useMemo(() => {
    try {
      return mfm.parse(text)
    } catch {
      return null
    }
  }, [text])

  const ctx: Ctx = { useAnim, advanced, emojiMap: emojiMap ?? new Map() }

  if (nodes === null) {
    return (
      <div className={className} style={style}>
        <span className="mfm-parse-error">構文を解釈できませんでした</span>
      </div>
    )
  }

  return (
    <div className={className} style={style}>
      {renderNodes(nodes, ctx)}
    </div>
  )
}
