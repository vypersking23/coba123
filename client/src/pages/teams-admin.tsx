import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import type { Team } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type TeamForm = {
  fullName: string;
  role: string;
  photoUrl: string;
  accent: string;
  description: string;
  instagram: string;
  linkedin: string;
  github: string;
  twitter: string;
  skill1: string;
  skill2: string;
  skill3: string;
  skill4: string;
  sortOrder: number;
};

const defaultForm: TeamForm = {
  fullName: "",
  role: "",
  photoUrl: "",
  accent: "primary",
  description: "",
  instagram: "",
  linkedin: "",
  github: "",
  twitter: "",
  skill1: "",
  skill2: "",
  skill3: "",
  skill4: "",
  sortOrder: 0,
};

const ACCENT_LABEL: Record<string, string> = {
  primary: "Primary",
  gold: "Gold",
  emerald: "Emerald",
  sky: "Sky",
  violet: "Violet",
  rose: "Rose",
};

const ACCENT_DOT: Record<string, string> = {
  primary: "bg-primary",
  gold: "bg-amber-500",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
};

function normalizeUrl(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith("//")) return `https:${v}`;
  return `https://${v}`;
}

function buildPayload(form: TeamForm) {
  const trimOrEmpty = (v: string) => v.trim();
  const emptyToUndefined = (v: string) => {
    const t = v.trim();
    return t === "" ? undefined : t;
  };

  return {
    fullName: trimOrEmpty(form.fullName),
    role: trimOrEmpty(form.role),
    photoUrl: trimOrEmpty(form.photoUrl),
    accent: form.accent,
    description: emptyToUndefined(form.description),
    instagram: form.instagram.trim() ? normalizeUrl(form.instagram) : undefined,
    linkedin: form.linkedin.trim() ? normalizeUrl(form.linkedin) : undefined,
    github: form.github.trim() ? normalizeUrl(form.github) : undefined,
    twitter: form.twitter.trim() ? normalizeUrl(form.twitter) : undefined,
    skill1: emptyToUndefined(form.skill1),
    skill2: emptyToUndefined(form.skill2),
    skill3: emptyToUndefined(form.skill3),
    skill4: emptyToUndefined(form.skill4),
    sortOrder: Number.isFinite(form.sortOrder) ? form.sortOrder : 0,
  };
}

