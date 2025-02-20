import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  let hostURL;
  if (process.env.NODE_ENV === "production") {
    hostURL = `${
      req.nextUrl.protocol + "//" + req.nextUrl.hostname + req.nextUrl.pathname
    }`;
  } else {
    hostURL = req.url;
  }

  const { userId, redirectToSignIn } = await auth();

  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  //   if (userId && !isPublicRoute(req)) {
  //     const user = (await clerkClient()).users.getUser(userId);
  //     const userData = (await user).privateMetadata;

  //     if (userData.role === "Admin" || userData.role === "Staff") {
  //       return NextResponse.next();
  //     } else {
  //       await auth.protect();
  //       return redirectToSignIn();
  //     }
  //   }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
