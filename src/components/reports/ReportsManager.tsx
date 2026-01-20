import { useState, useEffect } from 'react';
import {
  BarChart3,
  DollarSign,
  Users,
  MapPin,
  Wallet,
  FileText,
  Package,
  TrendingUp,
  Calendar,
  Download,
  Search
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CompanyFilter } from '../shared/CompanyFilter';

type ReportType = 'sales' | 'customers' | 'branches' | 'wallets' | 'invoices' | 'inventory' | 'high-cost';

interface DateRange {
  start: string;
  end: string;
}

interface SalesReport {
  total_orders: number;
  total_sales: number;
  total_discount: number;
  average_ticket: number;
  by_payment_method: { method: string; count: number; total: number }[];
  by_status: { status: string; count: number; total: number }[];
  daily_sales: { date: string; orders: number; total: number }[];
}

interface CustomerReport {
  customer_id: string;
  full_name: string;
  email: string;
  phone: string;
  total_orders: number;
  total_spent: number;
  average_order: number;
  last_order_date: string;
}

interface BranchReport {
  branch_id: string;
  branch_name: string;
  total_orders: number;
  total_sales: number;
  average_ticket: number;
  top_service: string;
}

interface WalletReport {
  customer_id: string;
  full_name: string;
  email: string;
  balance: number;
  total_deposits: number;
  total_redemptions: number;
  transaction_count: number;
}

interface InvoiceReport {
  order_id: string;
  ticket_number: string;
  customer_name: string;
  rfc: string;
  razon_social: string;
  order_total: number;
  status: string;
  requested_at: string;
}

interface InventoryReport {
  product_id: string;
  name: string;
  category: string;
  current_stock: number;
  unit_cost: number;
  total_value: number;
  supplier: string;
}

