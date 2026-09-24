import express, { type NextFunction, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db, id, now, toBoolean, toSqlBoolean } from "./db.js";

type AuthUser = { id: string; email: string };
type AuthedRequest = Request & { user?: AuthUser; membership?: { company_id: string; role: "admin" | "employee" } };

type Filter = { field: string; value: string };

const app = express();
const port = Number(process.env.PORT || 3001);
const apiPrefix = "/api";
const allowedTables = new Set([
  "admin_products", "products", "customers", "sales", "financial_transactions", "quotes", "quote_items", "categories", "company_members", "profiles", "companies",
]);
const writableTables = new Set(["products", "customers", "financial_transactions", "quotes", "quote_items", "companies"]);
const adminOnlyTables = new Set(["products", "customers", "financial_transactions", "quotes", "quote_items", "companies"]);
const tableColumns: Record<string, string[]> = {
  products: ["company_id", "category_id", "name", "barcode", "sku", "description", "image_url", "cost_price", "sale_price", "stock", "minimum_stock", "supplier_name", "is_active", "updated_at"],
  customers: ["company_id", "name", "phone", "whatsapp", "email", "address", "address_number", "city", "state", "tax_id", "notes", "is_active", "updated_at"],
  financial_transactions: ["company_id", "sale_id", "type", "description", "amount", "category", "status", "created_by"],
  quotes: ["company_id", "customer_id", "status", "subtotal", "discount", "total", "notes", "created_by"],
  quote_items: ["quote_id", "product_id", "product_name", "quantity", "unit_price", "discount", "total"],
  companies: ["name", "phone", "whatsapp", "address", "address_number", "city", "state", "zip_code", "tax_id", "notes", "allow_negative_stock", "updated_at"],
};

