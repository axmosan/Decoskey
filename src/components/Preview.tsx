// プレビュー。Misskey のノートと同じ並び（アイコン → 名前 → 本文）で表示する。

import { MfmView } from '../lib/mfmRender'
import misskeyAvatar from '../assets/misskey-avatar.jpg'

type Props = {
  text: string
  emojiMap: Map<string, string>
  useAnim: boolean
  advanced: boolean
  emojiLoading: boolean
}

export function Preview({ text, emojiMap, useAnim, advanced, emojiLoading }: Props) {
  return (
    <article className="note" data-emoji-loading={emojiLoading}>
      <img className="note-avatar" src={misskeyAvatar} alt="" />
      <div className="note-main">
        <header className="note-head">
          <span className="note-name">Misskey</span>
          <span className="note-handle">@Misskey</span>
        </header>
        {text.trim() === '' ? (
          <p className="note-empty">ここに装飾のプレビューが出ます。</p>
        ) : (
          <MfmView className="mfm" text={text} emojiMap={emojiMap} useAnim={useAnim} advanced={advanced} />
        )}
      </div>
    </article>
  )
}
