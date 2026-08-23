// 装飾カタログ。
// ボタンに出す文字は「構文名そのもの」で、その文字自体に当の装飾を掛けて見本にする。
// （bold ボタンは太字の "bold"、tada ボタンは跳ねる "tada"）

export type Option = { value: string; label: string }

export type DecoParam =
  /** speed / delay。秒で持つ。 */
  | { kind: 'time'; key: string; label: string; def: string; min: number; max: number; step: number }
  | { kind: 'color'; key: string; label: string; def: string }
  | { kind: 'number'; key: string; label: string; def: number; min: number; max: number; step: number }
  | { kind: 'select'; key: string; label: string; def: string; options: Option[] }
  /** 相互排他のフラグ群。値はカンマ区切り（flip の "h,v" など）。'' で無指定。 */
  | { kind: 'flagSet'; id: string; label: string; def: string; keys: string[]; options: Option[] }
  | { kind: 'toggle'; key: string; label: string }

export type DecoInsert =
  | { type: 'fn'; name: string }
  | { type: 'wrap'; before: string; after: string }
  | { type: 'linePrefix'; prefix: string }
  | { type: 'template'; template: string; placeholders: string[] }

export type CategoryId = 'basic' | 'size' | 'color' | 'motion' | 'transform' | 'other'

export type Deco = {
  id: string
  /** ボタンに表示する構文名 */
  token: string
  /** ボタン内プレビューに使う MFM。省略時は token をそのまま出す */
  sample?: string
  /** プレビューがボタンに収まらない装飾用の文字サイズ倍率 */
  sampleScale?: number
  /** ツールチップ */
  title: string
  category: CategoryId
  insert: DecoInsert
  /** 挿入時に最初から付ける引数（既定のままで良いものは書かない） */
  initialArgs?: Record<string, string | true>
  params?: DecoParam[]
  /** 「高度なMFM」設定が要る */
  advanced?: boolean
  /** 「動きのあるMFM」設定が要る */
  animated?: boolean
}

const SPEED = (def: string): DecoParam => ({
  kind: 'time', key: 'speed', label: 'speed', def, min: 0, max: 10, step: 0.1,
})
const DELAY: DecoParam = { kind: 'time', key: 'delay', label: 'delay', def: '0s', min: 0, max: 10, step: 0.1 }

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'basic', label: '基本' },
  { id: 'size', label: '大きさ' },
  { id: 'color', label: '色・枠' },
  { id: 'motion', label: '動き' },
  { id: 'transform', label: '変形' },
  { id: 'other', label: 'その他' },
]

