import { isAuthenticated } from "@/lib/auth";
import { listPosts, savePost } from "@/lib/github";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) return NextResponse.json({ message: "未登录" }, { status: 401 });
  try {
    return NextResponse.json({ posts: await listPosts() });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "读取文章失败" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) return NextResponse.json({ message: "未登录" }, { status: 401 });
  try {
    return NextResponse.json({ saved: true, ...(await savePost(await request.json())) });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "保存文章失败" },
      { status: 400 },
    );
  }
}
