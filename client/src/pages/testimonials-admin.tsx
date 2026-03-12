"use client"

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Loader2, Pencil, Plus, Trash2, Star } from "lucide-react";
import type { Testimonial } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type TestimonialForm = {
  fullName: string;
  profileUrl: string;
  message: string;
  rating: number;
  sortOrder: number;
};

const defaultForm: TestimonialForm = {
  fullName: "",
  profileUrl: "",
  message: "",
  rating: 5,
  sortOrder: 0,
};

function normalizeUrl(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith("//")) return `https:${v}`;
  return `https://${v}`;
}

function buildPayload(form: TestimonialForm) {
  return {
    fullName: form.fullName.trim(),
    profileUrl: normalizeUrl(form.profileUrl),
    message: form.message.trim(),
    rating: Math.max(1, Math.min(5, Number(form.rating || 5))),
    sortOrder: Number.isFinite(form.sortOrder) ? form.sortOrder : 0,
  };
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="inline-flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={i < rating ? "h-4 w-4 text-amber-400" : "h-4 w-4 text-muted-foreground/30"} />
      ))}
    </div>
  );
}

export default function TestimonialsAdmin() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { data, isLoading, error } = useQuery<{ items: Testimonial[]; total: number }>({
    queryKey: ["/api/testimonials", page],
    queryFn: async () => {
      const offset = (page - 1) * pageSize;
      const res = await fetch(`/api/testimonials?limit=${pageSize}&offset=${offset}`);
      if (!res.ok) {
        const text = await res.text();
        let message = "Gagal mengambil data testimonials";
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
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [form, setForm] = useState<TestimonialForm>({ ...defaultForm });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: TestimonialForm) => apiRequest("POST", "/api/testimonials", buildPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/testimonials"] });
      setDialogOpen(false);
      setForm({ ...defaultForm });
      toast({ title: "Testimoni ditambahkan" });
      setPage(1);
    },
    onError: (e: Error) => {
      const msg = e.message.includes("relation") && e.message.includes("testimonials") ? "Tabel testimonials belum ada. Jalankan db:push dulu." : e.message;
      toast({ title: "Gagal menambah testimoni", description: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TestimonialForm }) =>
      apiRequest("PATCH", `/api/testimonials/${id}`, buildPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/testimonials"] });
      setDialogOpen(false);
      setEditing(null);
      setForm({ ...defaultForm });
      toast({ title: "Testimoni diupdate" });
    },
    onError: (e: Error) => toast({ title: "Gagal update testimoni", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/testimonials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/testimonials"] });
      setDeleteId(null);
      toast({ title: "Testimoni dihapus" });
      setPage(1);
    },
    onError: (e: Error) => toast({ title: "Gagal hapus testimoni", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...defaultForm });
    setDialogOpen(true);
  };

  const openEdit = (item: Testimonial) => {
    setEditing(item);
    setForm({
      fullName: item.fullName || "",
      profileUrl: item.profileUrl || "",
      message: item.message || "",
      rating: Number(item.rating || 5),
      sortOrder: Number(item.sortOrder || 0),
    });
    setDialogOpen(true);
  };

  const submit = () => {
    if (!form.fullName.trim() || !form.profileUrl.trim() || !form.message.trim()) {
      toast({ title: "Form belum lengkap", description: "Nama, profile URL, dan teks testimoni wajib diisi", variant: "destructive" });
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
          <h1 className="font-serif text-3xl font-bold tracking-wide">Testimonials</h1>
          <p className="text-muted-foreground">Kelola testimoni untuk landing page.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Testimoni
        </Button>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Daftar Testimoni</CardTitle>
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
            <div className="text-sm text-muted-foreground">Belum ada testimoni.</div>
          ) : (
            <>
              <div className="space-y-3">
                {items
                  .slice()
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id)
                  .map((t) => (
                    <div key={t.id} className="flex flex-col gap-3 rounded-xl border bg-background/60 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold">{t.fullName}</div>
                          <Stars rating={Number(t.rating || 5)} />
                          <span className="text-xs text-muted-foreground">sort: {t.sortOrder ?? 0}</span>
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">{t.profileUrl}</div>
                        <div className="mt-3 text-sm text-muted-foreground">{t.message}</div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-2"
                          onClick={() => setDeleteId(t.id)}
                        >
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Testimoni" : "Tambah Testimoni"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Nama</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profileUrl">Profile URL (avatar image)</Label>
              <Input
                id="profileUrl"
                value={form.profileUrl}
                onChange={(e) => setForm((p) => ({ ...p, profileUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message">Teks</Label>
              <Textarea
                id="message"
                value={form.message}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Rating</Label>
                <Select value={String(form.rating)} onValueChange={(v) => setForm((p) => ({ ...p, rating: Number(v) }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="1">1</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
                />
              </div>
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
            <DialogTitle>Hapus Testimoni?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Tindakan ini tidak bisa dibatalkan.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleteMutation.isPending}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Hapus
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
