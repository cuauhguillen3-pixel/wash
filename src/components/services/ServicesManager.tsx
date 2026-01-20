import { useEffect, useState } from 'react';
import { Plus, CreditCard as Edit2, Wrench, Clock, DollarSign, CheckCircle, XCircle, Search, Download, Package, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../lib/database.types';

type Service = Database['public']['Tables']['services']['Row'];
type ServiceInsert = Database['public']['Tables']['services']['Insert'];
type ServicePackage = Database['public']['Tables']['service_packages']['Row'];
type PackageService = Database['public']['Tables']['package_services']['Row'];

interface PackageWithServices extends ServicePackage {
  services?: Array<PackageService & { service: Service }>;
}

type ViewMode = 'services' | 'packages';

export function ServicesManager() {
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('services');
  const [services, setServices] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [packages, setPackages] = useState<PackageWithServices[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<PackageWithServices[]>([]);
  const [loading, setLoading] = useState(true);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingPackage, setEditingPackage] = useState<ServicePackage | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  const isRoot = profile?.role === 'root';
  const canEdit = !isRoot;

  const [serviceFormData, setServiceFormData] = useState<Partial<ServiceInsert>>({
    name: '',
    description: '',
    base_price: 0,
    duration_minutes: 30,
    is_active: true,
  });

  const [packageFormData, setPackageFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration_minutes: '',
    is_combo: true,
    selectedServices: [] as Array<{ service_id: string; quantity: number }>,
  });

  useEffect(() => {
    loadData();
  }, [profile]);

  useEffect(() => {
    filterServices();
  }, [services, searchTerm]);

  useEffect(() => {
    filterPackages();
  }, [packages, searchTerm]);

  const loadData = async () => {
    try {
      await Promise.all([loadServices(), loadPackages()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterServices = () => {
    if (!searchTerm) {
      setFilteredServices(services);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = services.filter(svc =>
      svc.name.toLowerCase().includes(term) ||
      svc.description?.toLowerCase().includes(term)
    );
    setFilteredServices(filtered);
  };

  const filterPackages = () => {
    if (!searchTerm) {
      setFilteredPackages(packages);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = packages.filter(pkg =>
      pkg.name.toLowerCase().includes(term) ||
      pkg.description?.toLowerCase().includes(term)
    );
    setFilteredPackages(filtered);
  };

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('company_id', profile?.company_id!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  const loadPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('service_packages')
        .select(`
          *,
          services:package_services(
            *,
            service:services(*)
          )
        `)
        .eq('company_id', profile?.company_id!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPackages(data as PackageWithServices[] || []);
    } catch (error) {
      console.error('Error loading packages:', error);
    }
  };

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!canEdit) return;

    try {
      if (editingService) {
        const { error } = await supabase
          .from('services')
          .update(serviceFormData)
          .eq('id', editingService.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('services')
          .insert({
            ...serviceFormData,
            company_id: profile?.company_id!,
          } as ServiceInsert);

        if (error) throw error;
      }

      setShowServiceForm(false);
      setEditingService(null);
      resetServiceForm();
      loadServices();
    } catch (error: any) {
      console.error('Error saving service:', error);
      setError(error.message || 'Error al guardar el servicio');
    }
  };

  const handlePackageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!canEdit) return;

    if (packageFormData.selectedServices.length === 0) {
      setError('Debes agregar al menos un servicio al paquete');
      return;
    }

    try {
      if (editingPackage) {
        const { error: updateError } = await supabase
          .from('service_packages')
          .update({
            name: packageFormData.name,
            description: packageFormData.description || null,
            price: parseFloat(packageFormData.price),
            duration_minutes: parseInt(packageFormData.duration_minutes) || 0,
            is_combo: packageFormData.is_combo,
          })
          .eq('id', editingPackage.id);

        if (updateError) throw updateError;

        const { error: deleteError } = await supabase
          .from('package_services')
          .delete()
          .eq('package_id', editingPackage.id);

        if (deleteError) throw deleteError;

        const packageServices = packageFormData.selectedServices.map(item => ({
          package_id: editingPackage.id,
          service_id: item.service_id,
          quantity: item.quantity,
        }));

        const { error: insertError } = await supabase
          .from('package_services')
          .insert(packageServices);

        if (insertError) throw insertError;
      } else {
        const { data: packageData, error: packageError } = await supabase
          .from('service_packages')
          .insert({
            company_id: profile?.company_id!,
            name: packageFormData.name,
            description: packageFormData.description || null,
            price: parseFloat(packageFormData.price),
            duration_minutes: parseInt(packageFormData.duration_minutes) || 0,
            is_combo: packageFormData.is_combo,
          })
          .select()
          .single();

        if (packageError) throw packageError;

        const packageServices = packageFormData.selectedServices.map(item => ({
          package_id: packageData.id,
          service_id: item.service_id,
          quantity: item.quantity,
        }));

        const { error: servicesError } = await supabase
          .from('package_services')
          .insert(packageServices);

        if (servicesError) throw servicesError;
      }

      setShowPackageForm(false);
      setEditingPackage(null);
      resetPackageForm();
      loadPackages();
    } catch (error: any) {
      console.error('Error saving package:', error);
      setError(error.message || 'Error al guardar el paquete');
    }
  };

  const handleEditService = (service: Service) => {
    if (!canEdit) return;
    setEditingService(service);
    setServiceFormData(service);
    setShowServiceForm(true);
  };

  const handleEditPackage = (pkg: ServicePackage) => {
    if (!canEdit) return;
    setEditingPackage(pkg);

    const pkgWithServices = packages.find(p => p.id === pkg.id);
    const selectedServices = pkgWithServices?.services?.map(ps => ({
      service_id: ps.service_id,
      quantity: ps.quantity,
    })) || [];

    setPackageFormData({
      name: pkg.name,
      description: pkg.description || '',
      price: pkg.price.toString(),
      duration_minutes: pkg.duration_minutes?.toString() || '',
      is_combo: pkg.is_combo,
      selectedServices,
    });
    setShowPackageForm(true);
  };

  const togglePackageStatus = async (pkg: ServicePackage) => {
    if (!canEdit) return;

    try {
      const { error } = await supabase
        .from('service_packages')
        .update({ is_active: !pkg.is_active })
        .eq('id', pkg.id);

      if (error) throw error;
      loadPackages();
    } catch (error) {
      console.error('Error toggling package status:', error);
    }
  };

  const addServiceToPackage = (serviceId: string) => {
    if (packageFormData.selectedServices.find(s => s.service_id === serviceId)) {
      return;
    }

    setPackageFormData({
      ...packageFormData,
      selectedServices: [
        ...packageFormData.selectedServices,
        { service_id: serviceId, quantity: 1 },
      ],
    });
  };

  const removeServiceFromPackage = (serviceId: string) => {
    setPackageFormData({
      ...packageFormData,
      selectedServices: packageFormData.selectedServices.filter(s => s.service_id !== serviceId),
    });
  };

  const updateServiceQuantity = (serviceId: string, quantity: number) => {
    setPackageFormData({
      ...packageFormData,
      selectedServices: packageFormData.selectedServices.map(s =>
        s.service_id === serviceId ? { ...s, quantity: Math.max(1, quantity) } : s
      ),
    });
  };

  const resetServiceForm = () => {
    setServiceFormData({
      name: '',
      description: '',
      base_price: 0,
      duration_minutes: 30,
      is_active: true,
    });
    setError('');
  };

  const resetPackageForm = () => {
    setPackageFormData({
      name: '',
      description: '',
      price: '',
      duration_minutes: '',
      is_combo: true,
      selectedServices: [],
    });
    setError('');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Servicios y Paquetes</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestiona los servicios y paquetes disponibles</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setViewMode('services');
              setSearchTerm('');
            }}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              viewMode === 'services'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Wrench className="w-5 h-5 inline mr-2" />
            Servicios
          </button>
          <button
            onClick={() => {
              setViewMode('packages');
              setSearchTerm('');
            }}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              viewMode === 'packages'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Package className="w-5 h-5 inline mr-2" />
            Paquetes
          </button>
        </div>
      </div>

      {viewMode === 'services' && (
        <>
          {!showServiceForm && services.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o descripción..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                  />
                </div>
                {canEdit && (
                  <button
                    onClick={() => setShowServiceForm(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium whitespace-nowrap"
                  >
                    <Plus className="w-5 h-5" />
                    Nuevo Servicio
                  </button>
                )}
              </div>
            </div>
          )}

          {showServiceForm && canEdit && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                {editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
              </h3>
              <form onSubmit={handleServiceSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      required
                      value={serviceFormData.name}
                      onChange={(e) => setServiceFormData({ ...serviceFormData,name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Lavado Completo"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Precio Base *
                    </label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={serviceFormData.base_price}
                      onChange={(e) => setServiceFormData({ ...serviceFormData, base_price: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="100.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Duración (minutos) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={serviceFormData.duration_minutes}
                      onChange={(e) => setServiceFormData({ ...serviceFormData, duration_minutes: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Estado
                    </label>
                    <select
                      value={serviceFormData.is_active ? 'true' : 'false'}
                      onChange={(e) => setServiceFormData({ ...serviceFormData, is_active: e.target.value === 'true' })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Descripción
                  </label>
                  <textarea
                    value={serviceFormData.description || ''}
                    onChange={(e) => setServiceFormData({ ...serviceFormData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                    placeholder="Descripción del servicio..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all font-medium"
                  >
                    {editingService ? 'Actualizar' : 'Crear'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowServiceForm(false);
                      setEditingService(null);
                      resetServiceForm();
                    }}
                    className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {!showServiceForm && services.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <Wrench className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No hay servicios registrados</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Comienza creando el primer servicio</p>
              {canEdit && (
                <button
                  onClick={() => setShowServiceForm(true)}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Nuevo Servicio
                </button>
              )}
            </div>
          )}

          {!showServiceForm && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{service.name}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        {service.is_active ? (
                          <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            Activo
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-full">
                            <XCircle className="w-3 h-3" />
                            Inactivo
                          </span>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => handleEditService(service)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                      >
                        <Edit2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </button>
                    )}
                  </div>

                  {service.description && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">{service.description}</p>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <span className="font-semibold text-lg">{formatCurrency(Number(service.base_price))}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                      <Clock className="w-4 h-4" />
                      <span>{service.duration_minutes} minutos</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {viewMode === 'packages' && (
        <>
          {!showPackageForm && packages.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar paquetes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                  />
                </div>
                {canEdit && (
                  <button
                    onClick={() => setShowPackageForm(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium whitespace-nowrap"
                  >
                    <Plus className="w-5 h-5" />
                    Nuevo Paquete
                  </button>
                )}
              </div>
            </div>
          )}

          {showPackageForm && canEdit && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                {editingPackage ? 'Editar Paquete' : 'Nuevo Paquete'}
              </h3>
              <form onSubmit={handlePackageSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nombre del Paquete *
                    </label>
                    <input
                      type="text"
                      required
                      value={packageFormData.name}
                      onChange={(e) => setPackageFormData({ ...packageFormData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Paquete Premium"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Precio del Paquete *
                    </label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={packageFormData.price}
                      onChange={(e) => setPackageFormData({ ...packageFormData, price: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="250.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Duración Total (minutos)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={packageFormData.duration_minutes}
                      onChange={(e) => setPackageFormData({ ...packageFormData, duration_minutes: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="60"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Descripción
                    </label>
                    <textarea
                      value={packageFormData.description}
                      onChange={(e) => setPackageFormData({ ...packageFormData, description: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                      placeholder="Descripción del paquete..."
                    />
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Servicios Incluidos</h4>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Agregar Servicio
                    </label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          addServiceToPackage(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Seleccionar servicio...</option>
                      {services.filter(s => s.is_active).map(service => (
                        <option key={service.id} value={service.id}>
                          {service.name} - {formatCurrency(Number(service.base_price))}
                        </option>
                      ))}
                    </select>
                  </div>

                  {packageFormData.selectedServices.length > 0 && (
                    <div className="space-y-2">
                      {packageFormData.selectedServices.map((item) => {
                        const service = services.find(s => s.id === item.service_id);
                        if (!service) return null;

                        return (
                          <div key={item.service_id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-white">{service.name}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-300">{formatCurrency(Number(service.base_price))}</div>
                            </div>
                            <div className="w-24">
                              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">Cantidad</label>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateServiceQuantity(item.service_id, parseInt(e.target.value))}
                                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeServiceFromPackage(item.service_id)}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {packageFormData.selectedServices.length === 0 && (
                    <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                      <Package className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-2" />
                      <p className="text-gray-600 dark:text-gray-400">Agrega servicios al paquete</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all font-medium"
                  >
                    {editingPackage ? 'Actualizar Paquete' : 'Crear Paquete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPackageForm(false);
                      setEditingPackage(null);
                      resetPackageForm();
                    }}
                    className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {!showPackageForm && packages.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No hay paquetes registrados</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Crea paquetes combinando múltiples servicios</p>
              {canEdit && (
                <button
                  onClick={() => setShowPackageForm(true)}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Nuevo Paquete
                </button>
              )}
            </div>
          )}

          {!showPackageForm && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-blue-200 dark:border-blue-900/50 p-6 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{pkg.name}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {pkg.is_active ? (
                          <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            Activo
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-full">
                            <XCircle className="w-3 h-3" />
                            Inactivo
                          </span>
                        )}
                        {pkg.is_combo && (
                          <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 rounded-full">
                            Combo
                          </span>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditPackage(pkg)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                        >
                          <Edit2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>
                        <button
                          onClick={() => togglePackageStatus(pkg)}
                          className={`px-3 py-1 rounded-lg transition-all text-xs font-medium ${
                            pkg.is_active
                              ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
                              : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                          }`}
                        >
                          {pkg.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    )}
                  </div>

                  {pkg.description && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">{pkg.description}</p>
                  )}

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <span className="font-semibold text-lg">{formatCurrency(Number(pkg.price))}</span>
                    </div>
                    {pkg.duration_minutes > 0 && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                        <Clock className="w-4 h-4" />
                        <span>{pkg.duration_minutes} minutos</span>
                      </div>
                    )}
                  </div>

                  {pkg.services && pkg.services.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                      <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Servicios incluidos:</div>
                      <ul className="space-y-1">
                        {pkg.services.map((ps) => (
                          <li key={ps.id} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full"></span>
                            {ps.service.name} {ps.quantity > 1 && `(x${ps.quantity})`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
