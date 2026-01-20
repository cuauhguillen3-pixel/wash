/*
  # Create Roles and Permissions System

  1. New Tables
    - `roles`
      - Roles personalizados por compañía
      - Nombre, descripción, nivel de acceso
      - Rol activo/inactivo
    
    - `permissions`
      - Permisos granulares por módulo
      - Define qué puede hacer cada rol en cada sección
      - Permisos: view, create, edit, delete, manage
    
    - `role_permissions`
      - Tabla de relación entre roles y permisos
      - Un rol puede tener múltiples permisos
      - Un permiso puede estar en múltiples roles

  2. Modules Available
    - dashboard: Panel principal
    - orders: Órdenes de servicio
    - customers: Clientes
    - vehicles: Vehículos
    - services: Servicios y paquetes
    - inventory: Inventario
    - staff: Personal
    - users: Usuarios del sistema
    - branches: Sucursales
    - companies: Empresas (solo root)
    - accounting: Contabilidad
    - reports: Reportes
    - marketing: Marketing y fidelización
    - appointments: Citas
    - cash: Caja

  3. Security
    - Enable RLS on all tables
    - Company-based access control
    - Only admins can manage roles and permissions

  4. Important Notes
    - Los roles por defecto (root, admin, manager, etc.) se mantienen
    - Este sistema permite crear roles personalizados adicionales
    - Los permisos se verifican en el frontend y backend
*/

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_system_role boolean DEFAULT false,
  is_active boolean DEFAULT true,
  level integer DEFAULT 50,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, name)
);

-- Create permissions table (catalog)
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(module, action)
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- Insert default permissions for all modules
INSERT INTO permissions (module, action, description) VALUES
  -- Dashboard
  ('dashboard', 'view', 'Ver panel principal'),
  
  -- Orders
  ('orders', 'view', 'Ver órdenes de servicio'),
  ('orders', 'create', 'Crear órdenes de servicio'),
  ('orders', 'edit', 'Editar órdenes de servicio'),
  ('orders', 'delete', 'Eliminar órdenes de servicio'),
  ('orders', 'manage_status', 'Gestionar estados de órdenes'),
  
  -- Customers
  ('customers', 'view', 'Ver clientes'),
  ('customers', 'create', 'Crear clientes'),
  ('customers', 'edit', 'Editar clientes'),
  ('customers', 'delete', 'Eliminar clientes'),
  
  -- Vehicles
  ('vehicles', 'view', 'Ver vehículos'),
  ('vehicles', 'create', 'Crear vehículos'),
  ('vehicles', 'edit', 'Editar vehículos'),
  ('vehicles', 'delete', 'Eliminar vehículos'),
  
  -- Services
  ('services', 'view', 'Ver servicios y paquetes'),
  ('services', 'create', 'Crear servicios y paquetes'),
  ('services', 'edit', 'Editar servicios y paquetes'),
  ('services', 'delete', 'Eliminar servicios y paquetes'),
  
  -- Inventory
  ('inventory', 'view', 'Ver inventario'),
  ('inventory', 'create', 'Agregar productos al inventario'),
  ('inventory', 'edit', 'Editar inventario'),
  ('inventory', 'delete', 'Eliminar productos del inventario'),
  ('inventory', 'manage_stock', 'Gestionar movimientos de stock'),
  
  -- Staff
  ('staff', 'view', 'Ver personal'),
  ('staff', 'create', 'Crear personal'),
  ('staff', 'edit', 'Editar personal'),
  ('staff', 'delete', 'Eliminar personal'),
  
  -- Users
  ('users', 'view', 'Ver usuarios del sistema'),
  ('users', 'create', 'Crear usuarios del sistema'),
  ('users', 'edit', 'Editar usuarios del sistema'),
  ('users', 'delete', 'Eliminar usuarios del sistema'),
  ('users', 'manage_roles', 'Gestionar roles y permisos'),
  
  -- Branches
  ('branches', 'view', 'Ver sucursales'),
  ('branches', 'create', 'Crear sucursales'),
  ('branches', 'edit', 'Editar sucursales'),
  ('branches', 'delete', 'Eliminar sucursales'),
  
  -- Companies
  ('companies', 'view', 'Ver empresas'),
  ('companies', 'create', 'Crear empresas'),
  ('companies', 'edit', 'Editar empresas'),
  ('companies', 'delete', 'Eliminar empresas'),
  
  -- Accounting
  ('accounting', 'view', 'Ver contabilidad'),
  ('accounting', 'manage_cash', 'Gestionar caja'),
  ('accounting', 'view_reports', 'Ver reportes financieros'),
  ('accounting', 'manage_invoices', 'Gestionar facturas'),
  ('accounting', 'manage_taxes', 'Gestionar impuestos'),
  
  -- Reports
  ('reports', 'view', 'Ver reportes'),
  ('reports', 'export', 'Exportar reportes'),
  
  -- Marketing
  ('marketing', 'view', 'Ver marketing y promociones'),
  ('marketing', 'create', 'Crear campañas de marketing'),
  ('marketing', 'edit', 'Editar campañas de marketing'),
  ('marketing', 'manage_loyalty', 'Gestionar programa de fidelización'),
  
  -- Appointments
  ('appointments', 'view', 'Ver citas'),
  ('appointments', 'create', 'Crear citas'),
  ('appointments', 'edit', 'Editar citas'),
  ('appointments', 'delete', 'Eliminar citas'),
  
  -- Cash
  ('cash', 'view', 'Ver caja'),
  ('cash', 'open_close', 'Abrir y cerrar caja'),
  ('cash', 'manage_transactions', 'Gestionar transacciones de caja')

ON CONFLICT (module, action) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_roles_company ON roles(company_id);
CREATE INDEX IF NOT EXISTS idx_roles_active ON roles(is_active);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles
CREATE POLICY "Users can view their company roles"
  ON roles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
    OR company_id IS NULL
  );

CREATE POLICY "Admins can manage roles"
  ON roles FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'root')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'root')
    )
  );

-- RLS Policies for permissions (read-only for most users)
CREATE POLICY "Users can view all permissions"
  ON permissions FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for role_permissions
CREATE POLICY "Users can view role permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (
    role_id IN (
      SELECT id FROM roles WHERE company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage role permissions"
  ON role_permissions FOR ALL
  TO authenticated
  USING (
    role_id IN (
      SELECT id FROM roles WHERE company_id IN (
        SELECT company_id FROM user_profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'root')
      )
    )
  )
  WITH CHECK (
    role_id IN (
      SELECT id FROM roles WHERE company_id IN (
        SELECT company_id FROM user_profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'root')
      )
    )
  );

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(
  user_id uuid,
  check_module text,
  check_action text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
  has_perm boolean;
BEGIN
  -- Get user's role
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = user_id;

  -- Root has all permissions
  IF user_role = 'root' THEN
    RETURN true;
  END IF;

  -- Check if user has the permission through their role
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles up
    JOIN roles r ON r.name = up.role AND r.company_id = up.company_id
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE up.id = user_id
      AND p.module = check_module
      AND p.action = check_action
      AND rp.granted = true
  ) INTO has_perm;

  RETURN has_perm;
END;
$$;
