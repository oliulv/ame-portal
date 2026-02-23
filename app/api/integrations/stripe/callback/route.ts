import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import Stripe from "stripe";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/integrations/stripe/callback
 * Handles Stripe OAuth callback and stores connection via Convex mutation.
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/founder/settings?error=not_authenticated`
      );
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // Contains startup_id
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/founder/settings?error=stripe_connection_failed`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/founder/settings?error=stripe_connection_invalid`
      );
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/founder/settings?error=stripe_config_missing`
      );
    }

    // Exchange authorization code for access token
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-11-17.clover",
    });

    const response = await stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });

    const accountId = response.stripe_user_id || "";
    const accountName = response.stripe_publishable_key
      ? "Connected Account"
      : undefined;
    const accessToken = response.access_token;

    if (!accessToken) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/founder/settings?error=stripe_token_missing`
      );
    }

    // Store connection via Convex mutation
    await convex.mutation(api.integrations.storeStripeConnection, {
      startupId: state as any,
      accessToken,
      accountId,
      accountName,
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/founder/settings?success=stripe_connected`
    );
  } catch (error) {
    console.error("Error handling Stripe callback:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/founder/settings?error=stripe_connection_error`
    );
  }
}
