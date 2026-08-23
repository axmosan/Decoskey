// public/favicon.svg から PWA 用の PNG アイコンを書き出す。
// 使い方: npm run icon

import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const source = await readFile(new URL('../public/favicon.svg', import.meta.url))

for (const size of [192, 512]) {
  const png = await sharp(source, { density: 512 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer()
  const target = new URL(`../public/icon-${size}.png`, import.meta.url)
  await writeFile(target, png)
  console.log(`icon-${size}.png  ${png.length} bytes`)
}