export default function TeamsAdmin() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 9;
  const { data, isLoading, error } = useQuery<{ items: Team[]; total: number }>({
    queryKey: ["/api/teams", page],
    queryFn: async () => {
      const offset = (page - 1) * pageSize;
      const res = await fetch(`/api/teams?limit=${pageSize}&offset=${offset}`);
      if (!res.ok) {
        const text = await res.text();
        let message = "Gagal mengambil data teams";
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
  const [editing, setEditing] = useState<Team | null>(null);
  const [form, setForm] = useState<TeamForm>({ ...defaultForm });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: TeamForm) => apiRequest("POST", "/api/teams", buildPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setDialogOpen(false);
      setForm({ ...defaultForm });
      toast({ title: "Anggota ditambahkan" });
      setPage(1);
    },
    onError: (e: Error) => {
      const msg = e.message.includes("relation") && e.message.includes("teams") ? "Tabel teams belum ada. Jalankan db:push dulu." : e.message;
      toast({ title: "Gagal menambah anggota", description: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TeamForm }) =>
      apiRequest("PATCH", `/api/teams/${id}`, buildPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setDialogOpen(false);
      setEditing(null);
      setForm({ ...defaultForm });
      toast({ title: "Anggota diupdate" });
    },
    onError: (e: Error) => toast({ title: "Gagal update anggota", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/teams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setDeleteId(null);
      toast({ title: "Anggota dihapus" });
      setPage(1);
    },
    onError: (e: Error) => toast({ title: "Gagal hapus anggota", description: e.message, variant: "destructive" }),
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ ...defaultForm });
    setDialogOpen(true);
  };

  const openEdit = (item: Team) => {
    setEditing(item);
    setForm({
      fullName: item.fullName,
      role: item.role,
      photoUrl: item.photoUrl,
      accent: item.accent ?? "primary",
      description: item.description ?? "",
      instagram: item.instagram ?? "",
      linkedin: item.linkedin ?? "",
      github: item.github ?? "",
      twitter: item.twitter ?? "",
      skill1: item.skill1 ?? "",
      skill2: item.skill2 ?? "",
      skill3: item.skill3 ?? "",
      skill4: item.skill4 ?? "",
      sortOrder: item.sortOrder ?? 0,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = form.fullName.trim();
    const role = form.role.trim();
    const photoUrl = form.photoUrl.trim();
    if (!fullName || !role || !photoUrl) {
      toast({ title: "Lengkapi data wajib", description: "Nama, Role, dan Foto URL wajib diisi.", variant: "destructive" });
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-wide">Teams</h1>
          <p className="text-muted-foreground">Kelola anggota tim untuk ditampilkan di landing page</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Anggota
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Anggota</CardTitle>
          <CardDescription>{total} orang</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">{(error as Error).message}</p>
              <Button className="mt-4" variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/teams"] })}>
                Refresh
              </Button>
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Belum ada anggota. Tambahkan untuk tampil di landing.</p>
          ) : (
            <>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <li key={item.id} className="rounded-xl border p-4 glass flex gap-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                      {item.photoUrl ? (
                        <img src={item.photoUrl} alt={item.fullName} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{item.fullName}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${ACCENT_DOT[item.accent] ?? "bg-muted-foreground"}`} />
                        <span className="truncate">{item.role}</span>
                        <span className="text-xs text-muted-foreground/70">· {ACCENT_LABEL[item.accent] ?? item.accent}</span>
                      </p>
                      {item.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground/90">{item.description}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {[item.skill1, item.skill2, item.skill3, item.skill4]
                          .filter(Boolean)
                          .map((s, i) => (
                            <span key={i} className="text-xs rounded-full bg-muted px-2 py-0.5">{s}</span>
                          ))}
                      </div>
                    </div>
                    <div className="flex gap-2 self-start">
                      <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteId(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Anggota" : "Tambah Anggota"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Warna Card / Jabatan</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { v: "primary", label: "Primary", bar: "from-primary to-secondary" },
                  { v: "gold", label: "Gold", bar: "from-amber-400 to-orange-600" },
                  { v: "emerald", label: "Emerald", bar: "from-emerald-400 to-teal-500" },
                  { v: "sky", label: "Sky", bar: "from-sky-400 to-indigo-500" },
                  { v: "violet", label: "Violet", bar: "from-violet-500 to-fuchsia-500" },
                  { v: "rose", label: "Rose", bar: "from-rose-500 to-pink-500" },
                ].map((c) => (
                  <button
                    key={c.v}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, accent: c.v }))}
                    className={`relative overflow-hidden rounded-lg border p-3 text-left transition ${
                      form.accent === c.v ? "ring-2 ring-primary" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${c.bar}`} />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{c.label}</span>
                      {form.accent === c.v ? (
                        <span className="text-xs text-primary">Selected</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pick</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
              <div className="sm:row-span-3">
                <Label>Foto URL</Label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    inputMode="url"
                    value={form.photoUrl}
                    onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (text) {
                        e.preventDefault();
                        setForm((prev) => ({ ...prev, photoUrl: text }));
                      }
                    }}
                    placeholder="https://..."
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (!text) {
                          toast({ title: "Clipboard kosong", variant: "destructive" });
                          return;
                        }
                        setForm((prev) => ({ ...prev, photoUrl: text }));
                      } catch (e) {
                        toast({ title: "Gagal paste", description: e instanceof Error ? e.message : "Clipboard tidak bisa diakses", variant: "destructive" });
                      }
                    }}
                  >
                    Paste
                  </Button>
                </div>
                {form.photoUrl && (
                  <div className="mt-2 h-28 w-28 overflow-hidden rounded-full border bg-muted">
                    <img src={form.photoUrl} alt="Preview" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>
              <div>
                <Label>Nama Lengkap</Label>
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Yeremia Ginting"
                  required
                />
              </div>
              <div>
                <Label>Jabatan / Role</Label>
                <Input
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="Founder, Backend Developer"
                  required
                />
              </div>
            </div>

            <div>
              <Label>Deskripsi (opsional)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="1–2 kalimat singkat"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Instagram (opsional)</Label>
                <Input
                  value={form.instagram}
                  onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                  placeholder="https://instagram.com/..."
                />
              </div>
              <div>
                <Label>LinkedIn (opsional)</Label>
                <Input
                  value={form.linkedin}
                  onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
              <div>
                <Label>GitHub (opsional)</Label>
                <Input
                  value={form.github}
                  onChange={(e) => setForm({ ...form, github: e.target.value })}
                  placeholder="https://github.com/..."
                />
              </div>
              <div>
                <Label>Twitter/X (opsional)</Label>
                <Input
                  value={form.twitter}
                  onChange={(e) => setForm({ ...form, twitter: e.target.value })}
                  placeholder="https://twitter.com/..."
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {([1, 2, 3, 4] as const).map((i) => (
                <div key={i}>
                  <Label>Skill {i} (opsional)</Label>
                  <Input
                    value={form[`skill${i}` as keyof typeof form] as string}
                    onChange={(e) => setForm({ ...form, [`skill${i}`]: e.target.value })}
                    placeholder={i === 1 ? "Laravel / UI/UX / Database / Marketing" : ""}
                  />
                </div>
              ))}
            </div>

            <div>
              <Label>Sort order (lebih kecil = di atas)</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 0 })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editing ? "Simpan Perubahan" : "Tambah"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {deleteId != null && (
        <Dialog open onOpenChange={() => setDeleteId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Hapus Anggota?</DialogTitle>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
              <Button
                className="text-destructive"
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
              >
                Hapus
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
