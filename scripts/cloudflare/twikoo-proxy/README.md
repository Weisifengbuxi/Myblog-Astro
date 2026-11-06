# Twikoo 反向代理（Cloudflare Worker 免费版）

给 `twikoo.weisifengbuxi.top`（Vercel 上的 Twikoo 后端）套一层 Cloudflare：
挡爬虫、限速、隐藏源站，避免 Vercel Hobby 的 **Edge Requests 1M/月**额度被刷穿。

> ⚠️ 前提：Worker 只能转发请求，**不能解禁 Vercel**。Vercel 项目现在是
> `402 Payment Required / DEPLOYMENT_DISABLED`（额度超了被暂停），需要先在 Vercel
> 升级到 Pro 或等额度恢复，评论才会真正可用。这层代理的作用是「恢复之后别再被刷穿」。

## 一、部署 Worker（约 10 分钟）

1. 注册/登录 <https://dash.cloudflare.com>（免费版即可），拿到你的 `账户名`。
2. 打开 <https://dash.cloudflare.com/?to=/:account/workers-and-pages> → **Create** → **Worker** → 起名 `twikoo-proxy` → **Deploy**。
3. 点 **Edit code**，把 `worker.js` 的内容整个粘进去。
4. 把文件顶部的 `ORIGIN` 改成 Twikoo 的 Vercel 地址（Vercel 控制台 → twikoo 项目 → **Domains**，形如 `https://twikoo-xxxx.vercel.app`）。
   **不要填 `twikoo.weisifengbuxi.top`**，否则会自己代理自己造成死循环。
5. **Deploy**，记下地址：`https://twikoo-proxy.<你的账户名>.workers.dev`。

命令行部署也可以（需要 Node）：

```bash
cd scripts/cloudflare/twikoo-proxy
npx wrangler deploy
```

## 二、开启防护（免费版能开的都开）

在 Cloudflare 控制台：

| 位置 | 设置 |
|---|---|
| 你的 Worker → **Settings → Bindings** | 若 `wrangler.toml` 里的速率限制没生效，在这里加一个 **Rate limiting** 绑定，变量名 `RATE_LIMITER`，60 次 / 60 秒 |
| 域名（Zone）→ **Security → Bots** | 打开 **Bot Fight Mode** |
| 域名 → **Security → WAF → Rate limiting rules** | 再加一条：`http.request.uri.path eq "/"` 且 Method = POST，同 IP 60 秒 > 60 次 → Block（双保险） |

> 说明：Worker 自己的 `*.workers.dev` 域名默认就带 Cloudflare 防护；Bot Fight Mode / WAF 规则需要把**域名本身**托管在 Cloudflare 才生效。如果你的 DNS 还在 EdgeOne（现在是 `pages.dnsoe4.com`），这两项开不了——那就只靠 Worker 里的速率限制，也够挡住脚本刷接口。

## 三、切换到代理地址（两种方式选一种）

**方式 A（最省事，不改 DNS）**——直接把前端指向 Worker：

```yaml
# config/site.yaml
comment:
  twikoo:
    envId: https://twikoo-proxy.<你的账户名>.workers.dev
```

**方式 B（地址不变，推荐长期用）**——在 EdgeOne 的 DNS 里把 `twikoo` 记录改成 CNAME：
`twikoo` → `twikoo-proxy.<你的账户名>.workers.dev`（不要开代理/加速，纯 CNAME）。
这样 `https://twikoo.weisifengbuxi.top` 先到 Cloudflare，再到 Vercel，前端 `envId` 一行都不用改。

## 四、验证

```bash
curl -s -X POST https://twikoo-proxy.<你的账户名>.workers.dev/ \
  -H 'Content-Type: application/json' \
  -d '{"event":"GET_CONFIG"}' | head -c 200
```

- 返回 `{"code":100,...}` 或配置 JSON → 代理链路通；
- 返回 `Payment required DEPLOYMENT_DISABLED` → Worker 正常，问题在 Vercel 仍被暂停；
- 返回 `404 Not Found` → 请求路径不是 `POST /`，检查调用方。
