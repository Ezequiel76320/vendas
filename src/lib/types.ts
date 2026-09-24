export type Company = {
  id: string;
  name: string;
  legal_name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  address_number?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  tax_id?: string | null;
  logo_url?: string | null;
  notes?: string | null;
  allow_negative_stock?: boolean;
};

export type Product = {
  id: string;
  company_id: string;
  name: string;
  barcode?: string | null;
  sku?: string | null;
  description?: string | null;
  category_id?: string | null;
  category?: { name: string } | null;
  image_url?: string | null;
  cost_price: number;
  sale_price: number;
  stock: number;
  minimum_stock: number;
  supplier_name?: string | null;
  is_active: boolean;
};

export type Customer = {
  id: string;
  company_id: string;
  name: string;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  address_number?: string | null;
  city?: string | null;
  state?: string | null;
  tax_id?: string | null;
  notes?: string | null;
  is_active: boolean;
};

export type Sale = {
  id: string;
  company_id: string;
  sale_number: number;
  customer_id?: string | null;
  customer?: { name: string } | null;
  status: 'paid' | 'pending' | 'cancelled';
  payment_method: string;
  subtotal: number;
  item_discount: number;
  general_discount: number;
  total: number;
  created_at: string;
  notes?: string | null;
};

export type Quote = {
  id: string;
  quote_number: number;
  customer_id?: string | null;
  customer?: { name: string } | null;
  status: 'draft' | 'sent' | 'approved' | 'converted' | 'cancelled';
  subtotal: number;
  discount: number;
  total: number;
  notes?: string | null;
  created_at: string;
};

export type CartItem = Product & { quantity: number; unitPrice: number; discount: number };

export type Membership = { company_id: string; user_id: string; role: 'admin' | 'employee'; company: Company };
