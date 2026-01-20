/*
  # Create Inventory and Resources System

  1. New Tables
    - `inventory_products`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `name` (text) - Nombre del producto/insumo
      - `description` (text)
      - `sku` (text, unique) - Código interno
      - `barcode` (text) - Código de barras
      - `qr_code` (text) - Código QR
      - `photo_url` (text)
      - `category` (text) - Categoría del producto
      - `unit_of_measure` (text) - Unidad de medida (litros, piezas, etc)
      - `unit_cost` (numeric) - Costo por unidad
      - `current_stock` (numeric) - Stock actual
      - `min_stock` (numeric) - Stock mínimo (alerta)
      - `max_stock` (numeric) - Stock máximo
      - `location` (text) - Ubicación en almacén
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `inventory_movements`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `branch_id` (uuid, references branches)
      - `product_id` (uuid, references inventory_products)
      - `movement_type` (text) - entrada, salida, ajuste
      - `quantity` (numeric) - Cantidad (positiva o negativa)
      - `unit_cost` (numeric)
      - `total_cost` (numeric)
      - `reference_type` (text) - orden, compra, ajuste, otro
      - `reference_id` (uuid) - ID de la orden/compra relacionada
      - `reason` (text) - Motivo del movimiento
      - `notes` (text)
      - `performed_by` (uuid, references user_profiles)
      - `created_at` (timestamptz)

    - `order_product_consumption`
      - `id` (uuid, primary key)
      - `order_id` (uuid, references service_orders)
      - `product_id` (uuid, references inventory_products)
      - `quantity_used` (numeric)
      - `unit_cost` (numeric)
      - `total_cost` (numeric)
      - `created_at` (timestamptz)

    - `product_categories`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `name` (text)
      - `description` (text)
      - `is_active` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for company-based access control

  3. Indexes
    - Index on product SKU and barcodes
    - Index on stock levels for alerts
    - Index on movements by date
*/

-- Create product_categories table
CREATE TABLE IF NOT EXISTS product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(company_id, name)
);

-- Create inventory_products table
CREATE TABLE IF NOT EXISTS inventory_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES product_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  sku text,
  barcode text,
  qr_code text,
  photo_url text,
  unit_of_measure text DEFAULT 'unidad' NOT NULL,
  unit_cost numeric(10,2) DEFAULT 0,
  current_stock numeric(10,2) DEFAULT 0 NOT NULL,
  min_stock numeric(10,2) DEFAULT 0,
  max_stock numeric(10,2),
  location text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(company_id, sku)
);

-- Create inventory_movements table
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  product_id uuid REFERENCES inventory_products(id) ON DELETE CASCADE NOT NULL,
  movement_type text CHECK (movement_type IN ('entrada', 'salida', 'ajuste')) NOT NULL,
  quantity numeric(10,2) NOT NULL,
  unit_cost numeric(10,2) DEFAULT 0,
  total_cost numeric(10,2) DEFAULT 0,
  reference_type text CHECK (reference_type IN ('orden', 'compra', 'ajuste', 'traspaso', 'otro')) DEFAULT 'otro',
  reference_id uuid,
  reason text,
  notes text,
  performed_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create order_product_consumption table
CREATE TABLE IF NOT EXISTS order_product_consumption (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES service_orders(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES inventory_products(id) ON DELETE CASCADE NOT NULL,
  quantity_used numeric(10,2) NOT NULL,
  unit_cost numeric(10,2) DEFAULT 0,
  total_cost numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_product_categories_company ON product_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_products_company ON inventory_products(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_products_category ON inventory_products(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_products_sku ON inventory_products(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_products_barcode ON inventory_products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_products_low_stock ON inventory_products(company_id, current_stock) WHERE current_stock <= min_stock;
CREATE INDEX IF NOT EXISTS idx_inventory_movements_company ON inventory_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_consumption_order ON order_product_consumption(order_id);
CREATE INDEX IF NOT EXISTS idx_order_consumption_product ON order_product_consumption(product_id);

-- Enable RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_product_consumption ENABLE ROW LEVEL SECURITY;

-- Policies for product_categories
CREATE POLICY "Root can view all categories"
  ON product_categories FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
    )
  );

CREATE POLICY "Company users can view company categories"
  ON product_categories FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage categories"
  ON product_categories FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Policies for inventory_products
CREATE POLICY "Root can view all products"
  ON inventory_products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
    )
  );

CREATE POLICY "Company users can view company products"
  ON inventory_products FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Authorized users can manage products"
  ON inventory_products FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'operator')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'operator')
    )
  );

