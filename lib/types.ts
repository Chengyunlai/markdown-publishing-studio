export type BlogDraft = {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  tag: string;
  content: string;
};

export type SaveResult = {
  commitUrl?: string;
  path: string;
};
