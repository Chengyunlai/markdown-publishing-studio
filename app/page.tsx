"use client";

import type { BlogDraft } from "@/lib/types";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type State = "checking" | "login" | "ready";

const newDraft = (): BlogDraft => ({
  slug: "",
  title: "",
  summary: "",
  publishedAt: new Date().toISOString().slice(0, 10),
  tag: "",
  content: "",
});

async function json<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(body.message || "请求失败");
  return body;
}

export default function AdminPage() {
  const [state, setState] = useState<State>("checking");
  const [password, setPassword] = useState("");
  const [posts, setPosts] = useState<BlogDraft[]>([]);
  const [draft, setDraft] = useState<BlogDraft>(newDraft);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/posts", { cache: "no-store" });
    if (response.status === 401) {
      setState("login");
      return;
    }
    const body = await json<{ posts: BlogDraft[] }>(response);
    setPosts(body.posts);
    setState("ready");
  }, []);

  useEffect(() => {
    load().catch((error) => {
      setMessage(error instanceof Error ? error.message : "读取失败");
      setState("login");
    });
  }, [load]);

  const count = useMemo(() => draft.content.replace(/\s+/g, "").length, [draft.content]);
  const update = (key: keyof BlogDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await json(
        await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }),
      );
      setPassword("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setBusy(false);
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const endpoint = selectedSlug ? `/api/posts/${encodeURIComponent(selectedSlug)}` : "/api/posts";
      const body = await json<{ commitUrl?: string }>(
        await fetch(endpoint, {
          method: selectedSlug ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        }),
      );
      setSelectedSlug(draft.slug);
      setMessage(body.commitUrl ? "已提交到静态博客仓库，等待重新构建。" : "已提交。" );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selectedSlug || !window.confirm(`确认删除 ${selectedSlug}？`)) return;
    setBusy(true);
    setMessage("");
    try {
      await json(await fetch(`/api/posts/${encodeURIComponent(selectedSlug)}`, { method: "DELETE" }));
      setSelectedSlug(null);
      setDraft(newDraft());
      setMessage("已提交删除，等待静态博客重新构建。" );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/session", { method: "DELETE" });
    setPosts([]);
    setDraft(newDraft());
    setSelectedSlug(null);
    setState("login");
  };

  if (state === "checking") return <main className="center">正在连接文章仓库…</main>;

  if (state === "login") {
    return (
      <main className="center">
        <form className="login" onSubmit={login}>
          <span className="kicker">LOCAL / PRIVATE</span>
          <h1>文章管理</h1>
          <p>这个服务只应运行在本机或私有网络。登录后，文章变更会直接提交到静态博客仓库。</p>
          <label>
            管理密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "正在验证…" : "进入后台"}
          </button>
          {message && <p className="message">{message}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="admin">
      <header className="topbar">
        <div>
          <span className="kicker">GITHUB CONTENTS / PRIVATE</span>
          <h1>文章管理</h1>
        </div>
        <button className="textButton" type="button" onClick={logout}>退出</button>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebarHead">
            <span>{posts.length} 篇</span>
            <button
              type="button"
              onClick={() => {
                setSelectedSlug(null);
                setDraft(newDraft());
                setMessage("");
              }}
            >
              新建文章
            </button>
          </div>
          <div className="postList">
            {posts.map((post) => (
              <button
                className={selectedSlug === post.slug ? "post active" : "post"}
                type="button"
                key={post.slug}
                onClick={() => {
                  setSelectedSlug(post.slug);
                  setDraft(post);
                  setMessage("");
                }}
              >
                <strong>{post.title}</strong>
                <span>{post.publishedAt} · {post.tag || "未分类"}</span>
              </button>
            ))}
          </div>
        </aside>

        <form className="editor" onSubmit={save}>
          <div className="fields">
            <label>
              标题
              <input value={draft.title} onChange={(event) => update("title", event.target.value)} required />
            </label>
            <label>
              Slug
              <input
                value={draft.slug}
                onChange={(event) => update("slug", event.target.value)}
                readOnly={Boolean(selectedSlug)}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
            </label>
            <label>
              发布日期
              <input type="date" value={draft.publishedAt} onChange={(event) => update("publishedAt", event.target.value)} required />
            </label>
            <label>
              分类
              <input value={draft.tag} onChange={(event) => update("tag", event.target.value)} />
            </label>
          </div>

          <label>
            摘要
            <textarea rows={3} value={draft.summary} onChange={(event) => update("summary", event.target.value)} required />
          </label>

          <label className="markdown">
            <span>Markdown 正文 <small>{count} 字</small></span>
            <textarea value={draft.content} onChange={(event) => update("content", event.target.value)} spellCheck={false} required />
          </label>

          <footer className="editorFooter">
            <p className="message">{message || "保存会在 GitHub 产生一次内容提交。"}</p>
            <div>
              {selectedSlug && <button className="danger" type="button" onClick={remove} disabled={busy}>删除</button>}
              <button className="primary" type="submit" disabled={busy}>{busy ? "正在提交…" : "提交到博客仓库"}</button>
            </div>
          </footer>
        </form>
      </div>
    </main>
  );
}
