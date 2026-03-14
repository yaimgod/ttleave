import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LoginForm } from "@/components/auth/LoginForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { getSafeRedirectPath } from "@/lib/utils/safeRedirect";

export const metadata = { title: "Sign in — TTLeave" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string };
}) {
  const redirectTo = getSafeRedirectPath(searchParams.redirectTo);

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
        <CardDescription>Sign in to your TTLeave account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <OAuthButtons redirectTo={redirectTo} />
        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
            or continue with email
          </span>
        </div>
        <LoginForm redirectTo={redirectTo} />
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <span className="text-muted-foreground">
          Don&apos;t have an account?&nbsp;
        </span>
        <Link
          href="/signup"
          className="font-medium underline-offset-4 hover:underline"
        >
          Sign up
        </Link>
      </CardFooter>
    </Card>
  );
}
