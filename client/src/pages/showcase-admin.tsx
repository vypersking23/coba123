import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { Showcase } from "@shared/schema";

const ICON_OPTIONS: { value: string; label: string }[] = [
  { value: "Zap", label: "Zap" },
  { value: "Shield", label: "Shield" },
  { value: "Star", label: "Star" },
  { value: "Sparkles", label: "Sparkles" },
  { value: "Key", label: "Key" },
  { value: "Crown", label: "Crown" },
  { value: "Gamepad2", label: "Gamepad" },
  { value: "CheckCircle2", label: "Check" },
];

const defaultForm = {
  scriptName: "",
  gameName: "",
  type: "free" as "free" | "premium",
  youtubeUrl: "",
  feature1Icon: "Zap",
  feature1Text: "",
  feature2Icon: "Shield",
  feature2Text: "",
  feature3Icon: "Star",
  feature3Text: "",
  sortOrder: 0,
  buttonLabel: "",
  buttonUrl: "",
};

export default function ShowcaseAdmin() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Showcase | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading } = useQuery<{ items: Showcase[]; total: number }>({
    queryKey: ["/api/showcase", page],
    queryFn: async () => {
      const offset = (page - 1) * pageSize;
      const res = await fetch(`/api/showcase?limit=${pageSize}&offset=${offset}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const createMutation = useMutation({
    mutationFn: (data: typeof defaultForm) =>
      apiRequest("POST", "/api/showcase", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/showcase"] });
      toast({ title: "Showcase added" });
      setDialogOpen(false);
      setForm(defaultForm);
      setPage(1);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof defaultForm> }) =>
      apiRequest("PATCH", `/api/showcase/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/showcase"] });
      toast({ title: "Showcase updated" });
      setDialogOpen(false);
      setEditing(null);
      setForm(defaultForm);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/showcase/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/showcase"] });
      toast({ title: "Showcase deleted" });
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

  const openEdit = (item: Showcase) => {
    setEditing(item);
    setForm({
      scriptName: item.scriptName,
      gameName: item.gameName,
      type: item.type as "free" | "premium",
      youtubeUrl: item.youtubeUrl ?? "",
      feature1Icon: item.feature1Icon ?? "Zap",
      feature1Text: item.feature1Text,
      feature2Icon: item.feature2Icon ?? "Shield",
      feature2Text: item.feature2Text,
      feature3Icon: item.feature3Icon ?? "Star",
      feature3Text: item.feature3Text,
      sortOrder: item.sortOrder ?? 0,
      buttonLabel: item.buttonLabel ?? "",
      buttonUrl: item.buttonUrl ?? "",
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
          <h1 className="font-serif text-3xl font-bold tracking-wide">Showcase</h1>
          <p className="text-muted-foreground">Manage scripts shown on the landing page</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Showcase
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>{total} showcase item(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No showcase items yet. Add one to show on the landing page.</p>
          ) : (
            <>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      {item.youtubeUrl && (
                        <div className="h-12 w-20 overflow-hidden rounded bg-muted">
                          <img
                            src={`https://img.youtube.com/vi/${getYoutubeId(item.youtubeUrl)}/mqdefault.jpg`}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{item.scriptName}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.gameName} · {item.type}
                          {" · "}
                          👍 {item.likeCount ?? 0} · 👁 {item.viewCount ?? 0} · 🎁 {item.tipCount ?? 0}
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
            <DialogTitle>{editing ? "Edit Showcase" : "Add Showcase"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label>Script name</Label>
                <Input
                  value={form.scriptName}
                  onChange={(e) => setForm({ ...form, scriptName: e.target.value })}
                  placeholder="My Script"
                  required
                />
              </div>
              <div>
                <Label>Game name</Label>
                <Input
                  value={form.gameName}
                  onChange={(e) => setForm({ ...form, gameName: e.target.value })}
                  placeholder="Blox Fruits"
                  required
                />
              </div>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v: "free" | "premium") => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>YouTube URL</Label>
              <Input
                value={form.youtubeUrl}
                onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
            {([1, 2, 3] as const).map((i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>Feature {i} icon</Label>
                  <Select
                    value={form[`feature${i}Icon` as keyof typeof form] as string}
                    onValueChange={(v) => setForm({ ...form, [`feature${i}Icon`]: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Feature {i} text</Label>
                  <Input
                    value={form[`feature${i}Text` as keyof typeof form] as string}
                    onChange={(e) => setForm({ ...form, [`feature${i}Text`]: e.target.value })}
                    placeholder="Short highlight"
                    required
                  />
                </div>
              </div>
            ))}
            <div>
              <Label>Sort order (lower = first)</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label>Nama tombol (opsional)</Label>
                <Input
                  value={form.buttonLabel}
                  onChange={(e) => setForm({ ...form, buttonLabel: e.target.value })}
                  placeholder="Contoh: Dapatkan Script"
                />
              </div>
              <div>
                <Label>Link tombol (opsional)</Label>
                <Input
                  value={form.buttonUrl}
                  onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete showcase?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the item from the landing page.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteId != null && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function getYoutubeId(url: string): string {
  if (!url) return "";
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : "";
}
