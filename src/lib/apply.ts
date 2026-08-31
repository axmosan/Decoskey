// textarea の選択範囲に対する編集操作。
// 返り値の selStart/selEnd を textarea に復元することで、
// 装飾直後も中身が選択されたままになり、続けて押すと入れ子になる。

export type Edit = { text: string; selStart: number; selEnd: number }

export const PLACEHOLDER = 'テキスト'

export function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string = PLACEHOLDER,
): Edit {
  const selected = value.slice(start, end) || placeholder
  const contentStart = start + before.length
  return {
    text: value.slice(0, start) + before + selected + after + value.slice(end),
    selStart: contentStart,
    selEnd: contentStart + selected.length,
  }
}

/** テンプレート中の $1 を選択文字、$2 以降をプレースホルダに置換して挿入する。 */
export function applyTemplate(
  value: string,
  start: number,
  end: number,
  template: string,
  placeholders: string[],
): Edit {
  const selected = value.slice(start, end) || placeholders[0] || PLACEHOLDER
  let body = template.replace('$1', selected)
  for (let i = 1; i < placeholders.length; i++) {
    body = body.replace(`$${i + 1}`, placeholders[i])
  }
  // 最初のプレースホルダ（= $1 の位置）を選択状態にする
  const offset = body.indexOf(selected)
  const contentStart = start + (offset < 0 ? body.length : offset)
  return {
    text: value.slice(0, start) + body + value.slice(end),
    selStart: contentStart,
    selEnd: contentStart + (offset < 0 ? 0 : selected.length),
  }
}

/** 選択が跨る全ての行の行頭に prefix を付ける。既に全行に付いていれば外す。 */
export function toggleLinePrefix(value: string, start: number, end: number, prefix: string): Edit {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const lineEndIdx = value.indexOf('\n', end)
  const lineEnd = lineEndIdx < 0 ? value.length : lineEndIdx
  const block = value.slice(lineStart, lineEnd)
  const lines = block.split('\n')
  const allPrefixed = lines.every((line) => line.startsWith(prefix))
  const next = lines
    .map((line) => (allPrefixed ? line.slice(prefix.length) : prefix + line))
    .join('\n')
  return {
    text: value.slice(0, lineStart) + next + value.slice(lineEnd),
    selStart: lineStart,
    selEnd: lineStart + next.length,
  }
}

/** `:name:` の形をしたカスタム絵文字トークン。 */
const EMOJI_TOKEN = /:[a-zA-Z0-9_+-]+:/g

/**
 * pos を含む `:name:` の範囲を返す。クリックだけで絵文字ひとつを
 * 選択状態にし、そのまま装飾ボタンを押せるようにするために使う。
 */
export function emojiTokenAt(value: string, pos: number): { start: number; end: number } | null {
  EMOJI_TOKEN.lastIndex = 0
  for (let m = EMOJI_TOKEN.exec(value); m !== null; m = EMOJI_TOKEN.exec(value)) {
    const start = m.index
    const end = start + m[0].length
    if (pos < start) return null // 以降は全て右側なので探す必要がない
    if (pos <= end) return { start, end }
  }
  return null
}

/** 選択範囲をそのまま置き換える（絵文字挿入など）。 */
export function insertText(value: string, start: number, end: number, snippet: string): Edit {
  return {
    text: value.slice(0, start) + snippet + value.slice(end),
    selStart: start + snippet.length,
    selEnd: start + snippet.length,
  }
}