-- Policies for inventory_movements
CREATE POLICY "Root can view all movements"
  ON inventory_movements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
    )
  );

CREATE POLICY "Company users can view company movements"
  ON inventory_movements FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Authorized users can insert movements"
  ON inventory_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'operator')
    )
  );

-- Policies for order_product_consumption
CREATE POLICY "Users can view order consumption"
  ON order_product_consumption FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_orders
      WHERE service_orders.id = order_product_consumption.order_id
      AND service_orders.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert order consumption"
  ON order_product_consumption FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_orders
      WHERE service_orders.id = order_product_consumption.order_id
      AND service_orders.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

-- Function to update product stock
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'entrada' THEN
    UPDATE inventory_products
    SET current_stock = current_stock + NEW.quantity
    WHERE id = NEW.product_id;
  ELSIF NEW.movement_type = 'salida' THEN
    UPDATE inventory_products
    SET current_stock = current_stock - NEW.quantity
    WHERE id = NEW.product_id;
  ELSIF NEW.movement_type = 'ajuste' THEN
    UPDATE inventory_products
    SET current_stock = NEW.quantity
    WHERE id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stock on movement
DROP TRIGGER IF EXISTS update_stock_on_movement ON inventory_movements;
CREATE TRIGGER update_stock_on_movement
  AFTER INSERT ON inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_product_stock();

-- Function to record consumption when order uses products
CREATE OR REPLACE FUNCTION record_product_consumption()
RETURNS TRIGGER AS $$
BEGIN
  -- Create movement record
  INSERT INTO inventory_movements (
    company_id,
    branch_id,
    product_id,
    movement_type,
    quantity,
    unit_cost,
    total_cost,
    reference_type,
    reference_id,
    reason,
    performed_by
  )
  SELECT 
    so.company_id,
    so.branch_id,
    NEW.product_id,
    'salida',
    NEW.quantity_used,
    NEW.unit_cost,
    NEW.total_cost,
    'orden',
    NEW.order_id,
    'Consumo en orden ' || so.ticket_number,
    so.created_by
  FROM service_orders so
  WHERE so.id = NEW.order_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to record consumption
DROP TRIGGER IF EXISTS record_consumption_trigger ON order_product_consumption;
CREATE TRIGGER record_consumption_trigger
  AFTER INSERT ON order_product_consumption
  FOR EACH ROW
  EXECUTE FUNCTION record_product_consumption();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for timestamps
DROP TRIGGER IF EXISTS update_inventory_products_timestamp ON inventory_products;
CREATE TRIGGER update_inventory_products_timestamp
  BEFORE UPDATE ON inventory_products
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_timestamp();

-- Function to generate SKU
CREATE OR REPLACE FUNCTION generate_sku(p_company_id uuid)
RETURNS text AS $$
DECLARE
  new_sku text;
  sequence_num integer;
BEGIN
  SELECT COALESCE(MAX(
    CASE 
      WHEN sku ~ '^SKU-[0-9]+$'
      THEN CAST(substring(sku from 'SKU-([0-9]+)') AS integer)
      ELSE 0
    END
  ), 0) + 1
  INTO sequence_num
  FROM inventory_products
  WHERE company_id = p_company_id;
  
  new_sku := 'SKU-' || LPAD(sequence_num::text, 6, '0');
  
  RETURN new_sku;
END;
$$ LANGUAGE plpgsql;

-- View for low stock alerts
CREATE OR REPLACE VIEW low_stock_products AS
SELECT 
  p.*,
  c.name as category_name,
  co.name as company_name
FROM inventory_products p
LEFT JOIN product_categories c ON p.category_id = c.id
LEFT JOIN companies co ON p.company_id = co.id
WHERE p.is_active = true
AND p.current_stock <= p.min_stock
ORDER BY p.company_id, (p.current_stock / NULLIF(p.min_stock, 0));
