"use client"

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { GameSupport } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type GameSupportForm = {
  gameName: string;
  logoUrl: string;
  status: "ready" | "maintenance" | "comingsoon";
  sortOrder: number;
};

const defaultForm: GameSupportForm = {
  gameName: "",
  logoUrl: "",
  status: "ready",
  sortOrder: 0,
};

function normalizeUrl(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith("//")) return `https:${v}`;
  return `https://${v}`;
}

function buildPayload(form: GameSupportForm) {
  return {
    gameName: form.gameName.trim(),
    logoUrl: normalizeUrl(form.logoUrl),
    status: form.status,
    sortOrder: Number.isFinite(form.sortOrder) ? form.sortOrder : 0,
  };
}

export default function GameSupportAdmin() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const { data, isLoading, error } = useQuery<{ items: GameSupport[]; total: number }>({
    queryKey: ["/api/game-support", page],
    queryFn: async () => {
      const offset = (page - 1) * pageSize;
      const res = await fetch(`/api/game-support?limit=${pageSize}&offset=${offset}`);
      if (!res.ok) {
        const text = await res.text();
        let message = "Gagal mengambil data game support";
        try {
          const json = JSON.parse(text);
          message = json.message || message;
        } catch {
          message = text || message;
        }
        throw new Error(message);
      }
      return res.json();
    },
  });
  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GameSupport | null>(null);
  const [form, setForm] = useState<GameSupportForm>({ ...defaultForm });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: GameSupportForm) => apiRequest("POST", "/api/game-support", buildPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-support"] });
      setDialogOpen(false);
      setForm({ ...defaultForm });
      toast({ title: "Game ditambahkan" });
      setPage(1);
    },
    onError: (e: Error) => {
      const msg = e.message.includes("relation") && e.message.includes("game_support") ? "Tabel game_support belum ada. Jalankan db:push dulu." : e.message;
      toast({ title: "Gagal menambah game", description: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: GameSupportForm }) =>
      apiRequest("PATCH", `/api/game-support/${id}`, buildPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-support"] });
      setDialogOpen(false);
      setEditing(null);
      setForm({ ...defaultForm });
      toast({ title: "Game diupdate" });
    },
    onError: (e: Error) => toast({ title: "Gagal update game", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/game-support/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-support"] });
      setDeleteId(null);
      toast({ title: "Game dihapus" });
      setPage(1);
    },
    onError: (e: Error) => toast({ title: "Gagal hapus game", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...defaultForm });
    setDialogOpen(true);
  };

  const openEdit = (item: GameSupport) => {
    setEditing(item);
    setForm({
      gameName: item.gameName || "",
      logoUrl: item.logoUrl || "",
      status: (item as any).status || "ready",
      sortOrder: Number(item.sortOrder || 0),
    });
    setDialogOpen(true);
  };

  const submit = () => {
    if (!form.gameName.trim() || !form.logoUrl.trim()) {
      toast({ title: "Form belum lengkap", description: "Nama game dan URL logo wajib diisi", variant: "destructive" });
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-wide">Game Support</h1>
          <p className="text-muted-foreground">Kelola daftar game yang didukung untuk landing page.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Game
        </Button>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Daftar Game</CardTitle>
          <CardDescription>{total} item</CardDescription>
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
            <div className="text-sm text-muted-foreground">Belum ada game.</div>
          ) : (
            <>
              <div className="space-y-3">
                {items
                  .slice()
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id)
                  .map((g) => (
                    <div key={g.id} className="flex flex-col gap-3 rounded-xl border bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-lg border bg-muted">
                          {g.logoUrl ? <img src={g.logoUrl} alt="" className="h-full w-full object-cover" /> : null}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{g.gameName}</div>
                          <div className="truncate text-xs text-muted-foreground">{g.logoUrl}</div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {(() => {
                          const status = (g as any).status || "ready";
                          const pill =
                            status === "maintenance"
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                              : status === "comingsoon"
                                ? "bg-muted/40 text-muted-foreground border-border"
                                : "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
                          const label = status === "maintenance" ? "Maintenance" : status === "comingsoon" ? "Coming Soon" : "Ready";
                          return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${pill}`}>{label}</span>;
                        })()}
                        <span className="text-xs text-muted-foreground">sort: {g.sortOrder ?? 0}</span>
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => openEdit(g)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-2" onClick={() => setDeleteId(g.id)}>
                          <Trash2 className="h-4 w-4" />
                          Hapus
                        </Button>
                      </div>
                    </div>
                  ))}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Game" : "Tambah Game"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="gameName">Nama Game</Label>
              <Input id="gameName" value={form.gameName} onChange={(e) => setForm((p) => ({ ...p, gameName: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <div className="flex gap-2">
                <Input
                  id="logoUrl"
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={form.logoUrl}
                  onChange={(e) => setForm((p) => ({ ...p, logoUrl: e.target.value }))}
                  onPaste={(e) => {
                    e.stopPropagation();
                    const text = e.clipboardData.getData("text");
                    if (text) {
                      e.preventDefault();
                      setForm((p) => ({ ...p, logoUrl: text }));
                    }
                  }}
                  onDrop={(e) => {
                    const text = e.dataTransfer.getData("text");
                    if (text) {
                      e.preventDefault();
                      setForm((p) => ({ ...p, logoUrl: text }));
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  placeholder="https://..."
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (!text) return;
                      setForm((p) => ({ ...p, logoUrl: text }));
                    } catch (e) {
                      toast({ title: "Gagal paste", description: e instanceof Error ? e.message : "Clipboard tidak tersedia", variant: "destructive" });
                    }
                  }}
                >
                  Paste
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Status (opsional)</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as GameSupportForm["status"] }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="comingsoon">Coming Soon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Input id="sortOrder" type="number" value={form.sortOrder} onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))} />
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={createMutation.isPending || updateMutation.isPending}>
                Batal
              </Button>
              <Button onClick={submit} disabled={createMutation.isPending || updateMutation.isPending} className="gap-2">
                {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Simpan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus Game?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Tindakan ini tidak bisa dibatalkan.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleteMutation.isPending}>
              Batal
            </Button>
            <Button variant="destructive" onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Hapus
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