export const DECORATIONS: Deco[] = [
  // ── 基本 ──────────────────────────────────────────────
  {
    id: 'bold', token: 'bold', sample: '**bold**', title: '太字にする  **文字**',
    category: 'basic', insert: { type: 'wrap', before: '**', after: '**' },
  },
  {
    id: 'italic', token: 'italic', sample: '<i>italic</i>', title: '斜体にする  <i>文字</i>',
    category: 'basic', insert: { type: 'wrap', before: '<i>', after: '</i>' },
  },
  {
    id: 'strike', token: 'strike', sample: '~~strike~~', title: '打ち消し線  ~~文字~~',
    category: 'basic', insert: { type: 'wrap', before: '~~', after: '~~' },
  },
  {
    id: 'small', token: 'small', sample: '<small>small</small>', title: '小さく薄く表示  <small>文字</small>',
    category: 'basic', insert: { type: 'wrap', before: '<small>', after: '</small>' },
  },
  {
    id: 'center', token: 'center', sample: '<center>center</center>', title: '中央寄せ  <center>文字</center>',
    category: 'basic', insert: { type: 'wrap', before: '<center>', after: '</center>' },
  },
  {
    id: 'quote', token: '> quote', sample: '> quote', sampleScale: 0.85, title: '引用にする  > 文字',
    category: 'basic', insert: { type: 'linePrefix', prefix: '> ' },
  },
  {
    id: 'code', token: 'code', sample: '`code`', title: 'インラインコード  `文字`',
    category: 'basic', insert: { type: 'wrap', before: '`', after: '`' },
  },
  {
    id: 'codeblock', token: '```', sample: '`code block`', sampleScale: 0.85, title: 'コードブロック（複数行）',
    category: 'basic', insert: { type: 'wrap', before: '```\n', after: '\n```' },
  },
  {
    id: 'plain', token: 'plain', sample: '<plain>plain</plain>', title: '中の装飾を全て無効化  <plain>文字</plain>',
    category: 'basic', insert: { type: 'wrap', before: '<plain>', after: '</plain>' },
  },

  // ── 大きさ ────────────────────────────────────────────
  {
    id: 'tada0', token: 'tada 0s', sample: '$[tada.speed=0s 150%]', sampleScale: 0.7,
    title: '動かさずに 150% へ拡大  $[tada.speed=0s 文字]',
    category: 'size', insert: { type: 'fn', name: 'tada' }, initialArgs: { speed: '0s' },
    params: [SPEED('0s'), DELAY],
  },
  {
    id: 'x2', token: 'x2', sample: '$[x2 x2]', sampleScale: 0.5, title: '2倍に拡大  $[x2 文字]',
    category: 'size', advanced: true, insert: { type: 'fn', name: 'x2' },
  },
  {
    id: 'x3', token: 'x3', sample: '$[x3 x3]', sampleScale: 0.34, title: '3倍に拡大  $[x3 文字]',
    category: 'size', advanced: true, insert: { type: 'fn', name: 'x3' },
  },
  {
    id: 'x4', token: 'x4', sample: '$[x4 x4]', sampleScale: 0.26, title: '4倍に拡大  $[x4 文字]',
    category: 'size', advanced: true, insert: { type: 'fn', name: 'x4' },
  },
  {
    id: 'scale', token: 'scale', sample: '$[scale.x=1.6,y=1 scale]', sampleScale: 0.62,
    title: '縦横を個別に引き伸ばす  $[scale.x=4,y=2 文字]',
    category: 'size', advanced: true, insert: { type: 'fn', name: 'scale' }, initialArgs: { x: '2', y: '1' },
    params: [
      { kind: 'number', key: 'x', label: 'x', def: 1, min: 0, max: 5, step: 0.1 },
      { kind: 'number', key: 'y', label: 'y', def: 1, min: 0, max: 5, step: 0.1 },
    ],
  },

  // ── 色・枠 ────────────────────────────────────────────
  {
    id: 'fg', token: 'fg', sample: '$[fg.color=f00 fg]', title: '文字色を変える  $[fg.color=f00 文字]',
    category: 'color', insert: { type: 'fn', name: 'fg' }, initialArgs: { color: 'f00' },
    params: [{ kind: 'color', key: 'color', label: 'color', def: 'f00' }],
  },
  {
    id: 'bg', token: 'bg', sample: '$[bg.color=ff0 bg]', title: '背景色を変える  $[bg.color=ff0 文字]',
    category: 'color', insert: { type: 'fn', name: 'bg' }, initialArgs: { color: 'ff0' },
    params: [{ kind: 'color', key: 'color', label: 'color', def: 'ff0' }],
  },
  {
    id: 'rainbow', token: 'rainbow', sample: '$[rainbow rainbow]', sampleScale: 0.8,
    title: '虹色に変化させる  $[rainbow 文字]',
    category: 'color', animated: true, insert: { type: 'fn', name: 'rainbow' },
    params: [SPEED('1s'), DELAY],
  },
  {
    id: 'border', token: 'border', sample: '$[border.style=solid,width=2,radius=4 border]', sampleScale: 0.8,
    title: '枠線で囲む  $[border.style=dashed,width=2 文字]',
    category: 'color', insert: { type: 'fn', name: 'border' }, initialArgs: { style: 'solid', width: '2', radius: '4' },
    params: [
      {
        kind: 'select', key: 'style', label: 'style', def: 'solid',
        options: ['solid', 'hidden', 'dotted', 'dashed', 'double', 'groove', 'ridge', 'inset', 'outset']
          .map((v) => ({ value: v, label: v })),
      },
      { kind: 'number', key: 'width', label: 'width', def: 1, min: 0, max: 20, step: 1 },
      { kind: 'color', key: 'color', label: 'color', def: '' },
      { kind: 'number', key: 'radius', label: 'radius', def: 0, min: 0, max: 40, step: 1 },
      { kind: 'toggle', key: 'noclip', label: 'noclip' },
    ],
  },

  // ── 動き ──────────────────────────────────────────────
  {
    id: 'jelly', token: 'jelly', sample: '$[jelly jelly]', title: 'びよんびよん伸縮  $[jelly 文字]',
    category: 'motion', animated: true, insert: { type: 'fn', name: 'jelly' }, params: [SPEED('1s'), DELAY],
  },
  {
    id: 'tada', token: 'tada', sample: '$[tada tada]', sampleScale: 0.7,
    title: '150% に拡大して跳ねる  $[tada 文字]',
    category: 'motion', animated: true, insert: { type: 'fn', name: 'tada' }, params: [SPEED('1s'), DELAY],
  },
  {
    id: 'jump', token: 'jump', sample: '$[jump jump]', title: '上下にジャンプ  $[jump 文字]',
    category: 'motion', animated: true, insert: { type: 'fn', name: 'jump' }, params: [SPEED('0.75s'), DELAY],
  },
  {
    id: 'bounce', token: 'bounce', sample: '$[bounce bounce]', title: '跳ねて着地で潰れる  $[bounce 文字]',
    category: 'motion', animated: true, insert: { type: 'fn', name: 'bounce' }, params: [SPEED('0.75s'), DELAY],
  },
  {
    id: 'spin', token: 'spin', sample: '$[spin spin]', title: 'ぐるぐる回す  $[spin.x,left 文字]',
    category: 'motion', animated: true, insert: { type: 'fn', name: 'spin' },
    params: [
      {
        kind: 'flagSet', id: 'axis', label: '軸', def: '', keys: ['x', 'y'],
        options: [{ value: '', label: 'z（既定）' }, { value: 'x', label: 'x' }, { value: 'y', label: 'y' }],
      },
      {
        kind: 'flagSet', id: 'dir', label: '向き', def: '', keys: ['left', 'alternate'],
        options: [
          { value: '', label: '右回り' },
          { value: 'left', label: '左回り' },
          { value: 'alternate', label: '往復' },
        ],
      },
      SPEED('1.5s'), DELAY,
    ],
  },
  {
    id: 'shake', token: 'shake', sample: '$[shake shake]', title: 'ぶるぶる震わす  $[shake 文字]',
    category: 'motion', animated: true, insert: { type: 'fn', name: 'shake' }, params: [SPEED('0.5s'), DELAY],
  },
  {
    id: 'twitch', token: 'twitch', sample: '$[twitch twitch]', title: '激しくブレる  $[twitch 文字]',
    category: 'motion', animated: true, insert: { type: 'fn', name: 'twitch' }, params: [SPEED('0.5s'), DELAY],
  },
  {
    id: 'sparkle', token: 'sparkle', sample: '$[sparkle sparkle]', sampleScale: 0.8,
    title: 'キラキラを飛ばす  $[sparkle 文字]',
    category: 'motion', animated: true, insert: { type: 'fn', name: 'sparkle' },
  },
  {
    id: 'blur', token: 'blur', sample: '$[blur blur]', title: 'ぼかす（カーソルを乗せると見える）  $[blur 文字]',
    category: 'motion', insert: { type: 'fn', name: 'blur' },
  },

  // ── 変形 ──────────────────────────────────────────────
  {
    id: 'flip', token: 'flip', sample: '$[flip flip]', title: '上下・左右に反転  $[flip.v 文字]',
    category: 'transform', insert: { type: 'fn', name: 'flip' },
    params: [
      {
        kind: 'flagSet', id: 'dir', label: '向き', def: '', keys: ['h', 'v'],
        options: [
          { value: '', label: '左右（既定）' },
          { value: 'v', label: '上下' },
          { value: 'h,v', label: '上下左右' },
        ],
      },
    ],
  },
  {
    id: 'rotate', token: 'rotate', sample: '$[rotate.deg=20 rotate]', sampleScale: 0.8,
    title: '角度を付ける  $[rotate.deg=30 文字]',
    category: 'transform', insert: { type: 'fn', name: 'rotate' }, initialArgs: { deg: '30' },
    params: [{ kind: 'number', key: 'deg', label: 'deg', def: 90, min: -360, max: 360, step: 5 }],
  },
  {
    id: 'position', token: 'position', sample: '$[position.x=0.2,y=0.15 position]', sampleScale: 0.8,
    title: '位置をずらす  $[position.x=0.8,y=0.5 文字]',
    category: 'transform', advanced: true, insert: { type: 'fn', name: 'position' }, initialArgs: { x: '0.5', y: '0' },
    params: [
      { kind: 'number', key: 'x', label: 'x', def: 0, min: -5, max: 5, step: 0.1 },
      { kind: 'number', key: 'y', label: 'y', def: 0, min: -5, max: 5, step: 0.1 },
    ],
  },
  {
    id: 'font', token: 'font', sample: '$[font.serif font]', title: 'フォントを変える  $[font.serif 文字]',
    category: 'transform', insert: { type: 'fn', name: 'font' }, initialArgs: { serif: true },
    params: [
      {
        kind: 'flagSet', id: 'family', label: 'family', def: 'serif',
        keys: ['serif', 'monospace', 'cursive', 'fantasy'],
        options: [
          { value: 'serif', label: 'serif' },
          { value: 'monospace', label: 'monospace' },
          { value: 'cursive', label: 'cursive' },
          { value: 'fantasy', label: 'fantasy' },
        ],
      },
    ],
  },

  // ── その他 ────────────────────────────────────────────
  {
    id: 'ruby', token: 'ruby', sample: '$[ruby 漢字 かんじ]', sampleScale: 0.9,
    title: 'ふりがなを振る  $[ruby 本文 よみ]',
    category: 'other', insert: { type: 'template', template: '$[ruby $1 $2]', placeholders: ['本文', 'よみ'] },
  },
  {
    id: 'link', token: 'link', sample: '[link](https://example.com)', title: 'リンクを貼る  [表示文字](URL)',
    category: 'other',
    insert: { type: 'template', template: '[$1]($2)', placeholders: ['表示文字', 'https://example.com'] },
  },
  {
    id: 'linkNoPreview', token: '?link', sample: '?[link](https://example.com)',
    title: 'プレビューを出さないリンク  ?[表示文字](URL)',
    category: 'other',
    insert: { type: 'template', template: '?[$1]($2)', placeholders: ['表示文字', 'https://example.com'] },
  },
  {
    id: 'mention', token: '@user', title: 'メンション  @ユーザー名',
    category: 'other', insert: { type: 'template', template: '@$1', placeholders: ['username'] },
  },
  {
    id: 'hashtag', token: '#tag', title: 'ハッシュタグ  #タグ',
    category: 'other', insert: { type: 'template', template: '#$1', placeholders: ['tag'] },
  },
  {
    id: 'unixtime', token: 'unixtime', title: 'UNIX時間で日時を表示  $[unixtime 1701356400]',
    category: 'other',
    insert: { type: 'template', template: '$[unixtime $1]', placeholders: ['1701356400'] },
  },
  {
    id: 'search', token: '検索', title: '検索ボックスを出す  キーワード 検索',
    category: 'other', insert: { type: 'template', template: '$1 検索', placeholders: ['キーワード'] },
  },
]

export const DECO_BY_FN: Record<string, Deco> = Object.fromEntries(
  DECORATIONS.filter((d) => d.insert.type === 'fn').map((d) => [(d.insert as { type: 'fn'; name: string }).name, d]),
)
