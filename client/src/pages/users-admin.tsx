"use client"

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Loader2, Search, ShieldBan, TriangleAlert, Trash2, ShieldCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AdminUserRow = {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  warningCount: number;
  lastWarningAt: string | null;
  isBanned: number;
  bannedAt: string | null;
  banReason: string | null;
};

function formatDateTimeId(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function UsersAdmin() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery<{ items: AdminUserRow[]; total: number }>({
    queryKey: ["/api/admin/users", page, search],
    queryFn: async () => {
      const offset = (page - 1) * pageSize;
      const s = search.trim();
      const q = new URLSearchParams();
      q.set("limit", String(pageSize));
      q.set("offset", String(offset));
      if (s) q.set("search", s);
      return apiRequest("GET", `/api/admin/users?${q.toString()}`);
    },
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [warnTarget, setWarnTarget] = useState<AdminUserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banTarget, setBanTarget] = useState<AdminUserRow | null>(null);
  const [banReason, setBanReason] = useState("");

  const warnMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/users/${encodeURIComponent(id)}/warn`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Peringatan dikirim" });
      setWarnTarget(null);
    },
    onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  const banMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest("POST", `/api/admin/users/${encodeURIComponent(id)}/ban`, { reason: reason.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User dibanned" });
      setBanDialogOpen(false);
      setBanTarget(null);
      setBanReason("");
    },
    onError: (e: Error) => toast({ title: "Gagal ban user", description: e.message, variant: "destructive" }),
  });

  const unbanMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/users/${encodeURIComponent(id)}/unban`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User di-unban" });
    },
    onError: (e: Error) => toast({ title: "Gagal unban", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/users/${encodeURIComponent(id)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User dihapus" });
      setDeleteTarget(null);
      setPage(1);
    },
    onError: (e: Error) => toast({ title: "Gagal hapus user", description: e.message, variant: "destructive" }),
  });

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-wide">Users</h1>
          <p className="text-muted-foreground">Kelola user terdaftar (peringatan, ban, delete).</p>
        </div>
        <form onSubmit={submitSearch} className="flex w-full max-w-md gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari username / email..."
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Daftar User</CardTitle>
          <CardDescription>{total} user</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : error ? (
            <div className="text-sm text-destructive">{(error as Error).message}</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">Tidak ada user.</div>
          ) : (
            <>
              <div className="space-y-3">
                {items.map((u) => {
                  const banned = u.isBanned === 1;
                  return (
                    <div key={u.id} className="flex flex-col gap-3 rounded-xl border bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold">{u.username}</div>
                          {banned ? <Badge variant="destructive">Banned</Badge> : <Badge variant="outline">Active</Badge>}
                          {u.warningCount > 0 ? <Badge variant="secondary">Warn: {u.warningCount}</Badge> : null}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">{u.email}</div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Created: {formatDateTimeId(u.createdAt)}</span>
                          <span>Last warn: {formatDateTimeId(u.lastWarningAt)}</span>
                          <span>Banned at: {formatDateTimeId(u.bannedAt)}</span>
                        </div>
                        {u.banReason ? <div className="mt-2 text-xs text-muted-foreground">Reason: {u.banReason}</div> : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => setWarnTarget(u)}
                        >
                          <TriangleAlert className="h-4 w-4" />
                          Warn
                        </Button>
                        {banned ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => unbanMutation.mutate(u.id)}
                            disabled={unbanMutation.isPending}
                          >
                            {unbanMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                            Unban
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-2"
                            onClick={() => {
                              setBanTarget(u);
                              setBanReason("");
                              setBanDialogOpen(true);
                            }}
                          >
                            <ShieldBan className="h-4 w-4" />
                            Ban
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 text-destructive"
                          onClick={() => setDeleteTarget(u)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setPage((p) => Math.max(1, p - 1));
                          }}
                          className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let p: number;
                        if (totalPages <= 5) p = i + 1;
                        else if (page <= 3) p = i + 1;
                        else if (page >= totalPages - 2) p = totalPages - 4 + i;
                        else p = page - 2 + i;
                        return (
                          <PaginationItem key={p}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setPage(p);
                              }}
                              isActive={page === p}
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setPage((p) => Math.min(totalPages, p + 1));
                          }}
                          className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={warnTarget !== null} onOpenChange={() => setWarnTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kirim Peringatan?</AlertDialogTitle>
            <AlertDialogDescription>
              Peringatan akan menambah counter warning untuk user: <span className="font-semibold">{warnTarget?.username}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={warnMutation.isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => warnTarget && warnMutation.mutate(warnTarget.id)}
              disabled={!warnTarget || warnMutation.isPending}
            >
              {warnMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Warn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="text-sm text-muted-foreground">
              User: <span className="font-semibold text-foreground">{banTarget?.username}</span>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="banReason">Alasan (opsional)</Label>
              <Input id="banReason" value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Misal: spam / abuse" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setBanDialogOpen(false)} disabled={banMutation.isPending}>Batal</Button>
              <Button
                variant="destructive"
                onClick={() => banTarget && banMutation.mutate({ id: banTarget.id, reason: banReason })}
                disabled={!banTarget || banMutation.isPending}
              >
                {banMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Ban
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus User?</AlertDialogTitle>
            <AlertDialogDescription>
              User: <span className="font-semibold">{deleteTarget?.username}</span>. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={!deleteTarget || deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
