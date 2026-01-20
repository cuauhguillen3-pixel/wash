import {
  Home,
  MapPin,
  Wrench,
  Calendar,
  Users,
  UserCog,
  LogOut,
  Menu,
  X,
  Building2,
  DollarSign,
  BarChart3,
  Tag,
  Shield,
  Car,
  FileText,
  Package2,
  Calculator,
  Settings,
  Sun,
  Moon
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getRoleLabel, getRoleColor } from '../../lib/permissions';
import type { Permission } from '../../lib/permissions';
import { supabase } from '../../lib/supabase';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const { profile, signOut, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    async function fetchLogo() {
      if (profile?.company_id) {
        // Primero intentar obtener de company_settings
        const { data: settingsData } = await supabase
          .from('company_settings')
          .select('logo_url')
          .eq('company_id', profile.company_id)
          .maybeSingle();

        if (settingsData?.logo_url) {
          setLogoUrl(settingsData.logo_url);
          return;
        }

        // Si no hay en settings, intentar de la tabla companies
        if ((profile as any)?.company?.logo_url) {
          setLogoUrl((profile as any).company.logo_url);
        }
      }
    }

    fetchLogo();
  }, [profile]);

  interface MenuItem {
    id: string;
    label: string;
    icon: any;
    permission?: Permission;
  }

  const rootMenuItems: MenuItem[] = [
    { id: 'companies', label: 'Empresas', icon: Building2 },
    { id: 'branches', label: 'Sucursales', icon: MapPin },
    { id: 'orders', label: 'Órdenes', icon: FileText },
    { id: 'customers', label: 'Clientes', icon: Users },
    { id: 'vehicles', label: 'Vehículos', icon: Car },
    { id: 'users', label: 'Usuarios', icon: Shield },
    { id: 'inventory', label: 'Inventario', icon: Package2 },
    { id: 'reports', label: 'Reportes', icon: BarChart3 },
  ];

  const regularMenuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'companies', label: 'Empresas', icon: Building2, permission: 'manage_companies' },
    { id: 'branches', label: 'Sucursales', icon: MapPin, permission: 'manage_branches' },
    { id: 'services', label: 'Servicios', icon: Wrench, permission: 'manage_services' },
    { id: 'appointments', label: 'Citas', icon: Calendar, permission: 'view_appointments' },
    { id: 'orders', label: 'Órdenes', icon: FileText, permission: 'view_appointments' },
    { id: 'customers', label: 'Clientes', icon: Users, permission: 'view_customers' },
    { id: 'vehicles', label: 'Vehículos', icon: Car, permission: 'view_customers' },
    { id: 'users', label: 'Usuarios', icon: Shield, permission: 'manage_users' },
    { id: 'staff', label: 'Personal', icon: UserCog, permission: 'manage_users' },
    { id: 'inventory', label: 'Inventario', icon: Package2, permission: 'manage_services' },
    { id: 'accounting', label: 'Contabilidad', icon: Calculator, permission: 'manage_cash_register' },
    { id: 'marketing', label: 'Marketing', icon: Tag, permission: 'create_campaigns' },
    { id: 'reports', label: 'Reportes', icon: BarChart3, permission: 'view_reports' },
    { id: 'configuration', label: 'Configuración', icon: Settings, permission: 'manage_branches' },
  ];

  const filteredItems = profile?.role === 'root'
    ? rootMenuItems
    : regularMenuItems.filter(item => {
        if (!profile) return false;
        if (!item.permission) return true;
        return hasPermission(item.permission);
      });

  const toggleSidebar = () => setIsOpen(!isOpen);

  const handleNavigate = (view: string) => {
    onNavigate(view);
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={toggleSidebar}
        className="lg:hidden fixed top-4 left-4 z-50 bg-white p-2 rounded-lg shadow-lg"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-full flex flex-col">
          <div className="px-0 pt-0 pb-0 border-b border-gray-200 dark:border-gray-700 flex flex-col items-center overflow-hidden">
            <div className="w-full flex justify-center items-center">
              {!logoError ? (
                <img 
                  src={logoUrl || "/logo.png"} 
                  alt="Carwash Suite" 
                  className="w-full h-auto max-h-48 object-cover transition-all duration-300 hover:scale-105"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 w-full">
                  <div className="w-20 h-20 rounded-full border-2 border-blue-900 dark:border-blue-400 flex items-center justify-center bg-white dark:bg-gray-800 shrink-0 shadow-lg">
                    <Car className="w-10 h-10 text-blue-900 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col items-center w-full">
                    <span className="text-3xl font-bold text-blue-900 dark:text-white leading-none tracking-tight">Carwash</span>
                    <span className="text-2xl font-semibold text-blue-700 dark:text-blue-400 leading-none tracking-wide">Suite</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="w-full group px-2 pb-2 pt-0 -mt-6 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors relative z-10">
              <button
                onClick={() => handleNavigate('profile')}
                className="w-full flex items-center gap-3 text-left focus:outline-none"
                title="Ver mi perfil"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg flex-shrink-0">
                  {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {profile?.full_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {profile ? getRoleLabel(profile.role) : ''}
                  </p>
                </div>
              </button>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {filteredItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-all duration-200 font-medium
                    ${isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 font-medium mb-2"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              <span>{theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}</span>
            </button>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 font-medium"
            >
              <LogOut className="w-5 h-5" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={toggleSidebar}
        />
      )}
    </>
  );
}
