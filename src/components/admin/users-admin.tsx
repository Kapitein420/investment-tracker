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
import { Plus, UserCheck, UserX } from "lucide-react";
import { createUser, updateUser } from "@/actions/admin-actions";
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
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Manage user accounts and roles</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="border-b">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Created</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>Add a new user account.</DialogDescription>
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