export function ReportsManager() {
  const { profile } = useAuth();
  const [activeReport, setActiveReport] = useState<ReportType>('sales');
  const [loading, setLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  const isRoot = profile?.role === 'root';

  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [customerReports, setCustomerReports] = useState<CustomerReport[]>([]);
  const [branchReports, setBranchReports] = useState<BranchReport[]>([]);
  const [walletReports, setWalletReports] = useState<WalletReport[]>([]);
  const [invoiceReports, setInvoiceReports] = useState<InvoiceReport[]>([]);
  const [inventoryReports, setInventoryReports] = useState<InventoryReport[]>([]);
  const [highCostItems, setHighCostItems] = useState<InventoryReport[]>([]);

  useEffect(() => {
    loadReport();
  }, [activeReport, dateRange, selectedCompany]);

  const loadReport = async () => {
    setLoading(true);
    try {
      switch (activeReport) {
        case 'sales':
          await loadSalesReport();
          break;
        case 'customers':
          await loadCustomerReports();
          break;
        case 'branches':
          await loadBranchReports();
          break;
        case 'wallets':
          await loadWalletReports();
          break;
        case 'invoices':
          await loadInvoiceReports();
          break;
        case 'inventory':
          await loadInventoryReports();
          break;
        case 'high-cost':
          await loadHighCostItems();
          break;
      }
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSalesReport = async () => {
    const companyFilter = isRoot
      ? (selectedCompany ? { company_id: selectedCompany } : {})
      : { company_id: profile?.company_id };

    const { data: orders, error } = await supabase
      .from('service_orders')
      .select('*')
      .match(companyFilter)
      .gte('created_at', `${dateRange.start}T00:00:00`)
      .lte('created_at', `${dateRange.end}T23:59:59`);

    if (error) throw error;

    if (orders) {
      const totalOrders = orders.length;
      const totalSales = orders.reduce((sum, o) => sum + (o.total || 0), 0);
      const totalDiscount = orders.reduce((sum, o) => sum + (o.discount_amount || 0), 0);
      const averageTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

      const byPaymentMethod = orders.reduce((acc, o) => {
        const method = o.payment_method || 'No especificado';
        const existing = acc.find(x => x.method === method);
        if (existing) {
          existing.count++;
          existing.total += o.total || 0;
        } else {
          acc.push({ method, count: 1, total: o.total || 0 });
        }
        return acc;
      }, [] as { method: string; count: number; total: number }[]);

      const byStatus = orders.reduce((acc, o) => {
        const status = o.status || 'pendiente';
        const existing = acc.find(x => x.status === status);
        if (existing) {
          existing.count++;
          existing.total += o.total || 0;
        } else {
          acc.push({ status, count: 1, total: o.total || 0 });
        }
        return acc;
      }, [] as { status: string; count: number; total: number }[]);

      const dailySales = orders.reduce((acc, o) => {
        const date = new Date(o.created_at).toLocaleDateString('es-MX');
        const existing = acc.find(x => x.date === date);
        if (existing) {
          existing.orders++;
          existing.total += o.total || 0;
        } else {
          acc.push({ date, orders: 1, total: o.total || 0 });
        }
        return acc;
      }, [] as { date: string; orders: number; total: number }[]);

      setSalesReport({
        total_orders: totalOrders,
        total_sales: totalSales,
        total_discount: totalDiscount,
        average_ticket: averageTicket,
        by_payment_method: byPaymentMethod,
        by_status: byStatus,
        daily_sales: dailySales.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      });
    }
  };

  const loadCustomerReports = async () => {
    const companyFilter = isRoot
      ? (selectedCompany ? { company_id: selectedCompany } : {})
      : { company_id: profile?.company_id };

    const { data: orders, error } = await supabase
      .from('service_orders')
      .select(`
        *,
        customer:customers(id, full_name, email, phone)
      `)
      .match(companyFilter)
      .gte('created_at', `${dateRange.start}T00:00:00`)
      .lte('created_at', `${dateRange.end}T23:59:59`);

    if (error) throw error;

    if (orders) {
      const customerMap = orders.reduce((acc, o) => {
        const customerId = o.customer_id;
        if (!customerId || !o.customer) return acc;

        if (!acc[customerId]) {
          acc[customerId] = {
            customer_id: customerId,
            full_name: o.customer.full_name,
            email: o.customer.email || '',
            phone: o.customer.phone || '',
            total_orders: 0,
            total_spent: 0,
            last_order_date: o.created_at,
          };
        }

        acc[customerId].total_orders++;
        acc[customerId].total_spent += o.total || 0;
        if (new Date(o.created_at) > new Date(acc[customerId].last_order_date)) {
          acc[customerId].last_order_date = o.created_at;
        }

        return acc;
      }, {} as Record<string, any>);

      const reports = Object.values(customerMap).map((c: any) => ({
        ...c,
        average_order: c.total_orders > 0 ? c.total_spent / c.total_orders : 0,
      }));

      setCustomerReports(reports.sort((a, b) => b.total_spent - a.total_spent));
    }
  };

  const loadBranchReports = async () => {
    const companyFilter = isRoot
      ? (selectedCompany ? { company_id: selectedCompany } : {})
      : { company_id: profile?.company_id };

    const { data: orders, error } = await supabase
      .from('service_orders')
      .select(`
        *,
        branch:branches(id, name),
        items:order_items(*)
      `)
      .match(companyFilter)
      .gte('created_at', `${dateRange.start}T00:00:00`)
      .lte('created_at', `${dateRange.end}T23:59:59`);

    if (error) throw error;

    if (orders) {
      const branchMap = orders.reduce((acc, o) => {
        const branchId = o.branch_id;
        if (!branchId || !o.branch) return acc;

        if (!acc[branchId]) {
          acc[branchId] = {
            branch_id: branchId,
            branch_name: o.branch.name,
            total_orders: 0,
            total_sales: 0,
            services: {} as Record<string, number>,
          };
        }

        acc[branchId].total_orders++;
        acc[branchId].total_sales += o.total || 0;

        o.items?.forEach((item: any) => {
          const serviceName = item.name;
          acc[branchId].services[serviceName] = (acc[branchId].services[serviceName] || 0) + item.quantity;
        });

        return acc;
      }, {} as Record<string, any>);

      const reports = Object.values(branchMap).map((b: any) => {
        const topService = Object.entries(b.services).sort(([, a]: any, [, b]: any) => b - a)[0];
        return {
          branch_id: b.branch_id,
          branch_name: b.branch_name,
          total_orders: b.total_orders,
          total_sales: b.total_sales,
          average_ticket: b.total_orders > 0 ? b.total_sales / b.total_orders : 0,
          top_service: topService ? topService[0] : 'N/A',
        };
      });

      setBranchReports(reports.sort((a, b) => b.total_sales - a.total_sales));
    }
  };

  const loadWalletReports = async () => {
    const companyFilter = isRoot
      ? (selectedCompany ? { company_id: selectedCompany } : {})
      : { company_id: profile?.company_id };

    const { data: wallets, error } = await supabase
      .from('loyalty_wallets')
      .select(`
        *,
        customer:customers(full_name, email),
        transactions:wallet_transactions(type, amount)
      `)
      .match(companyFilter);

    if (error) throw error;

    if (wallets) {
      const reports = wallets.map((w: any) => {
        const deposits = w.transactions?.filter((t: any) => t.type === 'deposit')
          .reduce((sum: number, t: any) => sum + t.amount, 0) || 0;
        const redemptions = w.transactions?.filter((t: any) => t.type === 'redemption')
          .reduce((sum: number, t: any) => sum + t.amount, 0) || 0;

        return {
          customer_id: w.customer_id,
          full_name: w.customer?.full_name || 'N/A',
          email: w.customer?.email || 'N/A',
          balance: w.balance || 0,
          total_deposits: deposits,
          total_redemptions: redemptions,
          transaction_count: w.transactions?.length || 0,
        };
      });

      setWalletReports(reports.sort((a, b) => b.balance - a.balance));
    }
  };

  const loadInvoiceReports = async () => {
    const companyFilter = isRoot
      ? (selectedCompany ? { company_id: selectedCompany } : {})
      : { company_id: profile?.company_id };

    const { data: invoices, error } = await supabase
      .from('invoice_requests')
      .select(`
        *,
        order:service_orders(ticket_number, total, company_id),
        customer:customers(full_name)
      `)
      .gte('requested_at', `${dateRange.start}T00:00:00`)
      .lte('requested_at', `${dateRange.end}T23:59:59`);

    if (error) throw error;

    if (invoices) {
      const filtered = invoices.filter((inv: any) => {
        if (profile?.role === 'root') return true;
        return inv.order?.company_id === profile?.company_id;
      });

      const reports = filtered.map((inv: any) => ({
        order_id: inv.order_id,
        ticket_number: inv.order?.ticket_number || 'N/A',
        customer_name: inv.customer?.full_name || 'N/A',
        rfc: inv.rfc,
        razon_social: inv.razon_social,
        order_total: inv.order?.total || 0,
        status: inv.status,
        requested_at: inv.requested_at,
      }));

      setInvoiceReports(reports.sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()));
    }
  };

  const loadInventoryReports = async () => {
    const companyFilter = isRoot
      ? (selectedCompany ? { company_id: selectedCompany } : {})
      : { company_id: profile?.company_id };

    const { data: inventory, error } = await supabase
      .from('inventory_products')
      .select('*')
      .match(companyFilter);

    if (error) throw error;

    if (inventory) {
      const reports = inventory.map((item: any) => ({
        product_id: item.id,
        name: item.name,
        category: item.category || 'Sin categoría',
        current_stock: item.current_stock || 0,
        unit_cost: item.unit_cost || 0,
        total_value: (item.current_stock || 0) * (item.unit_cost || 0),
        supplier: item.supplier || 'N/A',
      }));

      setInventoryReports(reports.sort((a, b) => b.total_value - a.total_value));
    }
  };

  const loadHighCostItems = async () => {
    const companyFilter = isRoot
      ? (selectedCompany ? { company_id: selectedCompany } : {})
      : { company_id: profile?.company_id };

    const { data: inventory, error } = await supabase
      .from('inventory_products')
      .select('*')
      .match(companyFilter);

    if (error) throw error;

    if (inventory) {
      const reports = inventory
        .map((item: any) => ({
          product_id: item.id,
          name: item.name,
          category: item.category || 'Sin categoría',
          current_stock: item.current_stock || 0,
          unit_cost: item.unit_cost || 0,
          total_value: (item.current_stock || 0) * (item.unit_cost || 0),
          supplier: item.supplier || 'N/A',
        }))
        .filter((item) => item.unit_cost > 0)
        .sort((a, b) => b.unit_cost - a.unit_cost)
        .slice(0, 50);

      setHighCostItems(reports);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const exportToCSV = () => {
    let csvContent = '';
    let filename = '';

    switch (activeReport) {
      case 'sales':
        if (salesReport) {
          csvContent = 'Reporte de Ventas\n\n';
          csvContent += `Total de Órdenes,${salesReport.total_orders}\n`;
          csvContent += `Total de Ventas,${salesReport.total_sales}\n`;
          csvContent += `Total de Descuentos,${salesReport.total_discount}\n`;
          csvContent += `Ticket Promedio,${salesReport.average_ticket}\n\n`;
          csvContent += 'Ventas por Día\n';
          csvContent += 'Fecha,Órdenes,Total\n';
          salesReport.daily_sales.forEach(d => {
            csvContent += `${d.date},${d.orders},${d.total}\n`;
          });
          filename = 'reporte-ventas.csv';
        }
        break;
      case 'customers':
        csvContent = 'Cliente,Email,Teléfono,Órdenes,Total Gastado,Promedio,Última Orden\n';
        customerReports.forEach(c => {
          csvContent += `${c.full_name},${c.email},${c.phone},${c.total_orders},${c.total_spent},${c.average_order},${c.last_order_date}\n`;
        });
        filename = 'reporte-clientes.csv';
        break;
      case 'branches':
        csvContent = 'Sucursal,Órdenes,Ventas,Ticket Promedio,Servicio Principal\n';
        branchReports.forEach(b => {
          csvContent += `${b.branch_name},${b.total_orders},${b.total_sales},${b.average_ticket},${b.top_service}\n`;
        });
        filename = 'reporte-sucursales.csv';
        break;
      case 'wallets':
        csvContent = 'Cliente,Email,Balance,Depósitos,Canjes,Transacciones\n';
        walletReports.forEach(w => {
          csvContent += `${w.full_name},${w.email},${w.balance},${w.total_deposits},${w.total_redemptions},${w.transaction_count}\n`;
        });
        filename = 'reporte-monederos.csv';
        break;
      case 'invoices':
        csvContent = 'Ticket,Cliente,RFC,Razón Social,Total,Estado,Fecha\n';
        invoiceReports.forEach(i => {
          csvContent += `${i.ticket_number},${i.customer_name},${i.rfc},${i.razon_social},${i.order_total},${i.status},${i.requested_at}\n`;
        });
        filename = 'reporte-facturas.csv';
        break;
      case 'inventory':
        csvContent = 'Producto,Categoría,Stock,Costo Unitario,Valor Total,Proveedor\n';
        inventoryReports.forEach(i => {
          csvContent += `${i.name},${i.category},${i.current_stock},${i.unit_cost},${i.total_value},${i.supplier}\n`;
        });
        filename = 'reporte-inventario.csv';
        break;
      case 'high-cost':
        csvContent = 'Producto,Categoría,Stock,Costo Unitario,Valor Total,Proveedor\n';
        highCostItems.forEach(i => {
          csvContent += `${i.name},${i.category},${i.current_stock},${i.unit_cost},${i.total_value},${i.supplier}\n`;
        });
        filename = 'reporte-altos-costos.csv';
        break;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const reportTypes = [
    { id: 'sales', label: 'Ventas', icon: DollarSign },
    { id: 'customers', label: 'Clientes', icon: Users },
    { id: 'branches', label: 'Sucursales', icon: MapPin },
    { id: 'wallets', label: 'Monederos', icon: Wallet },
    { id: 'invoices', label: 'Facturas', icon: FileText },
    { id: 'inventory', label: 'Inventario', icon: Package },
    { id: 'high-cost', label: 'Altos Costos', icon: TrendingUp },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Reportes</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Análisis y reportes del sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {reportTypes.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => setActiveReport(type.id as ReportType)}
              className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                activeReport === type.id
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-500'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700 dark:border-gray-700 dark:hover:border-gray-600 dark:text-gray-300'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-sm font-medium">{type.label}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {isRoot && (
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Empresa
              </label>
              <CompanyFilter value={selectedCompany} onChange={setSelectedCompany} />
            </div>
          )}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Fecha Inicio
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Fecha Fin
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={loadReport}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Consultar
            </button>
          </div>
          <div className="flex items-end">
            <button
              onClick={exportToCSV}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {activeReport === 'sales' && salesReport && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Órdenes</div>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">{salesReport.total_orders}</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="text-sm text-green-600 dark:text-green-400 font-medium">Total Ventas</div>
                    <div className="text-2xl font-bold text-green-900 dark:text-green-300">{formatCurrency(salesReport.total_sales)}</div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">Descuentos</div>
                    <div className="text-2xl font-bold text-orange-900 dark:text-orange-300">{formatCurrency(salesReport.total_discount)}</div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">Ticket Promedio</div>
                    <div className="text-2xl font-bold text-purple-900 dark:text-purple-300">{formatCurrency(salesReport.average_ticket)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Por Método de Pago</h3>
                    <div className="space-y-2">
                      {salesReport.by_payment_method.map((m, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                          <span className="font-medium text-gray-900 dark:text-white">{m.method}</span>
                          <div className="text-right">
                            <div className="text-sm text-gray-600 dark:text-gray-400">{m.count} órdenes</div>
                            <div className="font-semibold text-gray-900 dark:text-white">{formatCurrency(m.total)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Por Estado</h3>
                    <div className="space-y-2">
                      {salesReport.by_status.map((s, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                          <span className="font-medium capitalize text-gray-900 dark:text-white">{s.status}</span>
                          <div className="text-right">
                            <div className="text-sm text-gray-600 dark:text-gray-400">{s.count} órdenes</div>
                            <div className="font-semibold text-gray-900 dark:text-white">{formatCurrency(s.total)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Ventas Diarias</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-300">Fecha</th>
                          <th className="px-4 py-2 text-right text-gray-900 dark:text-gray-300">Órdenes</th>
                          <th className="px-4 py-2 text-right text-gray-900 dark:text-gray-300">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {salesReport.daily_sales.map((d, i) => (
                          <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                            <td className="px-4 py-2 text-gray-900 dark:text-gray-300">{d.date}</td>
                            <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-300">{d.orders}</td>
                            <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(d.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeReport === 'customers' && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Clientes por Monto de Venta</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-300">Cliente</th>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-300">Email</th>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-300">Teléfono</th>
                        <th className="px-4 py-2 text-right text-gray-900 dark:text-gray-300">Órdenes</th>
                        <th className="px-4 py-2 text-right text-gray-900 dark:text-gray-300">Total Gastado</th>
                        <th className="px-4 py-2 text-right text-gray-900 dark:text-gray-300">Promedio</th>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-300">Última Orden</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {customerReports.map((c, i) => (
                        <tr key={i} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{c.full_name}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{c.email}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{c.phone}</td>
                          <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{c.total_orders}</td>
                          <td className="px-4 py-2 text-right font-semibold text-green-600 dark:text-green-400">{formatCurrency(c.total_spent)}</td>
                          <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{formatCurrency(c.average_order)}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{new Date(c.last_order_date).toLocaleDateString('es-MX')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeReport === 'branches' && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Ventas por Sucursal</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-300">Sucursal</th>
                        <th className="px-4 py-2 text-right text-gray-900 dark:text-gray-300">Órdenes</th>
                        <th className="px-4 py-2 text-right text-gray-900 dark:text-gray-300">Ventas</th>
                        <th className="px-4 py-2 text-right text-gray-900 dark:text-gray-300">Ticket Promedio</th>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-300">Servicio Principal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {branchReports.map((b, i) => (
                        <tr key={i} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{b.branch_name}</td>
                          <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{b.total_orders}</td>
                          <td className="px-4 py-2 text-right font-semibold text-green-600 dark:text-green-400">{formatCurrency(b.total_sales)}</td>
                          <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{formatCurrency(b.average_ticket)}</td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{b.top_service}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeReport === 'wallets' && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Monederos de Lealtad</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-300">Cliente</th>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-300">Email</th>
                        <th className="px-4 py-2 text-right text-gray-900 dark:text-gray-300">Balance</th>
                        <th className="px-4 py-2 text-right text-gray-900 dark:text-gray-300">Total Depósitos</th>
                        <th className="px-4 py-2 text-right text-gray-900 dark:text-gray-300">Total Canjes</th>
                        <th className="px-4 py-2 text-right text-gray-900 dark:text-gray-300">Transacciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {walletReports.map((w, i) => (
                        <tr key={i} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{w.full_name}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{w.email}</td>
                          <td className="px-4 py-2 text-right font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(w.balance)}</td>
                          <td className="px-4 py-2 text-right text-green-600 dark:text-green-400">{formatCurrency(w.total_deposits)}</td>
                          <td className="px-4 py-2 text-right text-orange-600 dark:text-orange-400">{formatCurrency(w.total_redemptions)}</td>
                          <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{w.transaction_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeReport === 'invoices' && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Solicitudes de Factura</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-300">Ticket</th>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-300">Cliente</th>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-300">RFC</th>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-300">Razón Social</th>
                        <th className="px-4 py-2 text-right text-gray-900 dark:text-gray-300">Total</th>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-300">Estado</th>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-300">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {invoiceReports.map((inv, i) => (
                        <tr key={i} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{inv.ticket_number}</td>
                          <td className="px-4 py-2 text-gray-900 dark:text-white">{inv.customer_name}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{inv.rfc}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{inv.razon_social}</td>
                          <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(inv.order_total)}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              inv.status === 'completada' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              inv.status === 'pendiente' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{new Date(inv.requested_at).toLocaleDateString('es-MX')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeReport === 'inventory' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Valor del Inventario</h3>
                <div className="mb-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-600 font-medium">Valor Total del Inventario</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {formatCurrency(inventoryReports.reduce((sum, i) => sum + i.total_value, 0))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Producto</th>
                        <th className="px-4 py-2 text-left">Categoría</th>
                        <th className="px-4 py-2 text-right">Stock</th>
                        <th className="px-4 py-2 text-right">Costo Unitario</th>
                        <th className="px-4 py-2 text-right">Valor Total</th>
                        <th className="px-4 py-2 text-left">Proveedor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryReports.map((item, i) => (
                        <tr key={i} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">{item.name}</td>
                          <td className="px-4 py-2 text-sm">{item.category}</td>
                          <td className="px-4 py-2 text-right">{item.current_stock}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(item.unit_cost)}</td>
                          <td className="px-4 py-2 text-right font-semibold text-green-600">{formatCurrency(item.total_value)}</td>
                          <td className="px-4 py-2 text-sm">{item.supplier}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeReport === 'high-cost' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Productos de Alto Costo</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Producto</th>
                        <th className="px-4 py-2 text-left">Categoría</th>
                        <th className="px-4 py-2 text-right">Stock</th>
                        <th className="px-4 py-2 text-right">Costo Unitario</th>
                        <th className="px-4 py-2 text-right">Valor Total</th>
                        <th className="px-4 py-2 text-left">Proveedor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {highCostItems.map((item, i) => (
                        <tr key={i} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">{item.name}</td>
                          <td className="px-4 py-2 text-sm">{item.category}</td>
                          <td className="px-4 py-2 text-right">{item.current_stock}</td>
                          <td className="px-4 py-2 text-right font-semibold text-red-600">{formatCurrency(item.unit_cost)}</td>
                          <td className="px-4 py-2 text-right font-semibold text-green-600">{formatCurrency(item.total_value)}</td>
                          <td className="px-4 py-2 text-sm">{item.supplier}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
