import "server-only";

import matter from "gray-matter";
import type { BlogDraft, SaveResult } from "./types";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Config = {
  token: string;
  repository: string;
  branch: string;
  contentPath: string;
};

type GitHubFile = {
  name: string;
  path: string;
  type: "file" | "dir";
  sha: string;
  content?: string;
};

function config(): Config {
  const token = process.env.BLOG_GITHUB_TOKEN || "";
  const repository = process.env.BLOG_GITHUB_REPOSITORY || "";
  const [owner, repo] = repository.split("/");
  if (!token || !owner || !repo) {
    throw new Error("请配置 BLOG_GITHUB_TOKEN 和 BLOG_GITHUB_REPOSITORY");
  }

  return {
    token,
    repository,
    branch: process.env.BLOG_GITHUB_BRANCH || "main",
    contentPath: (process.env.BLOG_CONTENT_PATH || "src/app/blog/posts").replace(/^\/+|\/+$/g, ""),
  };
}

function encoded(filePath: string) {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const settings = config();
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${settings.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub API 请求失败 (${response.status}): ${detail}`);
  }
  return (await response.json()) as T;
}

function normalizedDate(value: unknown) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value || "");
}

function parse(slug: string, raw: string): BlogDraft {
  const { data, content } = matter(raw);
  return {
    slug,
    title: String(data.title || ""),
    summary: String(data.summary || ""),
    publishedAt: normalizedDate(data.publishedAt),
    tag: String(data.tag || ""),
    content: content.trim(),
  };
}

function normalize(input: Partial<BlogDraft>): BlogDraft {
  const draft = {
    slug: String(input.slug || "").trim(),
    title: String(input.title || "").trim(),
    summary: String(input.summary || "").trim(),
    publishedAt: String(input.publishedAt || "").trim(),
    tag: String(input.tag || "").trim(),
    content: String(input.content || "").trim(),
  };

  if (!SLUG_PATTERN.test(draft.slug)) throw new Error("slug 只能使用小写字母、数字和连字符");
  if (!draft.title) throw new Error("标题不能为空");
  if (!draft.summary) throw new Error("摘要不能为空");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.publishedAt)) {
    throw new Error("发布日期必须使用 YYYY-MM-DD 格式");
  }
  if (!draft.content) throw new Error("Markdown 正文不能为空");
  return draft;
}

async function getFile(slug: string) {
  if (!SLUG_PATTERN.test(slug)) return null;
  const settings = config();
  const filePath = `${settings.contentPath}/${slug}.md`;
  try {
    const file = await request<GitHubFile>(
      `/repos/${settings.repository}/contents/${encoded(filePath)}?ref=${encodeURIComponent(settings.branch)}`,
    );
    if (!file.content) return null;
    return {
      sha: file.sha,
      draft: parse(slug, Buffer.from(file.content, "base64").toString("utf8")),
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("(404)")) return null;
    throw error;
  }
}

export async function listPosts() {
  const settings = config();
  let files: GitHubFile[];
  try {
    files = await request<GitHubFile[]>(
      `/repos/${settings.repository}/contents/${encoded(settings.contentPath)}?ref=${encodeURIComponent(settings.branch)}`,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("(404)")) return [];
    throw error;
  }

  const slugs = files
    .filter((file) => file.type === "file" && /\.md$/.test(file.name))
    .map((file) => file.name.replace(/\.md$/, ""));
  const entries = await Promise.all(slugs.map(getFile));
  return entries
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .map((entry) => entry.draft)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function savePost(input: Partial<BlogDraft>): Promise<SaveResult> {
  const draft = normalize(input);
  const settings = config();
  const filePath = `${settings.contentPath}/${draft.slug}.md`;
  const existing = await getFile(draft.slug);
  const markdown = matter.stringify(`${draft.content}\n`, {
    title: draft.title,
    publishedAt: draft.publishedAt,
    summary: draft.summary,
    tag: draft.tag,
    image: "",
  });

  const response = await request<{ commit?: { html_url?: string } }>(
    `/repos/${settings.repository}/contents/${encoded(filePath)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message: `content(blog): update ${draft.slug}`,
        content: Buffer.from(markdown).toString("base64"),
        branch: settings.branch,
        ...(existing?.sha ? { sha: existing.sha } : {}),
      }),
    },
  );
  return { path: filePath, commitUrl: response.commit?.html_url };
}

export async function deletePost(slug: string): Promise<SaveResult> {
  const settings = config();
  const existing = await getFile(slug);
  if (!existing) throw new Error("文章不存在");
  const filePath = `${settings.contentPath}/${slug}.md`;
  const response = await request<{ commit?: { html_url?: string } }>(
    `/repos/${settings.repository}/contents/${encoded(filePath)}`,
    {
      method: "DELETE",
      body: JSON.stringify({
        message: `content(blog): delete ${slug}`,
        sha: existing.sha,
        branch: settings.branch,
      }),
    },
  );
  return { path: filePath, commitUrl: response.commit?.html_url };
}
