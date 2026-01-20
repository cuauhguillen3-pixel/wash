import { useEffect, useState } from 'react';
import { Calendar, DollarSign, Users, Wrench, TrendingUp, Clock, Building2, Package, ShoppingCart, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Stats {
  todayOrders: number;
  pendingOrders: number;
  totalCustomers: number;
  todayRevenue: number;
  inProgressOrders: number;
  growthPercentage: number;
}

interface RootStats {
  totalCompanies: number;
  activeCompanies: number;
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  totalProducts: number;
  todayOrders: number;
  monthRevenue: number;
}

export function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({
    todayOrders: 0,
    pendingOrders: 0,
    totalCustomers: 0,
    todayRevenue: 0,
    inProgressOrders: 0,
    growthPercentage: 0,
  });
  const [rootStats, setRootStats] = useState<RootStats>({
    totalCompanies: 0,
    activeCompanies: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalCustomers: 0,
    totalProducts: 0,
    todayOrders: 0,
    monthRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  const isRoot = profile?.role === 'root';

  useEffect(() => {
    if (!isRoot) {
      loadStats();
    } else {
      loadRootStats();
    }
  }, [profile, isRoot]);

  const loadStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      let ordersQuery = supabase
        .from('service_orders')
        .select('*');

      if (profile?.role !== 'root' && profile?.company_id) {
        ordersQuery = ordersQuery.eq('company_id', profile.company_id);
      }

      if (profile?.branch_id) {
        ordersQuery = ordersQuery.eq('branch_id', profile.branch_id);
      }

      const { data: todayOrders, error: todayError } = await ordersQuery
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      if (todayError) throw todayError;

      let pendingQuery = supabase
        .from('service_orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (profile?.company_id) {
        pendingQuery = pendingQuery.eq('company_id', profile.company_id);
      }

      const { count: pendingCount } = await pendingQuery;

      let inProgressQuery = supabase
        .from('service_orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'in_progress');

      if (profile?.company_id) {
        inProgressQuery = inProgressQuery.eq('company_id', profile.company_id);
      }

      const { count: inProgressCount } = await inProgressQuery;

      let customersQuery = supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });

      if (profile?.company_id) {
        customersQuery = customersQuery.eq('company_id', profile.company_id);
      }

      const { count: customersCount } = await customersQuery;

      const todayRevenue = todayOrders
        ?.filter(order => order.payment_status === 'pagado' || order.payment_status === 'parcial')
        .reduce((sum, order) => sum + Number(order.total || 0), 0) || 0;

      let lastMonthQuery = supabase
        .from('service_orders')
        .select('total, payment_status')
        .in('payment_status', ['pagado', 'parcial'])
        .gte('created_at', lastMonth.toISOString())
        .lt('created_at', today.toISOString());

      if (profile?.company_id) {
        lastMonthQuery = lastMonthQuery.eq('company_id', profile.company_id);
      }

      const { data: lastMonthOrders } = await lastMonthQuery;

      const lastMonthRevenue = lastMonthOrders
        ?.reduce((sum, order) => sum + Number(order.total || 0), 0) || 0;

      const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      let currentMonthQuery = supabase
        .from('service_orders')
        .select('total, payment_status');

      if (profile?.company_id) {
        currentMonthQuery = currentMonthQuery.eq('company_id', profile.company_id);
      }

      const { data: currentMonthOrders } = await currentMonthQuery
        .in('payment_status', ['pagado', 'parcial'])
        .gte('created_at', currentMonthStart.toISOString());

      const currentMonthRevenue = currentMonthOrders
        ?.reduce((sum, order) => sum + Number(order.total || 0), 0) || 0;

      const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 1);
      let previousMonthQuery = supabase
        .from('service_orders')
        .select('total, payment_status')
        .in('payment_status', ['pagado', 'parcial'])
        .gte('created_at', previousMonthStart.toISOString())
        .lt('created_at', previousMonthEnd.toISOString());

      if (profile?.company_id) {
        previousMonthQuery = previousMonthQuery.eq('company_id', profile.company_id);
      }

      const { data: previousMonthOrders } = await previousMonthQuery;

      const previousMonthRevenue = previousMonthOrders
        ?.reduce((sum, order) => sum + Number(order.total || 0), 0) || 0;

      const growthPercentage = previousMonthRevenue > 0
        ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
        : currentMonthRevenue > 0 ? 100 : 0;

      setStats({
        todayOrders: todayOrders?.length || 0,
        pendingOrders: pendingCount || 0,
        totalCustomers: customersCount || 0,
        todayRevenue,
        inProgressOrders: inProgressCount || 0,
        growthPercentage: Math.round(growthPercentage),
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRootStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      // Total de empresas
      const { count: totalCompanies } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true });

      // Empresas activas
      const { count: activeCompanies } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Total de órdenes
      const { count: totalOrders } = await supabase
        .from('service_orders')
        .select('*', { count: 'exact', head: true });

      // Órdenes de hoy
      const { count: todayOrders } = await supabase
        .from('service_orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      // Total de clientes
      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });

      // Total de productos en inventario
      const { count: totalProducts } = await supabase
        .from('inventory_products')
        .select('*', { count: 'exact', head: true });

      // Ingresos totales (todas las órdenes pagadas)
      const { data: allOrders } = await supabase
        .from('service_orders')
        .select('total, payment_status')
        .in('payment_status', ['pagado', 'parcial']);

      const totalRevenue = allOrders
        ?.reduce((sum, order) => sum + Number(order.total || 0), 0) || 0;

      // Ingresos del mes actual
      const { data: monthOrders } = await supabase
        .from('service_orders')
        .select('total, payment_status')
        .in('payment_status', ['pagado', 'parcial'])
        .gte('created_at', currentMonthStart.toISOString());

      const monthRevenue = monthOrders
        ?.reduce((sum, order) => sum + Number(order.total || 0), 0) || 0;

      setRootStats({
        totalCompanies: totalCompanies || 0,
        activeCompanies: activeCompanies || 0,
        totalOrders: totalOrders || 0,
        totalRevenue,
        totalCustomers: totalCustomers || 0,
        totalProducts: totalProducts || 0,
        todayOrders: todayOrders || 0,
        monthRevenue,
      });
    } catch (error) {
      console.error('Error loading root stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Citas Hoy',
      value: stats.todayOrders,
      icon: Calendar,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'En Progreso',
      value: stats.inProgressOrders,
      icon: Clock,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
    },
    {
      label: 'Pendientes',
      value: stats.pendingOrders,
      icon: Wrench,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
    },
    {
      label: 'Clientes',
      value: stats.totalCustomers,
      icon: Users,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Ingresos Hoy',
      value: `$${stats.todayRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Crecimiento',
      value: `${stats.growthPercentage >= 0 ? '+' : ''}${stats.growthPercentage}%`,
      icon: TrendingUp,
      color: stats.growthPercentage >= 0 ? 'bg-purple-500' : 'bg-red-500',
      bgColor: stats.growthPercentage >= 0 ? 'bg-purple-50' : 'bg-red-50',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isRoot) {
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
      }).format(amount);
    };

    const rootStatCards = [
      {
        label: 'Total Empresas',
        value: rootStats.totalCompanies,
        subtitle: `${rootStats.activeCompanies} activas`,
        icon: Building2,
        color: 'bg-blue-500',
        bgColor: 'bg-blue-50',
      },
      {
        label: 'Órdenes de Servicio',
        value: rootStats.totalOrders,
        subtitle: `${rootStats.todayOrders} hoy`,
        icon: ShoppingCart,
        color: 'bg-purple-500',
        bgColor: 'bg-purple-50',
      },
      {
        label: 'Ingresos Totales',
        value: formatCurrency(rootStats.totalRevenue),
        subtitle: `${formatCurrency(rootStats.monthRevenue)} este mes`,
        icon: DollarSign,
        color: 'bg-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
      },
      {
        label: 'Clientes Totales',
        value: rootStats.totalCustomers,
        subtitle: `${rootStats.totalProducts} productos`,
        icon: Users,
        color: 'bg-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      },
    ];

    return (
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Panel de Administración Root</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Vista general de todas las empresas del sistema</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rootStatCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`${card.bgColor} p-3 rounded-xl`}>
                    <Icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{card.value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{card.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg p-8 text-white">
          <h3 className="text-2xl font-bold mb-4">Acceso de Administrador del Sistema</h3>
          <p className="text-blue-100 mb-6">
            Como usuario root, tienes acceso completo a todas las funcionalidades de gestión del sistema.
            Utiliza las opciones del menú lateral para administrar empresas, consultar información y gestionar suscripciones.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="bg-blue-800 bg-opacity-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Gestión de Empresas</h4>
              <p className="text-sm text-blue-100">Administra empresas, activa/desactiva cuentas y gestiona suscripciones.</p>
            </div>
            <div className="bg-blue-800 bg-opacity-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Consulta de Información</h4>
              <p className="text-sm text-blue-100">Visualiza datos de todas las empresas filtradas por organización.</p>
            </div>
            <div className="bg-blue-800 bg-opacity-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Control de Suscripciones</h4>
              <p className="text-sm text-blue-100">Gestiona tipos de suscripción: anual, mensual o indeterminado.</p>
            </div>
            <div className="bg-blue-800 bg-opacity-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Reportes Globales</h4>
              <p className="text-sm text-blue-100">Accede a reportes consolidados de todas las empresas del sistema.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Resumen de actividades y métricas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{card.value}</p>
                </div>
                <div className={`${card.bgColor} p-3 rounded-xl`}>
                  <Icon className={`w-6 h-6 text-white ${card.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg p-8 text-white">
        <h3 className="text-2xl font-bold mb-2">Bienvenido, {profile?.full_name}</h3>
        <p className="text-blue-100">
          Sistema de gestión para autolavados. Administra sucursales, servicios, citas y clientes desde un solo lugar.
        </p>
      </div>
    </div>
  );
}
