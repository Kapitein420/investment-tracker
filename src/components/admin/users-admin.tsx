"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Plus, UserCheck, UserX, KeyRound, ShieldCheck, MapPin } from "lucide-react";
import {
  resetUserPassword,
  createUser,
  updateUser,
  getViewerAssetAccess,
  setViewerAssetAccess,
  listAssetsForViewerPicker,
} from "@/actions/admin-actions";
import { toast } from "sonner";
import { formatDate, cn } from "@/lib/utils";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
};

type AssetPickerItem = { id: string; title: string; city: string; country: string };

export function UsersAdmin({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Per-user asset access dialog state
  const [accessDialog, setAccessDialog] = useState<{ user: UserRow } | null>(null);
  const [accessAssets, setAccessAssets] = useState<AssetPickerItem[]>([]);
  const [accessSelected, setAccessSelected] = useState<Set<string>>(new Set());
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessSearch, setAccessSearch] = useState("");
  const [accessError, setAccessError] = useState<string | null>(null);

  async function loadAccessForUser(userId: string) {
    setAccessLoading(true);
    setAccessError(null);
    try {
      const [assets, granted] = await Promise.all([
        listAssetsForViewerPicker(),
        getViewerAssetAccess(userId),
      ]);
      setAccessAssets(assets);
      setAccessSelected(new Set(granted));
    } catch (e: any) {
      // Keep the dialog open so the admin sees the error inline rather
      // than the dialog flashing open and closing — the previous version
      // dismissed silently on any fetch failure, which read as "the
      // button doesn't work" from the admin's perspective.
      console.error("[openAccessDialog] failed to load:", e);
      setAccessError(e?.message ?? "Couldn't load asset access");
    } finally {
      setAccessLoading(false);
    }
  }

  async function openAccessDialog(user: UserRow) {
    setAccessDialog({ user });
    setAccessSearch("");
    setAccessAssets([]);
    setAccessSelected(new Set());
    await loadAccessForUser(user.id);
  }

  function toggleAsset(id: string) {
    setAccessSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSaveAccess() {
    if (!accessDialog) return;
    setAccessSaving(true);
    try {
      const result = await setViewerAssetAccess(
        accessDialog.user.id,
        Array.from(accessSelected)
      );
      const parts: string[] = [];
      if (result.granted > 0) parts.push(`${result.granted} granted`);
      if (result.revoked > 0) parts.push(`${result.revoked} revoked`);
      toast.success(
        parts.length > 0
          ? `Access updated · ${parts.join(", ")}`
          : "Access already up to date"
      );
      setAccessDialog(null);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save access");
    } finally {
      setAccessSaving(false);
    }
  }

  const filteredAccessAssets = useMemo(() => {
    if (!accessSearch.trim()) return accessAssets;
    const q = accessSearch.toLowerCase();
    return accessAssets.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q)
    );
  }, [accessAssets, accessSearch]);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "VIEWER" },
  });
  const watchedRole = watch("role");

  // Asset picker state for the Create User dialog (VIEWER only). Loaded
  // lazily on first dialog open so we don't fetch the list on every page
  // visit. Re-uses the same listAssetsForViewerPicker action as the
  // Manage access dialog.
  const [createAssets, setCreateAssets] = useState<AssetPickerItem[]>([]);
  const [createAssetsLoaded, setCreateAssetsLoaded] = useState(false);
  const [createAssetsLoading, setCreateAssetsLoading] = useState(false);
  const [createSelectedAssets, setCreateSelectedAssets] = useState<Set<string>>(new Set());
  const [createAssetSearch, setCreateAssetSearch] = useState("");

  useEffect(() => {
    if (!dialogOpen || createAssetsLoaded || createAssetsLoading) return;
    setCreateAssetsLoading(true);
    listAssetsForViewerPicker()
      .then((assets) => {
        setCreateAssets(assets);
        setCreateAssetsLoaded(true);
      })
      .catch((e) => {
        console.error("[create-user] failed to load assets:", e);
      })
      .finally(() => setCreateAssetsLoading(false));
  }, [dialogOpen, createAssetsLoaded, createAssetsLoading]);

  const filteredCreateAssets = useMemo(() => {
    if (!createAssetSearch.trim()) return createAssets;
    const q = createAssetSearch.toLowerCase();
    return createAssets.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q)
    );
  }, [createAssets, createAssetSearch]);

  function toggleCreateAsset(id: string) {
    setCreateSelectedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(data: CreateUserInput) {
    try {
      const payload =
        data.role === "VIEWER"
          ? { ...data, accessibleAssetIds: Array.from(createSelectedAssets) }
          : data;
      await createUser(payload);
      toast.success("User created");
      reset();
      setCreateSelectedAssets(new Set());
      setCreateAssetSearch("");
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
                  <div className="flex flex-wrap items-center gap-1">
                    {u.role === "VIEWER" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => openAccessDialog(u)}
                      >
                        <ShieldCheck className="mr-1 h-3 w-3" />
                        Manage access
                      </Button>
                    )}
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
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
              <Select
                defaultValue="VIEWER"
                onValueChange={(v: any) =>
                  setValue("role", v, { shouldDirty: true, shouldTouch: true })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="EDITOR">Editor</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {watchedRole === "VIEWER" && (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Label>Asset access</Label>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {createSelectedAssets.size} of {createAssets.length} selected
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground -mt-1">
                  Pick which assets this viewer can see. You can change this later
                  via Manage access.
                </p>

                <Input
                  placeholder="Search assets…"
                  value={createAssetSearch}
                  onChange={(e) => setCreateAssetSearch(e.target.value)}
                  className="h-8 text-sm"
                />

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      setCreateSelectedAssets(new Set(createAssets.map((a) => a.id)))
                    }
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setCreateSelectedAssets(new Set())}
                  >
                    Clear
                  </Button>
                </div>

                <div className="max-h-[220px] overflow-y-auto rounded-md border border-dils-200 bg-white">
                  {createAssetsLoading ? (
                    <p className="px-4 py-4 text-center text-xs text-muted-foreground">
                      Loading assets…
                    </p>
                  ) : filteredCreateAssets.length === 0 ? (
                    <p className="px-4 py-4 text-center text-xs text-muted-foreground">
                      {createAssetSearch ? "No assets match your search." : "No assets yet."}
                    </p>
                  ) : (
                    <ul className="divide-y divide-dils-100">
                      {filteredCreateAssets.map((a) => {
                        const checked = createSelectedAssets.has(a.id);
                        return (
                          <li key={a.id}>
                            <label
                              className={cn(
                                "flex cursor-pointer items-start gap-2.5 px-3 py-2 transition-colors hover:bg-soft-bg-surface-alt",
                                checked && "bg-status-current/5"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCreateAsset(a.id)}
                                className="mt-1 h-4 w-4 shrink-0 rounded border-dils-300 text-status-current focus:ring-status-current/40"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-foreground">{a.title}</p>
                                <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <MapPin className="h-2.5 w-2.5" strokeWidth={2} />
                                  {a.city}, {a.country}
                                </p>
                              </div>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Per-VIEWER asset-access dialog. Only ADMINs reach this surface. */}
      <Dialog
        open={!!accessDialog}
        onOpenChange={(open) => {
          if (!open && !accessSaving) setAccessDialog(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Asset access · {accessDialog?.user.name}
            </DialogTitle>
            <DialogDescription>
              Pick which assets this viewer is allowed to see. They'll only see
              these on the dashboard, and direct URLs to other assets will 404.
              ADMIN and EDITOR users always have full access.
            </DialogDescription>
          </DialogHeader>

          {accessLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : accessError ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-destructive">{accessError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => accessDialog && loadAccessForUser(accessDialog.user.id)}
              >
                Retry
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <Input
                  placeholder="Search assets…"
                  value={accessSearch}
                  onChange={(e) => setAccessSearch(e.target.value)}
                  className="h-8 text-sm"
                />
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {accessSelected.size} of {accessAssets.length} selected
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setAccessSelected(new Set(accessAssets.map((a) => a.id)))}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setAccessSelected(new Set())}
                >
                  Clear
                </Button>
              </div>

              <div className="-mx-1 max-h-[320px] overflow-y-auto rounded-md border border-dils-200 bg-white">
                {filteredAccessAssets.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                    {accessSearch ? "No assets match your search." : "No assets created yet."}
                  </p>
                ) : (
                  <ul className="divide-y divide-dils-100">
                    {filteredAccessAssets.map((a) => {
                      const checked = accessSelected.has(a.id);
                      return (
                        <li key={a.id}>
                          <label
                            className={cn(
                              "flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-soft-bg-surface-alt",
                              checked && "bg-status-current/5"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAsset(a.id)}
                              className="mt-1 h-4 w-4 shrink-0 rounded border-dils-300 text-status-current focus:ring-status-current/40"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <MapPin className="h-3 w-3" strokeWidth={2} />
                                {a.city}, {a.country}
                              </p>
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAccessDialog(null)}
              disabled={accessSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveAccess}
              disabled={accessSaving || accessLoading || !!accessError}
            >
              {accessSaving ? "Saving…" : "Save access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
