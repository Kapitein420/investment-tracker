"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserSchema, type CreateUserInput } from "@/lib/validators";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, UserCheck, UserX, KeyRound } from "lucide-react";
import { resetUserPassword, createUser, updateUser } from "@/actions/admin-actions";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
};

export function UsersAdmin({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "VIEWER" },
  });

  async function onSubmit(data: CreateUserInput) {
    try {
      await createUser(data);
      toast.success("User created");
      reset();
      setDialogOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to create user");
    }
  }

  async function toggleActive(userId: string, currentState: boolean) {
    try {
      await updateUser(userId, { isActive: !currentState });
      toast.success(currentState ? "User deactivated" : "User reactivated");
      router.refresh();
    } catch {
      toast.error("Failed to update user");
    }
  }

  async function handleResetPassword(userId: string, email: string) {
    if (!confirm(`Reset password for ${email}? A new password will be emailed to them.`)) return;
    try {
      await resetUserPassword(userId);
      toast.success(`Password reset email sent to ${email}`);
    } catch {
      toast.error("Failed to reset password");
    }
  }

  async function changeRole(userId: string, role: Role) {
    try {
      await updateUser(userId, { role });
      toast.success("Role updated");
      router.refresh();
    } catch {
      toast.error("Failed to update role");
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="dils-accent inline-block font-heading text-3xl font-bold tracking-tight text-dils-black">
            Team
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-prose">
            Internal team accounts (Admin, Editor, Viewer). Investor accounts live on the Investors page.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" strokeWidth={2} />
          Add Team Member
        </Button>
      </div>

      <div className="rounded-md border border-dils-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-dils-50">
            <tr className="border-b border-dils-100">
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-dils-600">Name</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-dils-600">Email</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-dils-600">Role</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-dils-600">Status</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-dils-600">Created</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-dils-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-dils-100 hover:bg-dils-50/50">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <Select value={u.role} onValueChange={(v) => changeRole(u.id, v as Role)}>
                    <SelectTrigger className="h-7 w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="EDITOR">Editor</SelectItem>
                      <SelectItem value="VIEWER">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={u.isActive ? "secondary" : "destructive"} className="text-xs">
                    {u.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => toggleActive(u.id, u.isActive)}
                  >
                    {u.isActive ? (
                      <><UserX className="mr-1 h-3 w-3" />Deactivate</>
                    ) : (
                      <><UserCheck className="mr-1 h-3 w-3" />Reactivate</>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleResetPassword(u.id, u.email)}
                  >
                    <KeyRound className="mr-1 h-3 w-3" />
                    Reset Password
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>Create an internal team account (Admin, Editor, or Viewer).</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input {...register("email")} type="email" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input {...register("password")} type="password" />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select defaultValue="VIEWER" onValueChange={(v: any) => setValue("role", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="EDITOR">Editor</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
