// MFM 構文の組み立てと解析。
// $[name.k=v,flag content] の生成、テキスト中の $[...] スパン抽出、
// カーソル位置を含む最内 fn の特定、引数の書き換えを担当する。

export type FnArgValue = string | true
export type FnArgs = Record<string, FnArgValue>

/** $[name.a=1,b content] を組み立てる。値が空・false・undefined の引数は落とす。 */
export function buildFn(name: string, args: FnArgs, content: string): string {
  const head = buildFnHead(name, args)
  return `$[${head} ${content}]`
}

export function buildFnHead(name: string, args: FnArgs): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(args)) {
    if (value === true) {
      parts.push(key)
      continue
    }
    if (typeof value !== 'string' || value === '') continue
    parts.push(`${key}=${value}`)
  }
  return parts.length > 0 ? `${name}.${parts.join(',')}` : name
}

/** head 部分（name.a=1,b）を name と引数に分解する。 */
export function parseFnHead(head: string): { name: string; args: FnArgs } {
  const dot = head.indexOf('.')
  if (dot < 0) return { name: head, args: {} }
  const name = head.slice(0, dot)
  const args: FnArgs = {}
  for (const part of head.slice(dot + 1).split(',')) {
    if (part === '') continue
    const eq = part.indexOf('=')
    if (eq < 0) args[part] = true
    else args[part.slice(0, eq)] = part.slice(eq + 1)
  }
  return { name, args }
}

export type FnSpan = {
  /** '$' の位置 */
  start: number
  /** ']' の次の位置 */
  end: number
  name: string
  args: FnArgs
  /** head 文字列（name.a=1,b） */
  head: string
  /** 中身の開始位置（head 直後の区切り空白の次） */
  contentStart: number
  /** 中身の終了位置（']' の位置） */
  contentEnd: number
  /** 入れ子の深さ（0 が最外） */
  depth: number
}

type StackItem = { isFn: boolean; start: number; depth: number }

/**
 * テキスト中の $[...] を全て拾う。角括弧の対応を数えるので
 * `$[x2 [link](url)]` のような入れ子でも閉じ位置を誤らない。
 */
export function scanFnSpans(text: string): FnSpan[] {
  const spans: FnSpan[] = []
  const stack: StackItem[] = []
  let fnDepth = 0

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '\\') {
      i++ // エスケープされた次の 1 文字は読み飛ばす
      continue
    }
    if (ch === '$' && text[i + 1] === '[') {
      stack.push({ isFn: true, start: i, depth: fnDepth })
      fnDepth++
      i++
      continue
    }
    if (ch === '[') {
      stack.push({ isFn: false, start: i, depth: fnDepth })
      continue
    }
    if (ch === ']') {
      const open = stack.pop()
      if (!open) continue
      if (!open.isFn) continue
      fnDepth--
      const inner = text.slice(open.start + 2, i)
      const sep = inner.search(/[\s　]/)
      if (sep < 0) continue // 区切りが無いものは fn として成立しない
      const head = inner.slice(0, sep)
      if (head === '') continue
      const { name, args } = parseFnHead(head)
      spans.push({
        start: open.start,
        end: i + 1,
        name,
        args,
        head,
        contentStart: open.start + 2 + sep + 1,
        contentEnd: i,
        depth: open.depth,
      })
    }
  }
  return spans.sort((a, b) => a.start - b.start)
}

/** カーソル（または選択範囲）を含む最も内側の fn を返す。 */
export function findEnclosingFn(text: string, caretStart: number, caretEnd = caretStart): FnSpan | null {
  const hits = scanFnSpans(text).filter((s) => s.start <= caretStart && caretEnd <= s.end)
  if (hits.length === 0) return null
  return hits.reduce((deepest, s) => (s.depth >= deepest.depth ? s : deepest))
}

/** fn の引数だけを差し替えた新しいテキストを返す。 */
export function replaceFnArgs(text: string, span: FnSpan, args: FnArgs): { text: string; span: FnSpan } {
  const head = buildFnHead(span.name, args)
  const next = text.slice(0, span.start + 2) + head + text.slice(span.start + 2 + span.head.length)
  const delta = head.length - span.head.length
  return {
    text: next,
    span: {
      ...span,
      head,
      args,
      end: span.end + delta,
      contentStart: span.contentStart + delta,
      contentEnd: span.contentEnd + delta,
    },
  }
}

/** fn を剥がして中身だけ残す。 */
export function unwrapFn(text: string, span: FnSpan): { text: string; selStart: number; selEnd: number } {
  const content = text.slice(span.contentStart, span.contentEnd)
  return {
    text: text.slice(0, span.start) + content + text.slice(span.end),
    selStart: span.start,
    selEnd: span.start + content.length,
  }
}
