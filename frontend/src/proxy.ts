import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { portalPath, roleForPath } from "@/lib/auth/routes";

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  let apiOrigin = "";
  try {
    if (process.env.NEXT_PUBLIC_API_BASE_URL) apiOrigin = new URL(process.env.NEXT_PUBLIC_API_BASE_URL).origin;
  } catch {
    apiOrigin = "";
  }
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style *attributes* are required by charting/progress components; scripts stay nonce-locked.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ""}${isDev ? " ws:" : ""}`,
    `media-src 'self' blob:`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    // Lesson videos embed only through YouTube's privacy-enhanced domain.
    `frame-src https://www.youtube-nocookie.com`,
    `base-uri 'self'`,
    // Fee payments: PayU and CCAvenue take the student to their hosted checkout with a form POST.
    `form-action 'self' https://secure.payu.in https://test.payu.in https://secure.ccavenue.com https://test.ccavenue.com`,
    `frame-ancestors 'none'`,
    isDev ? "" : "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ");
}

function withSecurity(res: NextResponse, csp: string): NextResponse {
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const { pathname, search } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // The page path, for server-side guards that depend on it (the academic-year fee lock). Always set here, so a
  // client-supplied value never reaches the server.
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("Content-Security-Policy", csp);

  const portalRole = roleForPath(pathname);
  const isAuthPage = pathname === "/login" || pathname.startsWith("/login/");

  if (portalRole || isAuthPage) {
    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

    if (portalRole) {
      if (!session) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.search = `?next=${encodeURIComponent(pathname + search)}`;
        const res = NextResponse.redirect(url);
        res.cookies.delete(SESSION_COOKIE);
        return withSecurity(res, csp);
      }
      if (!session.mfa) {
        const url = request.nextUrl.clone();
        url.pathname = "/login/mfa";
        url.search = "";
        return withSecurity(NextResponse.redirect(url), csp);
      }
      // Role → portal isolation: a user can only enter their own portal.
      if (session.role !== portalRole) {
        const url = request.nextUrl.clone();
        url.pathname = "/forbidden";
        url.search = "";
        return withSecurity(NextResponse.rewrite(url, { request: { headers: requestHeaders } }), csp);
      }
    } else if (session?.mfa && pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = portalPath(session.role);
      url.search = "";
      return withSecurity(NextResponse.redirect(url), csp);
    }
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  return withSecurity(res, csp);
}

export const config = {
  // Prefetch requests are intentionally NOT excluded: every page request (including RSC prefetches)
  // goes through the auth gate. The portal layout re-verifies the session server-side as well.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons|sw.js|manifest.webmanifest|robots.txt).*)"],
};
