/*
  # Insert System Roles and Default Permissions

  1. System Roles
    - Insert existing system roles (root, admin, supervisor, cashier, operator, marketing, accountant)
    - Mark them as system roles with appropriate levels
    - Global roles (company_id = NULL)

  2. Default Permissions Assignment
    - Assign permissions to each role based on their responsibilities
    - Root gets all permissions
    - Each role gets specific permissions for their function

  3. Important Notes
    - These roles are the baseline configuration
    - Admins can modify permissions later
    - System roles cannot be deleted but permissions can be adjusted
*/

-- Insert system roles (company_id is NULL for global roles)
INSERT INTO roles (id, company_id, name, description, is_system_role, is_active, level, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'root', 'Acceso total a todas las empresas y funcionalidades del sistema', true, true, 100, now()),
  ('00000000-0000-0000-0000-000000000002', NULL, 'admin', 'Administrador de empresa con acceso completo a su compañía', true, true, 90, now()),
  ('00000000-0000-0000-0000-000000000003', NULL, 'manager', 'Gerente con acceso a operaciones y reportes', true, true, 70, now()),
  ('00000000-0000-0000-0000-000000000004', NULL, 'supervisor', 'Supervisor de operaciones diarias y caja', true, true, 60, now()),
  ('00000000-0000-0000-0000-000000000005', NULL, 'operator', 'Operador de órdenes y servicios', true, true, 50, now()),
  ('00000000-0000-0000-0000-000000000006', NULL, 'cashier', 'Cajero para procesar pagos y facturas', true, true, 40, now()),
  ('00000000-0000-0000-0000-000000000007', NULL, 'marketing', 'Especialista en marketing y promociones', true, true, 30, now()),
  ('00000000-0000-0000-0000-000000000008', NULL, 'accountant', 'Contador con acceso a finanzas y reportes', true, true, 30, now())
ON CONFLICT (id) DO NOTHING;

-- Get permission IDs for assignment
DO $$
DECLARE
  v_root_id uuid := '00000000-0000-0000-0000-000000000001';
  v_admin_id uuid := '00000000-0000-0000-0000-000000000002';
  v_manager_id uuid := '00000000-0000-0000-0000-000000000003';
  v_supervisor_id uuid := '00000000-0000-0000-0000-000000000004';
  v_operator_id uuid := '00000000-0000-0000-0000-000000000005';
  v_cashier_id uuid := '00000000-0000-0000-0000-000000000006';
  v_marketing_id uuid := '00000000-0000-0000-0000-000000000007';
  v_accountant_id uuid := '00000000-0000-0000-0000-000000000008';
  v_perm_id uuid;
