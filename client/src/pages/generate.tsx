import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Loader2, Copy, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Key, Package } from "@shared/schema";

const generateSchema = z.object({
  durationMonths: z.number().min(1).max(12),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
  quantity: z.number().min(1).max(100),
  packageId: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

type GenerateFormData = z.infer<typeof generateSchema>;

const durationOptions = [
  { value: 1, label: "1 Month" },
  { value: 2, label: "2 Months" },
  { value: 3, label: "3 Months" },
  { value: 6, label: "6 Months" },
  { value: 12, label: "12 Months" },
];

export default function Generate() {
  const [generatedKeys, setGeneratedKeys] = useState<Key[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: packages = [] } = useQuery<Package[]>({
    queryKey: ["/api/packages"],
    queryFn: async () => {
      const res = await fetch("/api/packages");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const form = useForm<GenerateFormData>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      durationMonths: 1,
      price: "9.99",
      quantity: 1,
      packageId: undefined,
      notes: "",
    },
  });

  const generateMutation = useMutation({
    mutationFn: (data: GenerateFormData) => apiRequest("POST", "/api/keys/generate", data),
    onSuccess: (data) => {
      setGeneratedKeys(data.keys);
      queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Keys generated successfully",
        description: `Generated ${data.keys.length} key(s)`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate keys",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: GenerateFormData) => {
    generateMutation.mutate(data);
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const copyAllKeys = () => {
    const allKeys = generatedKeys.map((k) => k.keyCode).join("\n");
    navigator.clipboard.writeText(allKeys);
    toast({ title: "All keys copied to clipboard" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-wide" data-testid="text-page-title">
          Generate Keys
        </h1>
        <p className="text-muted-foreground">
          Create new license keys for your customers
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Key Generator
            </CardTitle>
            <CardDescription>
              Configure and generate new license keys
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="durationMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration</FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={field.value.toString()}
                          onValueChange={(val) => field.onChange(parseInt(val))}
                          className="grid grid-cols-3 gap-2 sm:grid-cols-5"
                        >
                          {durationOptions.map((option) => (
                            <div key={option.value}>
                              <RadioGroupItem
                                value={option.value.toString()}
                                id={`duration-${option.value}`}
                                className="peer sr-only"
                              />
                              <Label
                                htmlFor={`duration-${option.value}`}
                                className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover-elevate peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10"
                                data-testid={`radio-duration-${option.value}`}
                              >
                                <span className="font-medium">{option.label}</span>
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              placeholder="9.99"
                              data-testid="input-price"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormDescription>Price per key for revenue tracking</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            data-testid="input-quantity"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormDescription>Number of keys to generate (max 100)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="packageId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Package (Stock)</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ? String(field.value) : "none"}
                          onValueChange={(val) => field.onChange(val === "none" ? undefined : parseInt(val))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih package (opsional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Generic stock (no package)</SelectItem>
                            {packages.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription>
                        Kalau diisi, key akan jadi stok khusus package itu (lebih aman untuk assign).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Customer name, order ID, etc."
                          className="resize-none"
                          data-testid="input-notes"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Add any notes about this key batch
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={generateMutation.isPending}
                  data-testid="button-generate"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate {form.watch("quantity")} Key{form.watch("quantity") > 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Generated Keys</CardTitle>
                <CardDescription>
                  {generatedKeys.length
                    ? `${generatedKeys.length} key(s) ready to use`
                    : "Your generated keys will appear here"}
                </CardDescription>
              </div>
              {generatedKeys.length > 1 && (
                <Button variant="outline" onClick={copyAllKeys} data-testid="button-copy-all">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {generatedKeys.length ? (
              <div className="space-y-3">
                {generatedKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between gap-3 rounded-md border bg-muted/50 p-4"
                    data-testid={`generated-key-${key.id}`}
                  >
                    <code className="font-mono text-lg font-semibold tracking-widest">
                      {key.keyCode}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(key.keyCode)}
                      data-testid={`button-copy-${key.id}`}
                    >
                      {copiedKey === key.keyCode ? (
                        <Check className="h-4 w-4 text-chart-2" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-48 flex-col items-center justify-center text-center text-muted-foreground">
                <Sparkles className="mb-4 h-12 w-12 opacity-50" />
                <p className="text-lg font-medium">No keys generated yet</p>
                <p className="text-sm">
                  Fill out the form and click generate to create new keys
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
