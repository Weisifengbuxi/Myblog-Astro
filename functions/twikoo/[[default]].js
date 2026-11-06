/**
 * `/twikoo/*` 的路由入口（例如 /twikoo/ 带尾斜杠的情况）。
 * 逻辑与 /twikoo 完全一致，直接复用 —— 只写一份，避免两处实现漂移。
 */
export { onRequest, onRequestGet, onRequestOptions, onRequestPost } from './index.js';
