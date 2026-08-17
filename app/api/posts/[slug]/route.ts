import { isAuthenticated } from "@/lib/auth";
import { deletePost, savePost } from "@/lib/github";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ slug: string }> };

export async function PUT(request: NextRequest, { params }: RouteContext) {
  if (!isAuthenticated(request)) return NextResponse.json({ message: "未登录" }, { status: 401 });
  try {
    const { slug } = await params;
    return NextResponse.json({ saved: true, ...(await savePost({ ...(await request.json()), slug })) });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "保存文章失败" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  if (!isAuthenticated(request)) return NextResponse.json({ message: "未登录" }, { status: 401 });
  try {
    const { slug } = await params;
    return NextResponse.json({ deleted: true, ...(await deletePost(slug)) });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "删除文章失败" },
      { status: 400 },
    );
  }
}
