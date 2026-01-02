"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Loader2, Mail, UserPlus } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/trpc/client";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const trpc = useTRPC();
  const token = params.token as string;

  const invitationQuery = useQuery(
    trpc.organization.getInvitationByToken.queryOptions({ token }),
  );

  const acceptMutation = useMutation(
    trpc.organization.acceptInvitation.mutationOptions({
      onSuccess: () => {
        router.push("/");
        router.refresh();
      },
    }),
  );

  const handleAccept = () => {
    acceptMutation.mutate({ token });
  };

  if (invitationQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Skeleton className="mx-auto mb-4 h-12 w-12 rounded-full" />
            <Skeleton className="mx-auto h-6 w-48" />
            <Skeleton className="mx-auto mt-2 h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (invitationQuery.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <Mail className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Please ask the organization administrator to send you a new
              invitation.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button asChild>
              <Link href="/sign-in">Go to Sign In</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const invitation = invitationQuery.data;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>You're Invited!</CardTitle>
          <CardDescription>
            You've been invited to join an organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 rounded-lg border bg-zinc-50 p-4 dark:bg-zinc-900">
            <div>
              <p className="text-sm text-muted-foreground">Organization</p>
              <p className="font-semibold">{invitation?.organizationName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Invited by</p>
              <p className="font-medium">{invitation?.invitedBy}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your role</p>
              <p className="font-medium capitalize">{invitation?.role}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{invitation?.email}</p>
            </div>
          </div>

          {acceptMutation.error && (
            <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm text-destructive">
                {acceptMutation.error.message}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button
            onClick={handleAccept}
            disabled={acceptMutation.isPending}
            className="w-full"
          >
            {acceptMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Accept Invitation
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            By accepting, you'll join the organization and can start
            collaborating immediately.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
