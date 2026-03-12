type TemanQrisPaymentLink = {
  id: number;
  link_code: string;
  order_id: string;
  url: string;
  amount: number;
  description?: string;
  webhook_url?: string | null;
  callback_url?: string | null;
  expires_at?: string | null;
};

type CreatePaymentLinkResponse = {
  success: boolean;
  payment_link?: TemanQrisPaymentLink;
  message?: string;
  error?: string;
};

type VerifyOrderResponse = {
  success: boolean;
  message?: string;
  order?: {
    order_id: string;
    amount: number;
    status: string;
    paid_at?: string | null;
    confirmed_by?: string | null;
  };
  error?: string;
};

type GetOrderResponse = {
  success?: boolean;
  order?: {
    order_id: string;
    description?: string | null;
    title?: string | null;
    status: string;
    is_paid?: boolean;
    is_expired?: boolean;
  };
  error?: string;
  message?: string;
};

type ConfirmPaymentResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  order_id?: string;
  status?: string;
};

function getQrisBaseUrl() {
  return process.env.TEMANQRIS_BASE_URL || "https://temanqris.com/api/qris";
}

function getPayBaseUrl() {
  return process.env.TEMANQRIS_PAY_BASE_URL || "https://temanqris.com/api/pay";
}

function getApiKey() {
  const key = process.env.TEMANQRIS_API_KEY;
  if (!key) throw new Error("TEMANQRIS_API_KEY is not set");
  return key.trim();
}

async function parseJsonSafe(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function temanqrisCreatePaymentLink(params: {
  amount: number;
  description?: string;
  orderId?: string;
  webhookUrl?: string;
  callbackUrl?: string;
}): Promise<{ paymentLink: TemanQrisPaymentLink; fullUrl: string }> {
  const baseUrl = getQrisBaseUrl();
  const apiKey = getApiKey();

  const res = await fetch(`${baseUrl}/payment-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({
      amount: params.amount,
      ...(params.description ? { description: params.description } : {}),
      ...(params.orderId ? { order_id: params.orderId } : {}),
      ...(params.webhookUrl ? { webhook_url: params.webhookUrl } : {}),
      ...(params.callbackUrl ? { callback_url: params.callbackUrl } : {}),
    }),
  });

  const json = (await parseJsonSafe(res)) as CreatePaymentLinkResponse;
  if (!res.ok || !json.success || !json.payment_link) {
    throw new Error(json.message || json.error || `TemanQRIS create payment link failed (${res.status})`);
  }

  const url = json.payment_link.url.startsWith("http")
    ? json.payment_link.url
    : `https://temanqris.com${json.payment_link.url}`;

  return { paymentLink: json.payment_link, fullUrl: url };
}

export async function temanqrisConfirmPayment(linkCode: string): Promise<ConfirmPaymentResponse> {
  const baseUrl = getPayBaseUrl();
  const res = await fetch(`${baseUrl}/${encodeURIComponent(linkCode)}/confirm`, { method: "POST" });
  return (await parseJsonSafe(res)) as ConfirmPaymentResponse;
}

export async function temanqrisVerifyOrder(params: {
  paymentOrderId: string;
  payerName?: string;
  payerNote?: string;
}): Promise<VerifyOrderResponse> {
  const baseUrl = getQrisBaseUrl();
  const apiKey = getApiKey();
  const res = await fetch(`${baseUrl}/orders/${encodeURIComponent(params.paymentOrderId)}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({
      ...(params.payerName ? { payer_name: params.payerName } : {}),
      ...(params.payerNote ? { payer_note: params.payerNote } : {}),
    }),
  });
  return (await parseJsonSafe(res)) as VerifyOrderResponse;
}

export async function temanqrisGetOrder(orderId: string): Promise<GetOrderResponse> {
  const baseUrl = getQrisBaseUrl();
  const apiKey = getApiKey();
  const res = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, {
    headers: { "X-API-Key": apiKey },
  });
  return (await parseJsonSafe(res)) as GetOrderResponse;
}

export async function temanqrisGetMyQris(): Promise<any> {
  const baseUrl = getQrisBaseUrl();
  const apiKey = getApiKey();
  const res = await fetch(`${baseUrl}/my-qris`, {
    headers: { "X-API-Key": apiKey },
  });
  return await parseJsonSafe(res);
}

export async function temanqrisGetUsage(): Promise<any> {
  const baseUrl = getQrisBaseUrl();
  const apiKey = getApiKey();
  const res = await fetch(`${baseUrl}/usage`, {
    headers: { "X-API-Key": apiKey },
  });
  return await parseJsonSafe(res);
}