app.use(express.json({ limit: "1mb" }));
app.use((_, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.FRONTEND_ORIGIN || "http://localhost:8080");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  next();
});
app.options(/.*/, (_, res) => res.status(204).end());

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const bearerToken = (req: Request) => req.header("authorization")?.replace(/^Bearer\s+/i, "") || "";
const userForToken = (token: string) => {
  if (!token) return null;
  const row = db.get<{ id: string; email: string; expires_at: string }>(
    "SELECT users.id, users.email, sessions.expires_at FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ?",
    [tokenHash(token)],
  );
  if (!row || new Date(row.expires_at) <= new Date()) return null;
  return { id: row.id, email: row.email };
};
const membershipFor = (userId: string, companyId: string) => db.get<{ company_id: string; role: "admin" | "employee" }>("SELECT company_id, role FROM company_members WHERE user_id = ? AND company_id = ?", [userId, companyId]);
const firstMembership = (userId: string) => db.get<{ company_id: string; role: "admin" | "employee" }>("SELECT company_id, role FROM company_members WHERE user_id = ? ORDER BY created_at LIMIT 1", [userId]);
const requireAuth: (req: Request, res: Response, next: NextFunction) => void = (req, res, next) => {
  const user = userForToken(bearerToken(req));
  if (!user) return res.status(401).json({ data: null, error: { message: "Sessão local expirada.", code: "401" } });
  (req as AuthedRequest).user = user;
  next();
};
const requireUser = (req: AuthedRequest) => {
  if (!req.user) throw new Error("Não autenticado");
  return req.user;
};
const sendError = (res: Response, error: unknown, status = 400) => {
  const message = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
  const code = message.includes("UNIQUE") ? "23505" : message.includes("não autenticado") ? "401" : "PGRST_ERROR";
  res.status(status).json({ data: null, error: { message, code } });
};
const responseData = (res: Response, data: unknown) => res.json({ data, error: null });
const validIdentifier = (value: string) => /^[a-z_][a-z0-9_]*$/i.test(value);
const numeric = (value: unknown) => Number(value || 0);
const cleanPayload = (table: string, body: Record<string, unknown>) => {
  const columns = tableColumns[table] || [];
  return Object.fromEntries(Object.entries(body).filter(([key]) => columns.includes(key)).map(([key, value]) => {
    if (["is_active", "allow_negative_stock"].includes(key)) return [key, toSqlBoolean(value)];
    return [key, value === "" ? null : value];
  }));
};
const normalizeRow = <T extends Record<string, any>>(row: T): T => {
  const output = { ...row };
  if ("is_active" in output) output.is_active = toBoolean(output.is_active);
  if ("allow_negative_stock" in output) output.allow_negative_stock = toBoolean(output.allow_negative_stock);
  if ("details" in output && typeof output.details === "string") {
    try { output.details = JSON.parse(output.details); } catch { output.details = {}; }
  }
  return output;
};
const selectedFields = (select: string) => select === "*" ? null : select.split(",").map((field) => field.trim().split("(")[0]).filter(validIdentifier);
const projectRow = (table: string, rawRow: Record<string, any>, select: string, userId: string, role: "admin" | "employee") => {
  const row = normalizeRow(rawRow);
  const fields = selectedFields(select);
  const output = fields ? Object.fromEntries(fields.filter((field) => field in row).map((field) => [field, row[field]])) : { ...row };
  if (table === "products" && role === "employee") delete output.cost_price;
  if (select.includes("customers(") && ["sales", "quotes"].includes(table)) {
    const customer = row.customer_id ? db.get("SELECT * FROM customers WHERE id = ?", [row.customer_id]) : null;
    output.customers = customer ? { name: customer.name } : null;
  }
  if (table === "company_members" && select.includes("companies(")) {
    const company = db.get("SELECT * FROM companies WHERE id = ?", [row.company_id]);
    output.companies = company ? normalizeRow(company) : null;
  }
  return output;
};
const companyIdFromQuery = (filters: Filter[]) => filters.find((filter) => filter.field === "company_id")?.value || "";
const companyIdForRecord = (table: string, recordId: string) => {
  if (table === "companies") return recordId;
  if (table === "quote_items") return db.get<{ company_id: string }>("SELECT company_id FROM quotes WHERE id = (SELECT quote_id FROM quote_items WHERE id = ?)", [recordId])?.company_id || "";
  return db.get<{ company_id: string }>(`SELECT company_id FROM ${table} WHERE id = ?`, [recordId])?.company_id || "";
};
const ensureCompanyAccess = (userId: string, companyId: string) => {
  if (!companyId || !membershipFor(userId, companyId)) throw new Error("Não autorizado para esta empresa");
  return membershipFor(userId, companyId)!;
};

async function issueSession(user: AuthUser) {
  const rawToken = randomBytes(32).toString("hex");
  db.run("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [tokenHash(rawToken), user.id, new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()]);
  await db.persist();
  return { access_token: rawToken, token_type: "bearer", user: { id: user.id, email: user.email, user_metadata: {} } };
}

app.post(`${apiPrefix}/auth/signup`, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const fullName = String(req.body.full_name || "").trim();
    if (!email || password.length < 6) throw new Error("Informe um e-mail e uma senha com pelo menos 6 caracteres.");
    const userId = id();
    const companyId = id();
    const timestamp = now();
    await db.transaction(async () => {
      db.run("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)", [userId, email, await bcrypt.hash(password, 10), timestamp]);
      db.run("INSERT INTO profiles (id, full_name, updated_at) VALUES (?, ?, ?)", [userId, fullName || email.split("@")[0], timestamp]);
      db.run("INSERT INTO companies (id, name, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [companyId, "Minha empresa", userId, timestamp, timestamp]);
      db.run("INSERT INTO company_members (company_id, user_id, role, created_at) VALUES (?, ?, 'admin', ?)", [companyId, userId, timestamp]);
    });
    const session = await issueSession({ id: userId, email });
    session.user.user_metadata = { full_name: fullName };
    responseData(res, { session });
  } catch (error) { sendError(res, error, 400); }
});

