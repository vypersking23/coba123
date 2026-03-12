type CashifyGenerateQrisV1Response = {
  status: number;
  data?: {
    qr_string: string;
    transactionId: string;
    originalAmount: number;
    totalAmount: number;
    uniqueNominal?: number;
    useUniqueCode?: boolean;
    packageIds?: string[];
  };
  message?: string;
};

type CashifyCheckStatusResponse = {
  status: number;
  data?: {
    transactionId: string;
    amount: number;
    status: string;
    expiredAt?: string | null;
  };
  message?: string;
};

function getBaseUrl() {
  return process.env.CASHIFY_BASE_URL?.trim() || "https://cashify.my.id/api/generate";
}

function getLicenseKey() {
  const key = process.env.CASHIFY_LICENSE;
  if (!key?.trim()) throw new Error("CASHIFY_LICENSE is not set");
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

export async function cashifyGenerateQrisV1(params: {
  qrisId: string;
  amount: number;
  useUniqueCode: boolean;
  packageIds: string[];
  expiredInMinutes: number;
}): Promise<NonNullable<CashifyGenerateQrisV1Response["data"]>> {
  const baseUrl = getBaseUrl();
  const license = getLicenseKey();

  const res = await fetch(`${baseUrl}/qris`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-license-key": license },
    body: JSON.stringify({
      id: params.qrisId,
      amount: params.amount,
      useUniqueCode: params.useUniqueCode,
      packageIds: params.packageIds,
      expiredInMinutes: params.expiredInMinutes,
    }),
  });

  const json = (await parseJsonSafe(res)) as CashifyGenerateQrisV1Response;
  if (!res.ok || json.status !== 200 || !json.data?.transactionId || !json.data?.qr_string) {
    throw new Error(json.message || `Cashify generate qris failed (${res.status})`);
  }
  return json.data;
}

export async function cashifyCheckStatus(transactionId: string): Promise<NonNullable<CashifyCheckStatusResponse["data"]>> {
  const baseUrl = getBaseUrl();
  const license = getLicenseKey();

  const res = await fetch(`${baseUrl}/check-status`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-license-key": license },
    body: JSON.stringify({ transactionId }),
  });

  const json = (await parseJsonSafe(res)) as CashifyCheckStatusResponse;
  if (!res.ok || json.status !== 200 || !json.data?.transactionId) {
    throw new Error(json.message || `Cashify check status failed (${res.status})`);
  }
  return json.data;
}

