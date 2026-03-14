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
import { SignupForm } from "@/components/auth/SignupForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export const metadata = { title: "Create account — TTLeave" };

export default function SignupPage() {
  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
        <CardDescription>Start tracking your countdowns today</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <OAuthButtons />
        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
            or sign up with email
          </span>
        </div>
        <SignupForm />
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <span className="text-muted-foreground">
          Already have an account?&nbsp;
        </span>
        <Link
          href="/login"
          className="font-medium underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
