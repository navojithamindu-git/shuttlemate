import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/availability/:path*",
    "/dashboard/:path*",
    "/groups/:path*",
    "/messages/:path*",
    "/my-sessions/:path*",
    "/profile/:path*",
    "/login",
    "/signup",
    "/auth/:path*",
  ],
};
