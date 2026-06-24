import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GoogleLogo } from "@/components/icons/google-logo";
import { SignIn } from "@/components/icons/sign-in";
import Link from "next/link";

async function handleSignIn() {
  "use server";
  await signIn("google", { redirectTo: "/" });
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-qc-parchment p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-3xl">Welcome Back</CardTitle>
          <CardDescription className="font-body">
            Sign in to access your curriculum generation platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSignIn}>
            <Button
              type="submit"
              variant="default"
              size="lg"
              className="w-full"
            >
              <GoogleLogo weight="fill" size={20} />
              Continue with Google
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-qc-border-subtle" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 font-body text-qc-text-muted">
                New to Quill &amp; Compass?
              </span>
            </div>
          </div>
          <Button variant="outline" size="lg" className="w-full" asChild>
            <Link href="/signup">
              <SignIn weight="regular" size={20} />
              Create an Account
            </Link>
          </Button>
          <p className="text-center text-xs font-body text-qc-text-muted/70">
            Quill &amp; Compass requires an internet connection for all features.
          </p>
          <p className="text-center text-xs font-body text-qc-text-muted">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-qc-primary">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-qc-primary">
              Privacy Policy
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

