export type LocalUser = {
  id: string;
  email: string;
  user_metadata: Record<string, string>;
};

export type LocalSession = {
  access_token: string;
  token_type: string;
  user: LocalUser;
};

type ApiError = { message: string; code?: string };
type ApiResult<T> = { data: T; error: ApiError | null };
type Filter = { field: string; value: string };

type QueryState = {
  table: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  payload?: Record<string, unknown>;
  filters: Filter[];
  select: string;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  one: boolean;
  maybeOne: boolean;
};

const apiBase = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const sessionKey = "controlavenda_local_session";
const authEvents = new Set<(event: string, session: LocalSession | null) => void>();

const readStoredSession = (): LocalSession | null => {
  try {
    return JSON.parse(localStorage.getItem(sessionKey) || "null") as LocalSession | null;
  } catch {
    return null;
  }
};
const storeSession = (session: LocalSession | null) => {
  if (session) localStorage.setItem(sessionKey, JSON.stringify(session));
  else localStorage.removeItem(sessionKey);
};
const notifyAuth = (event: string, session: LocalSession | null) => authEvents.forEach((listener) => listener(event, session));

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const session = readStoredSession();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  try {
    const response = await fetch(`${apiBase}${path}`, { ...init, headers });
    const body = await response.json() as ApiResult<T>;
    if (!response.ok) return { data: body.data ?? null as T, error: body.error || { message: "Não foi possível concluir a operação." } };
    return body;
  } catch {
    return { data: null as T, error: { message: "A API local não está disponível. Verifique se o servidor foi iniciado." } };
  }
}

class LocalQuery<T = Record<string, unknown>> implements PromiseLike<ApiResult<T | T[] | null>> {
  private state: QueryState;

  constructor(table: string, state?: Partial<QueryState>) {
    this.state = { table, method: "GET", filters: [], select: "*", one: false, maybeOne: false, ...state };
  }

  select(fields = "*") {
    this.state.select = fields;
    return this;
  }

  eq(field: string, value: string | number | boolean | null) {
    this.state.filters.push({ field, value: String(value ?? "") });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.state.orderBy = field;
    this.state.ascending = options?.ascending ?? true;
    return this;
  }

  limit(value: number) {
    this.state.limit = value;
    return this;
  }

  single() {
    this.state.one = true;
    return this;
  }

  maybeSingle() {
    this.state.maybeOne = true;
    return this;
  }

  then<TResult1 = ApiResult<T | T[] | null>, TResult2 = never>(
    onfulfilled?: ((value: ApiResult<T | T[] | null>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<ApiResult<T | T[] | null>> {
    const { table, method, payload, filters, select, orderBy, ascending, limit, one, maybeOne } = this.state;
    const params = new URLSearchParams();
    if (method === "GET") {
      params.set("select", select);
      params.set("filters", JSON.stringify(filters));
      if (orderBy) { params.set("order_by", orderBy); params.set("ascending", String(ascending)); }
      if (limit) params.set("limit", String(limit));
    }
    const queryString = method === "GET" ? `?${params.toString()}` : `?id=${encodeURIComponent(String(filters.find((filter) => filter.field === "id")?.value || ""))}`;
    const path = `/db/${table}${queryString}`;
    const result = await request<T | T[] | null>(path, { method, body: method === "GET" ? undefined : JSON.stringify(payload || {}) });
    if (result.error) return result;
    if (!one && !maybeOne) return result;
    const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
    if (one && rows.length !== 1) return { data: null, error: { message: rows.length ? "Mais de um registro encontrado." : "Registro não encontrado.", code: "PGRST116" } };
    return { data: (rows[0] || null) as T | null, error: null };
  }
}

const tableClient = (table: string): any => ({
  select: (fields = "*") => new LocalQuery<any>(table).select(fields),
  insert: (payload: Record<string, unknown>) => new LocalQuery<any>(table, { method: "POST", payload }),
  update: (payload: Record<string, unknown>) => new LocalQuery<any>(table, { method: "PATCH", payload }),
  delete: () => new LocalQuery<any>(table, { method: "DELETE" }),
});

export const localApi = {
  from: tableClient,
  rpc: async (name: string, args: Record<string, unknown>) => request<any>(`/rpc/${name}`, { method: "POST", body: JSON.stringify(args) }),
  auth: {
    getSession: async () => {
      const stored = readStoredSession();
      if (!stored) return { data: { session: null as LocalSession | null }, error: null };
      const result = await request<{ session: LocalSession | null }>("/auth/session");
      if (result.error || !result.data.session) {
        storeSession(null);
        return { data: { session: null as LocalSession | null }, error: result.error };
      }
      storeSession(result.data.session);
      return { data: { session: result.data.session }, error: null };
    },
    onAuthStateChange: (listener: (event: string, session: LocalSession | null) => void) => {
      authEvents.add(listener);
      return { data: { subscription: { unsubscribe: () => { authEvents.delete(listener); } } } };
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const result = await request<{ session: LocalSession }>("/auth/signin", { method: "POST", body: JSON.stringify({ email, password }) });
      if (result.data?.session) { storeSession(result.data.session); notifyAuth("SIGNED_IN", result.data.session); }
      return result;
    },
    signUp: async ({ email, password, options }: { email: string; password: string; options?: { data?: { full_name?: string } } }) => {
      const result = await request<{ session: LocalSession }>("/auth/signup", { method: "POST", body: JSON.stringify({ email, password, full_name: options?.data?.full_name || "" }) });
      if (result.data?.session) { storeSession(result.data.session); notifyAuth("SIGNED_IN", result.data.session); }
      return result;
    },
    signOut: async () => {
      const result = await request<null>("/auth/signout", { method: "POST" });
      storeSession(null);
      notifyAuth("SIGNED_OUT", null);
      return result;
    },
    getUser: async () => {
      const session = readStoredSession();
      return { data: { user: session?.user || null }, error: null };
    },
  },
};
