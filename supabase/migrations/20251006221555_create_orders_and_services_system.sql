/*
  # Create Orders and Services System

  1. New Tables
    - `service_packages`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `name` (text) - Nombre del paquete
      - `description` (text)
      - `price` (numeric) - Precio base
      - `duration_minutes` (integer) - Duración estimada
      - `is_combo` (boolean) - Si es paquete combo
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `package_services`
      - `id` (uuid, primary key)
      - `package_id` (uuid, references service_packages)
      - `service_id` (uuid, references services)
      - `quantity` (integer) - Cantidad del servicio en el paquete
      - `created_at` (timestamptz)

    - `service_orders`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `branch_id` (uuid, references branches)
      - `ticket_number` (text, unique) - Número de ticket
      - `customer_id` (uuid, references customers)
      - `vehicle_id` (uuid, references vehicles)
      - `status` (text) - pendiente, en_proceso, terminado, entregado, facturado, cancelado
      - `subtotal` (numeric)
      - `discount_amount` (numeric)
      - `discount_percentage` (numeric)
      - `tax_amount` (numeric)
      - `total` (numeric)
      - `payment_method` (text)
      - `payment_status` (text) - pendiente, pagado, parcial
      - `notes` (text)
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `delivered_at` (timestamptz)
      - `invoiced_at` (timestamptz)
      - `created_by` (uuid, references user_profiles)
      - `assigned_to` (uuid, references employees)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `order_items`
      - `id` (uuid, primary key)
      - `order_id` (uuid, references service_orders)
      - `item_type` (text) - service, package, complement
      - `service_id` (uuid, references services)
      - `package_id` (uuid, references service_packages)
      - `name` (text) - Nombre del item
      - `description` (text)
      - `quantity` (integer)
      - `unit_price` (numeric)
      - `discount_amount` (numeric)
      - `subtotal` (numeric)
      - `total` (numeric)
      - `created_at` (timestamptz)

    - `order_status_history`
      - `id` (uuid, primary key)
      - `order_id` (uuid, references service_orders)
      - `status` (text)
      - `notes` (text)
      - `changed_by` (uuid, references user_profiles)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for company-based access control

  3. Indexes
    - Index on ticket_number for quick lookups
    - Index on order status and dates
    - Index on customer and vehicle
*/

-- Create service_packages table
CREATE TABLE IF NOT EXISTS service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  duration_minutes integer DEFAULT 0,
  is_combo boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create package_services table (many-to-many)
CREATE TABLE IF NOT EXISTS package_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid REFERENCES service_packages(id) ON DELETE CASCADE NOT NULL,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  quantity integer DEFAULT 1 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(package_id, service_id)
);

-- Create service_orders table
CREATE TABLE IF NOT EXISTS service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  ticket_number text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL NOT NULL,
  status text CHECK (status IN ('pendiente', 'en_proceso', 'terminado', 'entregado', 'facturado', 'cancelado')) DEFAULT 'pendiente' NOT NULL,
  subtotal numeric(10,2) DEFAULT 0 NOT NULL,
  discount_amount numeric(10,2) DEFAULT 0,
  discount_percentage numeric(5,2) DEFAULT 0,
  tax_amount numeric(10,2) DEFAULT 0,
  total numeric(10,2) DEFAULT 0 NOT NULL,
  payment_method text,
  payment_status text CHECK (payment_status IN ('pendiente', 'pagado', 'parcial')) DEFAULT 'pendiente',
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  delivered_at timestamptz,
  invoiced_at timestamptz,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(company_id, ticket_number)
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES service_orders(id) ON DELETE CASCADE NOT NULL,
  item_type text CHECK (item_type IN ('service', 'package', 'complement')) NOT NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  package_id uuid REFERENCES service_packages(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  quantity integer DEFAULT 1 NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  discount_amount numeric(10,2) DEFAULT 0,
  subtotal numeric(10,2) NOT NULL,
  total numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create order_status_history table
CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES service_orders(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL,
  notes text,
  changed_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_service_packages_company ON service_packages(company_id);
CREATE INDEX IF NOT EXISTS idx_package_services_package ON package_services(package_id);
CREATE INDEX IF NOT EXISTS idx_package_services_service ON package_services(service_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_company ON service_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_branch ON service_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_ticket ON service_orders(ticket_number);
CREATE INDEX IF NOT EXISTS idx_service_orders_customer ON service_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_vehicle ON service_orders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);
CREATE INDEX IF NOT EXISTS idx_service_orders_created_at ON service_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);

-- Enable RLS
ALTER TABLE service_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Policies for service_packages
CREATE POLICY "Root can view all packages"
  ON service_packages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
    )
  );

CREATE POLICY "Company users can view company packages"
  ON service_packages FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage packages"
  ON service_packages FOR ALL
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

-- Policies for package_services
CREATE POLICY "Users can view package services"
  ON package_services FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_packages
      WHERE service_packages.id = package_services.package_id
      AND service_packages.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage package services"
  ON package_services FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_packages
      WHERE service_packages.id = package_services.package_id
      AND service_packages.company_id IN (
        SELECT company_id FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'manager')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_packages
      WHERE service_packages.id = package_services.package_id
      AND service_packages.company_id IN (
        SELECT company_id FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'manager')
      )
    )
  );

-- Policies for service_orders
CREATE POLICY "Root can view all orders"
  ON service_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
    )
  );

CREATE POLICY "Company users can view company orders"
  ON service_orders FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Company users can insert orders"
  ON service_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Company users can update orders"
  ON service_orders FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- Policies for order_items
CREATE POLICY "Users can view order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_orders
      WHERE service_orders.id = order_items.order_id
      AND service_orders.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage order items"
  ON order_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_orders
      WHERE service_orders.id = order_items.order_id
      AND service_orders.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_orders
      WHERE service_orders.id = order_items.order_id
      AND service_orders.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

-- Policies for order_status_history
CREATE POLICY "Users can view order history"
  ON order_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_orders
      WHERE service_orders.id = order_status_history.order_id
      AND service_orders.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert order history"
  ON order_status_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_orders
      WHERE service_orders.id = order_status_history.order_id
      AND service_orders.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS update_service_packages_timestamp ON service_packages;
CREATE TRIGGER update_service_packages_timestamp
  BEFORE UPDATE ON service_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_order_timestamp();

DROP TRIGGER IF EXISTS update_service_orders_timestamp ON service_orders;
CREATE TRIGGER update_service_orders_timestamp
  BEFORE UPDATE ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_timestamp();

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number(p_company_id uuid)
RETURNS text AS $$
DECLARE
  new_number text;
  date_prefix text;
  sequence_num integer;
BEGIN
  date_prefix := to_char(now(), 'YYYYMMDD');
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN ticket_number LIKE date_prefix || '-%' 
      THEN CAST(split_part(ticket_number, '-', 2) AS integer)
      ELSE 0
    END
  ), 0) + 1
  INTO sequence_num
  FROM service_orders
  WHERE company_id = p_company_id
  AND ticket_number LIKE date_prefix || '-%';
  
  new_number := date_prefix || '-' || LPAD(sequence_num::text, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to record status change in history
CREATE OR REPLACE FUNCTION record_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO order_status_history (order_id, status, changed_by)
    VALUES (NEW.id, NEW.status, NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to record status changes
DROP TRIGGER IF EXISTS record_status_change_trigger ON service_orders;
CREATE TRIGGER record_status_change_trigger
  AFTER INSERT OR UPDATE OF status ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION record_order_status_change();