app.post(`${apiPrefix}/auth/signin`, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = db.get<{ id: string; email: string; password_hash: string }>("SELECT id, email, password_hash FROM users WHERE email = ?", [email]);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) throw new Error("E-mail ou senha inválidos.");
    const session = await issueSession({ id: user.id, email: user.email });
    const profile = db.get<{ full_name: string }>("SELECT full_name FROM profiles WHERE id = ?", [user.id]);
    session.user.user_metadata = { full_name: profile?.full_name || "" };
    responseData(res, { session });
  } catch (error) { sendError(res, error, 401); }
});

app.get(`${apiPrefix}/auth/session`, (req, res) => {
  const user = userForToken(bearerToken(req));
  if (!user) return responseData(res, { session: null });
  responseData(res, { session: { access_token: bearerToken(req), token_type: "bearer", user: { id: user.id, email: user.email, user_metadata: {} } } });
});
app.post(`${apiPrefix}/auth/signout`, requireAuth, async (req, res) => {
  db.run("DELETE FROM sessions WHERE token_hash = ?", [tokenHash(bearerToken(req))]);
  await db.persist();
  responseData(res, null);
});

app.post(`${apiPrefix}/rpc/:name`, requireAuth, async (req, res) => {
  const authed = req as AuthedRequest;
  try {
    const user = requireUser(authed);
    const name = req.params.name;
    if (name === "create_company_workspace") {
      const companyId = id();
      const timestamp = now();
      await db.transaction(() => {
        db.run("INSERT INTO companies (id, name, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [companyId, String(req.body.company_name || "Minha empresa").trim() || "Minha empresa", user.id, timestamp, timestamp]);
        db.run("INSERT INTO company_members (company_id, user_id, role, created_at) VALUES (?, ?, 'admin', ?)", [companyId, user.id, timestamp]);
      });
      return responseData(res, normalizeRow(db.get("SELECT * FROM companies WHERE id = ?", [companyId])));
    }
    if (name === "create_customer") {
      const companyId = String(req.body.target_company || "");
      ensureCompanyAccess(user.id, companyId);
      const customerName = String(req.body.customer_name || "").trim();
      if (!customerName) throw new Error("Nome do cliente é obrigatório");
      const customerId = id();
      const timestamp = now();
      db.run("INSERT INTO customers (id, company_id, name, phone, whatsapp, email, tax_id, address, address_number, city, state, notes, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)", [customerId, companyId, customerName, req.body.customer_phone || null, req.body.customer_whatsapp || null, req.body.customer_email || null, req.body.customer_tax_id || null, req.body.customer_address || null, req.body.customer_address_number || null, req.body.customer_city || null, req.body.customer_state || null, req.body.customer_notes || null, timestamp, timestamp]);
      await db.persist();
      return responseData(res, normalizeRow(db.get("SELECT * FROM customers WHERE id = ?", [customerId])));
    }
    if (name === "finalize_sale") {
      const payload = req.body.payload || {};
      const companyId = String(payload.company_id || "");
      const membership = ensureCompanyAccess(user.id, companyId);
      const items = Array.isArray(payload.items) ? payload.items : [];
      if (!items.length) throw new Error("A venda precisa ter pelo menos um produto");
      const status = payload.status === "pending" ? "pending" : "completed";
      const paymentMethod = String(payload.payment_method || "cash");
      const validPayments = ["pix", "cash", "credit_card", "debit_card", "transfer", "other", "receivable"];
      if (!validPayments.includes(paymentMethod)) throw new Error("Forma de pagamento inválida");
      const customerId = payload.customer_id ? String(payload.customer_id) : null;
      if (customerId && !db.get("SELECT id FROM customers WHERE id = ? AND company_id = ? AND is_active = 1", [customerId, companyId])) throw new Error("Cliente inválido para esta empresa");
      const result = await db.transaction(() => {
        const timestamp = now();
        const saleId = id();
        const saleNumber = Number(db.get<{ next_number: number }>("SELECT COALESCE(MAX(sale_number), 0) + 1 AS next_number FROM sales WHERE company_id = ?", [companyId])?.next_number || 1);
        let subtotal = 0;
        let itemDiscount = 0;
        const preparedItems: Array<{ product: any; quantity: number; unitPrice: number; discountType: string; discountInput: number; discount: number; total: number }> = [];
        for (const item of items) {
          const product = db.get<any>("SELECT * FROM products WHERE id = ? AND company_id = ? AND is_active = 1", [String(item.product_id || ""), companyId]);
          if (!product) throw new Error("Produto não encontrado ou inativo");
          const quantity = numeric(item.quantity);
          if (quantity <= 0) throw new Error("Quantidade inválida");
          const company = db.get<{ allow_negative_stock: number }>("SELECT allow_negative_stock FROM companies WHERE id = ?", [companyId]);
          if (!toBoolean(company?.allow_negative_stock) && numeric(product.stock) < quantity) throw new Error(`Estoque insuficiente para ${product.name}`);
          const unitPrice = Math.round(numeric(product.sale_price) * 100) / 100;
          const discountType = item.discount_type === "percent" ? "percent" : "fixed";
          const discountInput = membership.role === "admin" ? Math.max(0, numeric(item.discount_value)) : 0;
          const discount = discountType === "percent" ? Math.round(quantity * unitPrice * Math.min(100, discountInput) / 100 * 100) / 100 : Math.round(Math.min(quantity * unitPrice, discountInput) * 100) / 100;
          const total = Math.max(0, Math.round((quantity * unitPrice - discount) * 100) / 100);
          subtotal += Math.round(quantity * unitPrice * 100) / 100;
          itemDiscount += discount;
          preparedItems.push({ product, quantity, unitPrice, discountType, discountInput, discount, total });
        }
        const generalType = payload.general_discount_type === "percent" ? "percent" : "fixed";
        const generalInput = membership.role === "admin" ? Math.max(0, numeric(payload.general_discount_value)) : 0;
        const base = Math.max(0, subtotal - itemDiscount);
        const generalDiscount = generalType === "percent" ? Math.round(base * Math.min(100, generalInput) / 100 * 100) / 100 : Math.round(Math.min(base, generalInput) * 100) / 100;
        const total = Math.max(0, Math.round((base - generalDiscount) * 100) / 100);
        const received = payload.received_amount === null || payload.received_amount === "" || payload.received_amount === undefined ? 0 : numeric(payload.received_amount);
        if (paymentMethod === "cash" && status === "completed" && received < total) throw new Error("O valor recebido é menor que o total");
        const change = paymentMethod === "cash" ? Math.max(0, Math.round((received - total) * 100) / 100) : 0;
        db.run("INSERT INTO sales (id, company_id, sale_number, customer_id, status, payment_method, subtotal, item_discount, general_discount, total, amount_received, change_amount, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [saleId, companyId, saleNumber, customerId, status, paymentMethod, subtotal, itemDiscount, generalDiscount, total, received, change, user.id, timestamp, timestamp]);
        for (const prepared of preparedItems) {
          db.run("INSERT INTO sale_items (id, sale_id, product_id, product_name, barcode, quantity, unit_price, discount_type, discount_value, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id(), saleId, prepared.product.id, prepared.product.name, prepared.product.barcode || null, prepared.quantity, prepared.unitPrice, prepared.discountType, prepared.discountInput, prepared.total]);
          db.run("UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?", [prepared.quantity, timestamp, prepared.product.id]);
          db.run("INSERT INTO stock_movements (id, company_id, product_id, sale_id, type, quantity, previous_stock, new_stock, reason, created_by, created_at) VALUES (?, ?, ?, ?, 'out', ?, ?, ?, ?, ?, ?)", [id(), companyId, prepared.product.id, saleId, prepared.quantity, prepared.product.stock, numeric(prepared.product.stock) - prepared.quantity, `Venda #${saleNumber}`, user.id, timestamp]);
        }
        db.run("INSERT INTO payments (id, company_id, sale_id, method, status, amount, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [id(), companyId, saleId, paymentMethod, status === "completed" ? "paid" : "pending", total, status === "completed" ? timestamp : null]);
        db.run("INSERT INTO financial_transactions (id, company_id, sale_id, type, description, amount, category, status, created_by, occurred_at) VALUES (?, ?, ?, 'income', ?, ?, 'Venda', ?, ?, ?)", [id(), companyId, saleId, `Venda #${saleNumber}`, total, status === "completed" ? "paid" : "pending", user.id, timestamp]);
        db.run("INSERT INTO audit_logs (id, company_id, user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [id(), companyId, user.id, "Venda registrada", "sale", saleId, JSON.stringify({ sale_number: saleNumber, total, items: preparedItems.length }), timestamp]);
        return { id: saleId, sale_number: saleNumber, total, change };
      });
      return responseData(res, result);
    }
    throw new Error("Operação local desconhecida");
  } catch (error) { sendError(res, error, 400); }
});

app.get(`${apiPrefix}/db/:table`, requireAuth, (req, res) => {
  try {
    const authed = req as AuthedRequest;
    const user = requireUser(authed);
    const requestedTable = req.params.table;
    if (!allowedTables.has(requestedTable)) throw new Error("Tabela não disponível na API local");
    const table = requestedTable === "admin_products" ? "products" : requestedTable;
    const filters = JSON.parse(String(req.query.filters || "[]")) as Filter[];
    const select = String(req.query.select || "*");
    const membership = firstMembership(user.id);
    let query = `SELECT * FROM ${table}`;
    const clauses: string[] = [];
    const values: Array<string | number> = [];
    if (table === "company_members") {
      clauses.push("user_id = ?"); values.push(user.id);
    } else if (table === "profiles") {
      clauses.push("id = ?"); values.push(user.id);
    } else if (table === "companies") {
      clauses.push("id IN (SELECT company_id FROM company_members WHERE user_id = ?)"); values.push(user.id);
    } else if (table === "quote_items") {
      const quoteId = filters.find((filter) => filter.field === "quote_id")?.value || "";
      const quote = db.get<{ company_id: string }>("SELECT company_id FROM quotes WHERE id = ?", [quoteId]);
      ensureCompanyAccess(user.id, quote?.company_id || "");
      clauses.push("quote_id = ?"); values.push(quoteId);
    } else {
      const companyId = companyIdFromQuery(filters) || membership?.company_id || "";
      const access = ensureCompanyAccess(user.id, companyId);
      clauses.push("company_id = ?"); values.push(companyId);
      if (requestedTable === "admin_products" && access.role !== "admin") throw new Error("Não autorizado");
    }
    for (const filter of filters) {
      if (filter.field === "company_id" || (table === "company_members" && filter.field === "user_id") || (table === "quote_items" && filter.field === "quote_id")) continue;
      if (!validIdentifier(filter.field)) throw new Error("Filtro inválido");
      clauses.push(`${filter.field} = ?`); values.push(filter.value);
    }
    if (clauses.length) query += ` WHERE ${clauses.join(" AND ")}`;
    const orderBy = String(req.query.order_by || "");
    if (orderBy) {
      if (!validIdentifier(orderBy)) throw new Error("Ordenação inválida");
      query += ` ORDER BY ${orderBy} ${String(req.query.ascending) === "false" ? "DESC" : "ASC"}`;
    }
    const limit = Number(req.query.limit || 0);
    if (limit > 0) query += ` LIMIT ${Math.min(limit, 1000)}`;
    const role = table === "company_members" ? "admin" : (membership?.role || "admin");
    const rows = db.all<Record<string, any>>(query, values).map((row) => projectRow(requestedTable === "admin_products" ? "products" : table, row, select, user.id, role));
    responseData(res, rows);
  } catch (error) { sendError(res, error, 400); }
});

app.post(`${apiPrefix}/db/:table`, requireAuth, async (req, res) => {
  try {
    const authed = req as AuthedRequest;
    const user = requireUser(authed);
    const table = req.params.table;
    if (!writableTables.has(table)) throw new Error("Tabela não permite inserção direta");
    const body = req.body as Record<string, any>;
    let companyId = String(body.company_id || "");
    if (table === "quote_items") companyId = db.get<{ company_id: string }>("SELECT company_id FROM quotes WHERE id = ?", [body.quote_id])?.company_id || "";
    const membership = ensureCompanyAccess(user.id, companyId);
    if (adminOnlyTables.has(table) && membership.role !== "admin") throw new Error("Apenas administradores podem realizar esta operação");
    const clean = cleanPayload(table, body);
    const recordId = id();
    const timestamp = now();
    const extra: Record<string, unknown> = { id: recordId };
    if (table !== "quote_items" && table !== "financial_transactions") extra.created_at = timestamp;
    if (table === "quotes") { extra.quote_number = Number(db.get<{ next_number: number }>("SELECT COALESCE(MAX(quote_number), 0) + 1 AS next_number FROM quotes WHERE company_id = ?", [companyId])?.next_number || 1); extra.updated_at = timestamp; extra.status = clean.status || "draft"; extra.created_by = user.id; }
    if (table === "financial_transactions") { extra.occurred_at = timestamp; extra.created_by = user.id; }
    if (table === "products") { extra.is_active = clean.is_active ?? 1; extra.updated_at = clean.updated_at || timestamp; }
    if (table === "customers") { extra.is_active = clean.is_active ?? 1; extra.updated_at = clean.updated_at || timestamp; }
    const values = { ...extra, ...clean };
    if (table === "financial_transactions" || table === "quotes") values.created_by = user.id;
    const columns = Object.keys(values);
    db.run(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`, columns.map((column) => values[column] as any));
    await db.persist();
    const result = db.get<Record<string, any>>(`SELECT * FROM ${table} WHERE id = ?`, [recordId]);
    responseData(res, result ? normalizeRow(result) : null);
  } catch (error) { sendError(res, error, 400); }
});

app.patch(`${apiPrefix}/db/:table`, requireAuth, async (req, res) => {
  try {
    const authed = req as AuthedRequest;
    const user = requireUser(authed);
    const table = req.params.table;
    if (!writableTables.has(table)) throw new Error("Tabela não permite atualização direta");
    const recordId = String(req.query.id || req.body.id || "");
    const companyId = table === "companies" ? recordId : companyIdForRecord(table, recordId);
    const membership = ensureCompanyAccess(user.id, companyId);
    if (adminOnlyTables.has(table) && membership.role !== "admin") throw new Error("Apenas administradores podem realizar esta operação");
    const clean = cleanPayload(table, req.body);
    delete (clean as Record<string, unknown>).company_id;
    clean.updated_at = now();
    const columns = Object.keys(clean);
    if (!columns.length) throw new Error("Nenhuma alteração enviada");
    db.run(`UPDATE ${table} SET ${columns.map((column) => `${column} = ?`).join(", ")} WHERE id = ?`, [...columns.map((column) => clean[column] as any), recordId]);
    await db.persist();
    const result = db.get<Record<string, any>>(`SELECT * FROM ${table} WHERE id = ?`, [recordId]);
    responseData(res, result ? normalizeRow(result) : null);
  } catch (error) { sendError(res, error, 400); }
});

app.delete(`${apiPrefix}/db/:table`, requireAuth, async (req, res) => {
  try {
    const authed = req as AuthedRequest;
    const user = requireUser(authed);
    const table = req.params.table;
    if (!writableTables.has(table)) throw new Error("Tabela não permite exclusão direta");
    const recordId = String(req.query.id || "");
    const companyId = companyIdForRecord(table, recordId);
    const membership = ensureCompanyAccess(user.id, companyId);
    if (membership.role !== "admin") throw new Error("Apenas administradores podem realizar esta operação");
    db.run(`DELETE FROM ${table} WHERE id = ?`, [recordId]);
    await db.persist();
    responseData(res, null);
  } catch (error) { sendError(res, error, 400); }
});

const clientDist = path.resolve("dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/.*/, (_, res) => res.sendFile(path.join(clientDist, "index.html")));
}

await db.waitUntilReady();
app.listen(port, () => console.log(`ControlaVenda local API: http://localhost:${port}`));
