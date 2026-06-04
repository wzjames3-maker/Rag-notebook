import { auth } from "@/lib/auth";

export const proxy = auth((req) => {
  const isAuthPage =
    req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/register");
  const isAuthenticated = !!req.auth;

  if (isAuthPage && isAuthenticated) {
    return Response.redirect(new URL("/dashboard", req.url));
  }

  const protectedPaths = ["/dashboard", "/notes", "/knowledge", "/chat", "/trash"];
  const isProtected = protectedPaths.some((p) =>
    req.nextUrl.pathname.startsWith(p)
  );

  if (isProtected && !isAuthenticated) {
    return Response.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
