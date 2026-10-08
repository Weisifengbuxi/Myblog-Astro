/**
 * 构建时读取朋友圈数据。
 *
 * 数据由 `.migration/fetch-fcircle.mjs`（GitHub Actions 定时跑）写到
 * `public/fcircle/all.json`。这里在**构建时**读它并解析，页面因此完全不依赖
 * 运行时接口 —— 没有 CORS、没有证书、也没有第三方服务会不会挂的问题。
 *
 * 文件不存在或内容损坏时返回空结果而不是抛错：这样首次部署（还没跑过抓取）
 * 也能正常构建，页面自行显示「暂无数据」。
 */

import fs from 'node:fs';
import path from 'node:path';
import { type FcirclePayload, parseFcirclePayload, sortByTimeDesc } from './types';

const DATA_FILE = path.join(process.cwd(), 'public', 'fcircle', 'all.json');

let cached: FcirclePayload | null = null;

export function getFcircleData(): FcirclePayload {
  if (cached) return cached;

  try {
    if (!fs.existsSync(DATA_FILE)) {
      cached = { posts: [] };
      return cached;
    }
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as unknown;
    const payload = parseFcirclePayload(raw);
    cached = { posts: sortByTimeDesc(payload.posts), stat: payload.stat };
    return cached;
  } catch (err) {
    // 数据坏了就当作没有，别让整站构建失败
    console.warn(`[fcircle] 读取 ${DATA_FILE} 失败：${(err as Error).message}`);
    cached = { posts: [] };
    return cached;
  }
}
