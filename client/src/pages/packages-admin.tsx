import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Package } from "@shared/schema";

const defaultForm = {
  title: "",
  durationDays: 30,
  price: "",
  originalPrice: "",
  feature1: "",
  feature2: "",
  feature3: "",
  feature4: "",
  buyLink: "",
  imageUrl: "",
  isPopular: 0 as 0 | 1,
  sortOrder: 0,
};

function formatIdr(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(String(value).replace(/,/g, "")) || 0 : Number(value);
  return new Intl.NumberFormat("id-ID").format(n);
}

export default function PackagesAdmin() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading } = useQuery<{ items: Package[]; total: number }>({
    queryKey: ["/api/packages", page],
    queryFn: async () => {
      const offset = (page - 1) * pageSize;
      const res = await fetch(`/api/packages?limit=${pageSize}&offset=${offset}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const createMutation = useMutation({
    mutationFn: (data: typeof defaultForm) =>
      apiRequest("POST", "/api/packages", {
        ...data,
        price: String(parseFloat(String(data.price).replace(/,/g, "")) || 0),
        originalPrice: data.originalPrice.trim()
          ? String(parseFloat(String(data.originalPrice).replace(/,/g, "")) || 0)
          : null,
        buyLink: data.buyLink.trim() ? data.buyLink.trim() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      toast({ title: "Paket ditambah" });
      setDialogOpen(false);
      setForm(defaultForm);
      setPage(1);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof defaultForm> }) =>
      apiRequest("PATCH", `/api/packages/${id}`, {
        ...data,
        ...(data.price !== undefined && { price: String(parseFloat(String(data.price).replace(/,/g, "")) || 0) }),
        ...(data.originalPrice !== undefined && {
          originalPrice: String(data.originalPrice || "").trim()
            ? String(parseFloat(String(data.originalPrice).replace(/,/g, "")) || 0)
            : null,
        }),
        ...(data.buyLink !== undefined && { buyLink: data.buyLink.trim() ? data.buyLink.trim() : null }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      toast({ title: "Paket diupdate" });
      setDialogOpen(false);
      setEditing(null);
      setForm(defaultForm);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/packages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      toast({ title: "Paket dihapus" });
      setDeleteId(null);
      setPage(1);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openAdd = () => {
    setEditing(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (item: Package) => {
    setEditing(item);
    setForm({
      title: item.title,
      durationDays: item.durationDays,
      price: String(item.price ?? ""),
      originalPrice: String(item.originalPrice ?? ""),
      feature1: item.feature1 ?? "",
      feature2: item.feature2 ?? "",
      feature3: item.feature3 ?? "",
      feature4: item.feature4 ?? "",
      buyLink: item.buyLink ?? "",
      imageUrl: item.imageUrl ?? "",
      isPopular: item.isPopular === 1 ? 1 : 0,
      sortOrder: item.sortOrder ?? 0,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
          <h1 className="font-serif text-3xl font-bold tracking-wide">Packages</h1>
          <p className="text-muted-foreground">Kelola paket key untuk halaman Beli Sekarang</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Paket
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Paket</CardTitle>
          <CardDescription>{total} paket</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Belum ada paket. Tambah paket untuk tampil di halaman Beli Sekarang.</p>
          ) : (
            <>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      {item.imageUrl && (
                        <div className="h-12 w-16 overflow-hidden rounded bg-muted">
                          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {(() => {
                            const price = parseFloat(String(item.price ?? "0")) || 0;
                            const original = parseFloat(String(item.originalPrice ?? "")) || 0;
                            const hasDiscount = original > 0 && original > price;
                            if (!hasDiscount) {
                              return (
                                <>
                                  {item.durationDays} hari · IDR {formatIdr(item.price ?? 0)}
                                </>
                              );
                            }
                            return (
                              <>
                                {item.durationDays} hari ·{" "}
                                <span className="line-through">IDR {formatIdr(original)}</span>{" "}
                                <span className="font-semibold text-foreground">IDR {formatIdr(price)}</span>
                              </>
                            );
                          })()}
                          {item.isPopular ? " · ⭐ Most Popular" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
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
            <DialogTitle>{editing ? "Edit Paket" : "Tambah Paket"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nama paket</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Premium King Vypers"
                required
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <Label>Durasi (hari)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.durationDays}
                  onChange={(e) => setForm({ ...form, durationDays: parseInt(e.target.value, 10) || 30 })}
                  placeholder="30"
                />
              </div>
              <div>
                <Label>Harga (IDR, angka saja)</Label>
                <Input
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value.replace(/\D/g, "") })}
                  placeholder="30000"
                />
              </div>
              <div>
                <Label>Harga awal (dicoret, opsional)</Label>
                <Input
                  value={form.originalPrice}
                  onChange={(e) => setForm({ ...form, originalPrice: e.target.value.replace(/\D/g, "") })}
                  placeholder="50000"
                />
              </div>
            </div>
            <div>
              <Label>Link Beli (fallback, opsional)</Label>
              <Input
                value={form.buyLink}
                onChange={(e) => setForm({ ...form, buyLink: e.target.value })}
                placeholder="Kosongkan jika pakai Payment Gateway (auto generate link)"
              />
            </div>
            <div>
              <Label>URL Gambar (opsional)</Label>
              <Input
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://..."
              />
              {form.imageUrl && (
                <div className="mt-2 h-20 w-32 overflow-hidden rounded border bg-muted">
                  <img src={form.imageUrl} alt="Preview" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              )}
            </div>
            {([1, 2, 3, 4] as const).map((i) => (
              <div key={i}>
                <Label>Fitur {i} (opsional)</Label>
                <Input
                  value={form[`feature${i}` as keyof typeof form] as string}
                  onChange={(e) => setForm({ ...form, [`feature${i}`]: e.target.value })}
                  placeholder={i === 1 ? "Support ALL DEVICE" : ""}
                />
              </div>
            ))}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isPopular"
                checked={form.isPopular === 1}
                onCheckedChange={(checked) => setForm({ ...form, isPopular: checked ? 1 : 0 })}
              />
              <Label htmlFor="isPopular">Tandai sebagai Most Popular</Label>
            </div>
            <div>
              <Label>Sort order (lebih kecil = di atas)</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Update" : "Tambah"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus paket?</AlertDialogTitle>
            <AlertDialogDescription>Paket ini akan hilang dari halaman Beli Sekarang.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteId != null && deleteMutation.mutate(deleteId)}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
