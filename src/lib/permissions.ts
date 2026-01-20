import type { UserRole } from './database.types';

export type Permission =
  | 'manage_companies'
  | 'manage_branches'
  | 'manage_users'
  | 'manage_services'
  | 'manage_prices'
  | 'view_all_branches'
  | 'daily_operations'
  | 'manage_cash_register'
  | 'authorize_discounts'
  | 'view_reports'
  | 'process_payments'
  | 'create_invoices'
  | 'open_cash_register'
  | 'close_cash_register'
  | 'view_appointments'
  | 'create_appointments'
  | 'update_appointments'
  | 'view_customers'
  | 'create_customers'
  | 'update_customers'
  | 'checkin_vehicle'
  | 'checkout_vehicle'
  | 'consume_supplies'
  | 'advance_orders'
  | 'create_campaigns'
  | 'manage_coupons'
  | 'view_segments'
  | 'send_communications'
  | 'export_reports'
  | 'view_journal_entries'
  | 'manage_taxes'
  | 'view_financial_data';

const rolePermissions: Record<UserRole, Permission[]> = {
  root: [
    'manage_companies',
    'manage_branches',
    'manage_users',
    'manage_services',
    'manage_prices',
    'view_all_branches',
    'daily_operations',
    'manage_cash_register',
    'authorize_discounts',
    'view_reports',
    'process_payments',
    'create_invoices',
    'open_cash_register',
    'close_cash_register',
    'view_appointments',
    'create_appointments',
    'update_appointments',
    'view_customers',
    'create_customers',
    'update_customers',
    'checkin_vehicle',
    'checkout_vehicle',
    'consume_supplies',
    'advance_orders',
    'create_campaigns',
    'manage_coupons',
    'view_segments',
    'send_communications',
    'export_reports',
    'view_journal_entries',
    'manage_taxes',
    'view_financial_data',
  ],
  admin: [
    'manage_branches',
    'manage_users',
    'manage_services',
    'manage_prices',
    'view_all_branches',
    'daily_operations',
    'manage_cash_register',
    'authorize_discounts',
    'view_reports',
    'view_appointments',
    'create_appointments',
    'update_appointments',
    'view_customers',
    'create_customers',
    'update_customers',
    'create_campaigns',
    'manage_coupons',
    'view_segments',
    'export_reports',
    'view_financial_data',
  ],
  supervisor: [
    'daily_operations',
    'manage_cash_register',
    'authorize_discounts',
    'view_reports',
    'view_appointments',
    'create_appointments',
    'update_appointments',
    'view_customers',
    'create_customers',
    'update_customers',
  ],
  cashier: [
    'process_payments',
    'create_invoices',
    'open_cash_register',
    'close_cash_register',
    'view_appointments',
    'create_appointments',
    'update_appointments',
    'view_customers',
    'create_customers',
  ],
  operator: [
    'view_appointments',
    'update_appointments',
    'view_customers',
    'checkin_vehicle',
    'checkout_vehicle',
    'consume_supplies',
    'advance_orders',
  ],
  marketing: [
    'view_customers',
    'create_campaigns',
    'manage_coupons',
    'view_segments',
    'send_communications',
  ],
  accountant: [
    'view_reports',
    'export_reports',
    'view_journal_entries',
    'manage_taxes',
    'view_financial_data',
  ],
};

const permissionToModuleAction: Record<Permission, string> = {
  'manage_companies': 'companies.manage',
  'manage_branches': 'branches.manage',
  'manage_users': 'users.manage',
  'manage_services': 'services.manage',
  'manage_prices': 'services.edit',
  'view_all_branches': 'branches.view',
  'daily_operations': 'orders.manage_status',
  'manage_cash_register': 'cash.manage_transactions',
  'authorize_discounts': 'orders.edit',
  'view_reports': 'reports.view',
  'process_payments': 'accounting.manage_cash',
  'create_invoices': 'accounting.manage_invoices',
  'open_cash_register': 'cash.open_close',
  'close_cash_register': 'cash.open_close',
  'view_appointments': 'appointments.view',
  'create_appointments': 'appointments.create',
  'update_appointments': 'appointments.edit',
  'view_customers': 'customers.view',
  'create_customers': 'customers.create',
  'update_customers': 'customers.edit',
  'checkin_vehicle': 'orders.create',
  'checkout_vehicle': 'orders.edit',
  'consume_supplies': 'inventory.manage_stock',
  'advance_orders': 'orders.manage_status',
  'create_campaigns': 'marketing.create',
  'manage_coupons': 'marketing.manage_loyalty',
  'view_segments': 'marketing.view',
  'send_communications': 'marketing.edit',
  'export_reports': 'reports.export',
  'view_journal_entries': 'accounting.view_reports',
  'manage_taxes': 'accounting.manage_taxes',
  'view_financial_data': 'accounting.view',
};

export function hasPermission(
  role: UserRole,
  permission: Permission,
  customPermissions?: Record<string, boolean>
): boolean {
  const mappedPermission = permissionToModuleAction[permission];

  if (customPermissions && mappedPermission) {
    if (mappedPermission in customPermissions) {
      return customPermissions[mappedPermission];
    }
  }

  return rolePermissions[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(
  role: UserRole,
  permissions: Permission[],
  customPermissions?: Record<string, boolean>
): boolean {
  return permissions.some(permission =>
    hasPermission(role, permission, customPermissions)
  );
}

export function hasAllPermissions(
  role: UserRole,
  permissions: Permission[],
  customPermissions?: Record<string, boolean>
): boolean {
  return permissions.every(permission =>
    hasPermission(role, permission, customPermissions)
  );
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    root: 'Root',
    admin: 'Administrador',
    supervisor: 'Supervisor',
    cashier: 'Cajero',
    operator: 'Operador',
    marketing: 'Marketing',
    accountant: 'Contador',
  };
  return labels[role] || role;
}

export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    root: 'bg-red-100 text-red-700',
    admin: 'bg-purple-100 text-purple-700',
    supervisor: 'bg-blue-100 text-blue-700',
    cashier: 'bg-green-100 text-green-700',
    operator: 'bg-yellow-100 text-yellow-700',
    marketing: 'bg-pink-100 text-pink-700',
    accountant: 'bg-gray-100 text-gray-700',
  };
  return colors[role] || 'bg-gray-100 text-gray-700';
}

export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    root: 'Acceso total a todas las empresas y sucursales',
    admin: 'Gestiona su empresa/sucursales, configuración, precios y usuarios',
    supervisor: 'Operaciones del día, caja, cortes y autorización de descuentos',
    cashier: 'Ventas, pagos, facturas, apertura y cierre de caja',
    operator: 'Toma/avance de órdenes, check-in/out, consumo de insumos',
    marketing: 'Campañas, cupones y segmentación de clientes',
    accountant: 'Reportes, pólizas e impuestos',
  };
  return descriptions[role] || '';
}
