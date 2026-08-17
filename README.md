# Chengyunlai Blog Admin

“一个人的狂想曲”的独立文章管理系统。它不负责公开博客展示，只负责登录、编辑 Markdown，并通过 GitHub Contents API 把内容提交到静态博客仓库。

## 安全边界

- 前端和 API 在同一个独立进程中运行，与公开站点没有路由或部署耦合。
- `dev` 和 `start` 默认只监听 `127.0.0.1:3100`，不会对局域网或互联网开放。
- 如需远程访问，应放在 Tailscale、WireGuard、SSH Tunnel 或带访问控制的反向代理后面，不要直接监听公网地址。
- 管理密码只签发 HttpOnly、SameSite=Strict 会话 Cookie。
- GitHub Token 只放在 `.env.local`，建议使用仅授权静态博客仓库 Contents 读写的 fine-grained PAT。

## 启动

```bash
cp .env.example .env.local
npm install
npm run dev
```

打开 `http://127.0.0.1:3100`。

## 发布链路

```text
私有管理系统
  → GitHub Contents API
  → 静态博客私有源码仓库中的 src/app/blog/posts/*.md
  → 部署平台重新构建
  → 公开只读博客
```

公开博客不包含管理页面、登录接口、GitHub Token 或任何写入能力。