BEGIN
  -- ROOT: All permissions
  FOR v_perm_id IN (SELECT id FROM permissions) LOOP
    INSERT INTO role_permissions (role_id, permission_id, granted)
    VALUES (v_root_id, v_perm_id, true)
    ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = true;
  END LOOP;

  -- ADMIN: All except companies management
  FOR v_perm_id IN (
    SELECT id FROM permissions 
    WHERE NOT (module = 'companies' AND action != 'view')
  ) LOOP
    INSERT INTO role_permissions (role_id, permission_id, granted)
    VALUES (v_admin_id, v_perm_id, true)
    ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = true;
  END LOOP;

  -- MANAGER: Operations, reports, staff management
  FOR v_perm_id IN (
    SELECT id FROM permissions WHERE
    (module = 'dashboard' AND action = 'view') OR
    (module = 'orders' AND action IN ('view', 'create', 'edit', 'manage_status')) OR
    (module = 'customers' AND action IN ('view', 'create', 'edit')) OR
    (module = 'vehicles' AND action IN ('view', 'create', 'edit')) OR
    (module = 'services' AND action IN ('view', 'create', 'edit')) OR
    (module = 'inventory' AND action IN ('view', 'create', 'edit', 'manage_stock')) OR
    (module = 'staff' AND action IN ('view', 'create', 'edit')) OR
    (module = 'users' AND action = 'view') OR
    (module = 'branches' AND action = 'view') OR
    (module = 'accounting' AND action IN ('view', 'view_reports', 'manage_invoices')) OR
    (module = 'reports' AND action IN ('view', 'export')) OR
    (module = 'appointments' AND action IN ('view', 'create', 'edit')) OR
    (module = 'cash' AND action IN ('view', 'manage_transactions'))
  ) LOOP
    INSERT INTO role_permissions (role_id, permission_id, granted)
    VALUES (v_manager_id, v_perm_id, true)
    ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = true;
  END LOOP;

  -- SUPERVISOR: Daily operations and cash management
  FOR v_perm_id IN (
    SELECT id FROM permissions WHERE
    (module = 'dashboard' AND action = 'view') OR
    (module = 'orders' AND action IN ('view', 'create', 'edit', 'manage_status')) OR
    (module = 'customers' AND action IN ('view', 'create', 'edit')) OR
    (module = 'vehicles' AND action IN ('view', 'create')) OR
    (module = 'inventory' AND action IN ('view', 'manage_stock')) OR
    (module = 'staff' AND action = 'view') OR
    (module = 'accounting' AND action IN ('view', 'manage_cash')) OR
    (module = 'reports' AND action = 'view') OR
    (module = 'appointments' AND action IN ('view', 'create', 'edit')) OR
    (module = 'cash' AND action IN ('view', 'open_close', 'manage_transactions'))
  ) LOOP
    INSERT INTO role_permissions (role_id, permission_id, granted)
    VALUES (v_supervisor_id, v_perm_id, true)
    ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = true;
  END LOOP;

  -- OPERATOR: Service orders and operations
  FOR v_perm_id IN (
    SELECT id FROM permissions WHERE
    (module = 'dashboard' AND action = 'view') OR
    (module = 'orders' AND action IN ('view', 'create', 'edit')) OR
    (module = 'customers' AND action IN ('view', 'create')) OR
    (module = 'vehicles' AND action IN ('view', 'create')) OR
    (module = 'services' AND action = 'view') OR
    (module = 'inventory' AND action IN ('view', 'manage_stock')) OR
    (module = 'appointments' AND action IN ('view', 'edit'))
  ) LOOP
    INSERT INTO role_permissions (role_id, permission_id, granted)
    VALUES (v_operator_id, v_perm_id, true)
    ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = true;
  END LOOP;

  -- CASHIER: Payments, invoices and cash
  FOR v_perm_id IN (
    SELECT id FROM permissions WHERE
    (module = 'dashboard' AND action = 'view') OR
    (module = 'orders' AND action = 'view') OR
    (module = 'customers' AND action IN ('view', 'create')) OR
    (module = 'vehicles' AND action = 'view') OR
    (module = 'accounting' AND action IN ('view', 'manage_cash', 'manage_invoices')) OR
    (module = 'appointments' AND action IN ('view', 'create')) OR
    (module = 'cash' AND action IN ('view', 'open_close', 'manage_transactions'))
  ) LOOP
    INSERT INTO role_permissions (role_id, permission_id, granted)
    VALUES (v_cashier_id, v_perm_id, true)
    ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = true;
  END LOOP;

  -- MARKETING: Campaigns and customer engagement
  FOR v_perm_id IN (
    SELECT id FROM permissions WHERE
    (module = 'dashboard' AND action = 'view') OR
    (module = 'customers' AND action = 'view') OR
    (module = 'marketing' AND action IN ('view', 'create', 'edit', 'manage_loyalty')) OR
    (module = 'reports' AND action = 'view')
  ) LOOP
    INSERT INTO role_permissions (role_id, permission_id, granted)
    VALUES (v_marketing_id, v_perm_id, true)
    ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = true;
  END LOOP;

  -- ACCOUNTANT: Financial reports and accounting
  FOR v_perm_id IN (
    SELECT id FROM permissions WHERE
    (module = 'dashboard' AND action = 'view') OR
    (module = 'orders' AND action = 'view') OR
    (module = 'accounting' AND action IN ('view', 'view_reports', 'manage_invoices', 'manage_taxes')) OR
    (module = 'reports' AND action IN ('view', 'export')) OR
    (module = 'cash' AND action = 'view')
  ) LOOP
    INSERT INTO role_permissions (role_id, permission_id, granted)
    VALUES (v_accountant_id, v_perm_id, true)
    ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = true;
  END LOOP;

END $$;
