"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Camera,
  Crown,
  Loader2,
  Mail,
  MoreHorizontal,
  Shield,
  Trash2,
  User,
  UserMinus,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AvatarUpload } from "@/components/avatar-upload";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/trpc/client";

type MemberRole = "owner" | "admin" | "member";

function getRoleIcon(role: MemberRole) {
  switch (role) {
    case "owner":
      return <Crown className="h-4 w-4 text-amber-500" />;
    case "admin":
      return <Shield className="h-4 w-4 text-blue-500" />;
    default:
      return <User className="h-4 w-4 text-zinc-500" />;
  }
}

function getRoleBadgeVariant(role: MemberRole) {
  switch (role) {
    case "owner":
      return "default";
    case "admin":
      return "secondary";
    default:
      return "outline";
  }
}

export default function OrganizationSettingsPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Queries
  const orgQuery = useQuery(trpc.organization.get.queryOptions());
  const membersQuery = useQuery(trpc.organization.listMembers.queryOptions());
  const invitationsQuery = useQuery(
    trpc.organization.listInvitations.queryOptions(),
  );

  // State for dialogs
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [memberToChangeRole, setMemberToChangeRole] = useState<{
    id: string;
    email: string;
    currentRole: MemberRole;
  } | null>(null);
  const [memberToTransferOwnership, setMemberToTransferOwnership] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [invitationToCancel, setInvitationToCancel] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  // Mutations
  const inviteMemberMutation = useMutation(
    trpc.organization.inviteMember.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.organization.listInvitations.queryKey(),
        });
        setInviteDialogOpen(false);
        setInviteEmail("");
        setInviteRole("member");
        setInviteError(null);
      },
      onError: (error) => {
        setInviteError(error.message);
      },
    }),
  );

  const updateMemberRoleMutation = useMutation(
    trpc.organization.updateMemberRole.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.organization.listMembers.queryKey(),
        });
        setMemberToChangeRole(null);
      },
    }),
  );

  const removeMemberMutation = useMutation(
    trpc.organization.removeMember.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.organization.listMembers.queryKey(),
        });
        setMemberToRemove(null);
      },
    }),
  );

  const cancelInvitationMutation = useMutation(
    trpc.organization.cancelInvitation.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.organization.listInvitations.queryKey(),
        });
        setInvitationToCancel(null);
      },
    }),
  );

  const transferOwnershipMutation = useMutation(
    trpc.organization.transferOwnership.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.organization.listMembers.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.organization.get.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.auth.me.queryKey(),
        });
        setMemberToTransferOwnership(null);
        router.refresh();
      },
    }),
  );

  const leaveOrgMutation = useMutation(
    trpc.organization.leave.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        router.push("/");
        router.refresh();
      },
    }),
  );

  const deleteOrgMutation = useMutation(
    trpc.organization.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        router.push("/");
        router.refresh();
      },
    }),
  );

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      setInviteError("Email is required");
      return;
    }
    setInviteError(null);
    inviteMemberMutation.mutate({
      email: inviteEmail.trim(),
      role: inviteRole,
    });
  };

  const isLoading =
    orgQuery.isLoading || membersQuery.isLoading || invitationsQuery.isLoading;
  const org = orgQuery.data;
  const members = membersQuery.data ?? [];
  const invitations = invitationsQuery.data ?? [];
  const isOwner = org?.userRole === "owner";
  const isAdmin = org?.userRole === "admin" || isOwner;

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="mb-2 h-9 w-64" />
        <Skeleton className="mb-8 h-5 w-48" />
        <div className="space-y-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Organization not found</p>
            <Button asChild className="mt-4">
              <Link href="/">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground">{org.name}</p>
      </div>

      <div className="space-y-6">
        {/* Organization Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Details
            </CardTitle>
            <CardDescription>
              View information about your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Name</Label>
                <p className="font-medium">{org.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Slug</Label>
                <p className="font-mono text-sm">{org.slug}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Members</Label>
                <p className="font-medium">{org.memberCount}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Your Role</Label>
                <div className="flex items-center gap-2">
                  {getRoleIcon(org.userRole as MemberRole)}
                  <span className="font-medium capitalize">{org.userRole}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organization Avatar */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Organization Avatar
              </CardTitle>
              <CardDescription>
                Customize your organization's profile picture
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AvatarUpload type="organization" fallbackText={org.name} />
            </CardContent>
          </Card>
        )}

        {/* Team Members */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  Manage your organization's team members
                </CardDescription>
              </div>
              {isAdmin && (
                <Button onClick={() => setInviteDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Member
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                      {getRoleIcon(member.role as MemberRole)}
                    </div>
                    <div>
                      <p className="font-medium">
                        {member.email}
                        {member.isCurrentUser && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={getRoleBadgeVariant(member.role as MemberRole)}
                    >
                      {member.role}
                    </Badge>
                    {isAdmin && !member.isCurrentUser && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {member.role !== "owner" && (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  setMemberToChangeRole({
                                    id: member.id,
                                    email: member.email,
                                    currentRole: member.role as MemberRole,
                                  })
                                }
                              >
                                <Shield className="mr-2 h-4 w-4" />
                                Change Role
                              </DropdownMenuItem>
                              {isOwner && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setMemberToTransferOwnership({
                                      id: member.id,
                                      email: member.email,
                                    })
                                  }
                                >
                                  <Crown className="mr-2 h-4 w-4" />
                                  Transfer Ownership
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() =>
                                  setMemberToRemove({
                                    id: member.id,
                                    email: member.email,
                                  })
                                }
                              >
                                <UserMinus className="mr-2 h-4 w-4" />
                                Remove
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {isAdmin && invitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Pending Invitations
              </CardTitle>
              <CardDescription>
                Invitations that haven't been accepted yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">{invitation.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Invited by {invitation.invitedBy} • Expires{" "}
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{invitation.role}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setInvitationToCancel({
                            id: invitation.id,
                            email: invitation.email,
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isOwner && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Leave Organization</p>
                  <p className="text-sm text-muted-foreground">
                    Remove yourself from this organization
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setLeaveDialogOpen(true)}
                >
                  Leave
                </Button>
              </div>
            )}
            {isOwner && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Delete Organization</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete this organization and all its data
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <form onSubmit={handleInvite}>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation email to add a new member to your
                organization.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={inviteMemberMutation.isPending}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(value) =>
                    setInviteRole(value as "admin" | "member")
                  }
                  disabled={inviteMemberMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    {isOwner && <SelectItem value="admin">Admin</SelectItem>}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {inviteRole === "admin"
                    ? "Admins can manage members and organization settings"
                    : "Members can view and work on todos"}
                </p>
              </div>
              {inviteError && (
                <p className="text-sm text-destructive">{inviteError}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteDialogOpen(false)}
                disabled={inviteMemberMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={inviteMemberMutation.isPending}>
                {inviteMemberMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog
        open={!!memberToChangeRole}
        onOpenChange={(open) => !open && setMemberToChangeRole(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Member Role</DialogTitle>
            <DialogDescription>
              Change the role for {memberToChangeRole?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={memberToChangeRole?.currentRole}
              onValueChange={(value) => {
                if (memberToChangeRole) {
                  updateMemberRoleMutation.mutate({
                    memberId: memberToChangeRole.id,
                    role: value as "admin" | "member",
                  });
                }
              }}
              disabled={updateMemberRoleMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                {isOwner && <SelectItem value="admin">Admin</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMemberToChangeRole(null)}
              disabled={updateMemberRoleMutation.isPending}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation */}
      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.email} from this
              organization? They will lose access to all organization resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMemberMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (memberToRemove) {
                  removeMemberMutation.mutate({ memberId: memberToRemove.id });
                }
              }}
              disabled={removeMemberMutation.isPending}
            >
              {removeMemberMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Ownership Confirmation */}
      <AlertDialog
        open={!!memberToTransferOwnership}
        onOpenChange={(open) => !open && setMemberToTransferOwnership(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Ownership</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to transfer ownership to{" "}
              {memberToTransferOwnership?.email}? You will become an admin and
              they will become the owner. This action cannot be easily undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transferOwnershipMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (memberToTransferOwnership) {
                  transferOwnershipMutation.mutate({
                    memberId: memberToTransferOwnership.id,
                  });
                }
              }}
              disabled={transferOwnershipMutation.isPending}
            >
              {transferOwnershipMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Transfer Ownership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Invitation Confirmation */}
      <AlertDialog
        open={!!invitationToCancel}
        onOpenChange={(open) => !open && setInvitationToCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the invitation to{" "}
              {invitationToCancel?.email}? They will no longer be able to join
              using this invitation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelInvitationMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (invitationToCancel) {
                  cancelInvitationMutation.mutate({
                    invitationId: invitationToCancel.id,
                  });
                }
              }}
              disabled={cancelInvitationMutation.isPending}
            >
              {cancelInvitationMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Cancel Invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Organization Confirmation */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this organization? You will lose
              access to all organization resources and will need to be invited
              again to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaveOrgMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => leaveOrgMutation.mutate()}
              disabled={leaveOrgMutation.isPending}
            >
              {leaveOrgMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Leave Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Organization Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              organization "{org.name}" and all of its data, including all todos
              and member associations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteOrgMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteOrgMutation.mutate()}
              disabled={deleteOrgMutation.isPending}
            >
              {deleteOrgMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
