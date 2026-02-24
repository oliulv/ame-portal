"use client";

import { useEffect, useRef } from "react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { api } from "@/convex/_generated/api";

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` to generate it, or add it to .env.local from your Convex dashboard."
  );
}

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL);

/**
 * Ensures the authenticated Clerk user has a record in the Convex users table.
 * Runs once on mount when the user is authenticated.
 */
function EnsureUser() {
  const { isSignedIn } = useAuth();
  const ensureUser = useMutation(api.users.ensureUser);
  const didRun = useRef(false);

  useEffect(() => {
    if (isSignedIn && !didRun.current) {
      didRun.current = true;
      ensureUser().catch(() => {
        // Ignore errors — the user might already exist (race condition)
        didRun.current = false;
      });
    }
  }, [isSignedIn, ensureUser]);

  return null;
}

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <EnsureUser />
      {children}
      <Toaster position="top-right" richColors />
    </ConvexProviderWithClerk>
  );
}
