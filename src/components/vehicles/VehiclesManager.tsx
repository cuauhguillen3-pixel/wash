import { useEffect, useState } from 'react';
import { Plus, Search, Car, CreditCard as Edit2, CheckCircle, XCircle, User, Camera, QrCode, ScanLine, Download, Palette, Calendar, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CompanyFilter } from '../shared/CompanyFilter';
import type { Database } from '../../lib/database.types';

type Company = Database['public']['Tables']['companies']['Row'];

type Vehicle = Database['public']['Tables']['vehicles']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];

interface VehicleWithCustomer extends Vehicle {
  customer: Customer;
  company?: Company | null;
}

export function VehiclesManager() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<VehicleWithCustomer[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<VehicleWithCustomer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [scanType, setScanType] = useState<'lpr' | 'sticker'>('lpr');
  const [scanResult, setScanResult] = useState<{ found: boolean; vehicle?: VehicleWithCustomer } | null>(null);
  const [formData, setFormData] = useState({
    customer_id: '',
    license_plate: '',
    brand: '',
    model: '',
    year: '',
    color: '',
    vehicle_type: 'sedan' as 'sedan' | 'suv' | 'truck' | 'motorcycle' | 'van' | 'other',
    vin: '',
    sticker_code: '',
    photo_url: '',
    notes: '',
  });
  const [error, setError] = useState('');

  const isRoot = profile?.role === 'root';
  const canEdit = profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'operator';

  const vehicleTypes = [
    { value: 'sedan', label: 'Sedán' },
    { value: 'suv', label: 'SUV' },
    { value: 'truck', label: 'Camioneta' },
    { value: 'motorcycle', label: 'Motocicleta' },
    { value: 'van', label: 'Van' },
    { value: 'other', label: 'Otro' },
  ];

  useEffect(() => {
    loadData();
  }, [profile]);

  useEffect(() => {
    filterVehicles();
  }, [vehicles, searchTerm, selectedCompany]);

  useEffect(() => {
    if (customers.length > 0) {
      filterCustomers();
    }
  }, [customers, customerSearch]);

  useEffect(() => {
    if (showForm) {
      loadCustomers();
    }
  }, [showForm]);

  const loadData = async () => {
    try {
      await Promise.all([loadVehicles(), loadCustomers()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVehicles = async () => {
    try {
      let query = supabase
        .from('vehicles')
        .select(`
          *,
          customer:customers(*),
          company:companies(*)
        `)
        .order('created_at', { ascending: false});

      if (!isRoot && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setVehicles(data as VehicleWithCustomer[] || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;

      console.log('Customers loaded:', data?.length || 0);
      setCustomers(data || []);
      setFilteredCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const filterVehicles = () => {
    let filtered = vehicles;

    if (selectedCompany && isRoot) {
      filtered = filtered.filter(v => v.company_id === selectedCompany);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(vehicle =>
        vehicle.license_plate.toLowerCase().includes(term) ||
        vehicle.brand.toLowerCase().includes(term) ||
        vehicle.model.toLowerCase().includes(term) ||
        vehicle.color?.toLowerCase().includes(term) ||
        vehicle.customer.full_name.toLowerCase().includes(term) ||
        vehicle.customer.email?.toLowerCase().includes(term) ||
        vehicle.sticker_code?.toLowerCase().includes(term) ||
        vehicle.company?.name?.toLowerCase().includes(term)
      );
    }

    setFilteredVehicles(filtered);
  };

  const filterCustomers = () => {
    if (!customerSearch || customerSearch.trim() === '') {
      console.log('Showing all customers:', customers.length);
      setFilteredCustomers(customers);
      return;
    }

    const normalizeText = (text: string) => {
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    };

    const searchTerm = normalizeText(customerSearch.trim());

    const filtered = customers.filter(customer => {
      const fullName = normalizeText(customer.full_name);
      const email = normalizeText(customer.email || '');
      const phone = (customer.phone || '').replace(/\D/g, '');
      const searchPhone = customerSearch.replace(/\D/g, '');

      const matchesName = fullName.includes(searchTerm);
      const matchesEmail = email.includes(searchTerm);
      const matchesPhone = searchPhone.length > 0 && phone.includes(searchPhone);

      return matchesName || matchesEmail || matchesPhone;
    });

    console.log('Search:', customerSearch, '| Term:', searchTerm, '| Found:', filtered.length, filtered.map(c => c.full_name));
    setFilteredCustomers(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!canEdit) {
      setError('No tienes permisos para realizar esta acción');
      return;
    }

    try {
      const vehicleData = {
        customer_id: formData.customer_id,
        license_plate: formData.license_plate.toUpperCase(),
        brand: formData.brand,
        model: formData.model,
        year: formData.year ? parseInt(formData.year) : null,
        color: formData.color || null,
        vehicle_type: formData.vehicle_type,
        vin: formData.vin || null,
        sticker_code: formData.sticker_code || null,
        photo_url: formData.photo_url || null,
        notes: formData.notes || null,
      };

      if (editingVehicle) {
        const { error } = await supabase
          .from('vehicles')
          .update(vehicleData)
          .eq('id', editingVehicle.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vehicles')
          .insert({
            ...vehicleData,
            company_id: profile?.company_id!,
          });

        if (error) throw error;
      }

      setShowForm(false);
      setEditingVehicle(null);
      resetForm();
      loadVehicles();
    } catch (error: any) {
      console.error('Error saving vehicle:', error);
      if (error.code === '23505') {
        setError('Ya existe un vehículo con esta placa o código de sticker');
      } else {
        setError(error.message || 'Error al guardar el vehículo');
      }
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    if (!canEdit) return;

    setEditingVehicle(vehicle);
    setFormData({
      customer_id: vehicle.customer_id,
      license_plate: vehicle.license_plate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year?.toString() || '',
      color: vehicle.color || '',
      vehicle_type: vehicle.vehicle_type as any,
      vin: vehicle.vin || '',
      sticker_code: vehicle.sticker_code || '',
      photo_url: vehicle.photo_url || '',
      notes: vehicle.notes || '',
    });
    setCustomerSearch('');
    setShowForm(true);
  };

  const toggleStatus = async (vehicle: Vehicle) => {
    if (!canEdit) return;

    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ is_active: !vehicle.is_active })
        .eq('id', vehicle.id);

      if (error) throw error;
      loadVehicles();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const generateStickerCode = async () => {
    try {
      const { data, error } = await supabase.rpc('generate_sticker_code');
      if (error) throw error;
      setFormData({ ...formData, sticker_code: data });
    } catch (error) {
      console.error('Error generating sticker code:', error);
    }
  };

  const handleScan = async () => {
    setScanResult(null);
    if (!scanInput.trim()) return;

    try {
      let query = supabase
        .from('vehicles')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('company_id', profile?.company_id!)
        .eq('is_active', true);

      if (scanType === 'lpr') {
        query = query.ilike('license_plate', scanInput.toUpperCase());
      } else {
        query = query.eq('sticker_code', scanInput.toUpperCase());
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;

      await supabase.from('vehicle_scans').insert({
        company_id: profile?.company_id!,
        vehicle_id: data?.id || null,
        branch_id: null,
        scan_type: scanType,
        scan_value: scanInput,
        scan_result: data ? 'success' : 'not_found',
        scanned_by: profile?.id!,
      });

      setScanResult({
        found: !!data,
        vehicle: data as VehicleWithCustomer,
      });
    } catch (error) {
      console.error('Error scanning:', error);
      setScanResult({ found: false });
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      license_plate: '',
      brand: '',
      model: '',
      year: '',
      color: '',
      vehicle_type: 'sedan',
      vin: '',
      sticker_code: '',
      photo_url: '',
      notes: '',
    });
    setCustomerSearch('');
    setError('');
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingVehicle(null);
    setCustomerSearch('');
    resetForm();
  };

  const exportToCSV = () => {
    const headers = ['Placa', 'Marca', 'Modelo', 'Año', 'Color', 'Tipo', 'Cliente', 'Sticker', 'Estado'];
    const rows = filteredVehicles.map(vehicle => [
      vehicle.license_plate,
      vehicle.brand,
      vehicle.model,
      vehicle.year || '',
      vehicle.color || '',
      vehicleTypes.find(t => t.value === vehicle.vehicle_type)?.label || vehicle.vehicle_type,
      vehicle.customer.full_name,
      vehicle.sticker_code || '',
      vehicle.is_active ? 'Activo' : 'Inactivo',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `vehiculos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Vehículos</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestiona los vehículos de los clientes</p>
        </div>
        <div className="flex gap-3">
          {filteredVehicles.length > 0 && (
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all shadow-md font-medium"
            >
              <Download className="w-5 h-5" />
              Exportar
            </button>
          )}
          <button
            onClick={() => setShowScanner(!showScanner)}
            className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-all shadow-md font-medium"
          >
            <ScanLine className="w-5 h-5" />
            Escanear
          </button>
          {!showForm && canEdit && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium"
            >
              <Plus className="w-5 h-5" />
              Nuevo Vehículo
            </button>
          )}
        </div>
      </div>

      {showScanner && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Escáner de Vehículos</h3>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Escaneo
                </label>
                <select
                  value={scanType}
                  onChange={(e) => setScanType(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="lpr">Placa (LPR)</option>
                  <option value="sticker">Código Sticker</option>
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {scanType === 'lpr' ? 'Placa del Vehículo' : 'Código del Sticker'}
                </label>
                <input
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && handleScan()}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                  placeholder={scanType === 'lpr' ? 'ABC-123' : 'STK-XXXXXXXX'}
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleScan}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-medium"
                >
                  Buscar
                </button>
              </div>
            </div>

            {scanResult && (
              <div className={`p-4 rounded-lg ${scanResult.found ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                {scanResult.found && scanResult.vehicle ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <h4 className="font-semibold text-green-900 dark:text-green-100">Vehículo Encontrado</h4>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Placa:</span>
                        <div className="font-semibold text-gray-900 dark:text-white">{scanResult.vehicle.license_plate}</div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Marca/Modelo:</span>
                        <div className="font-semibold text-gray-900 dark:text-white">{scanResult.vehicle.brand} {scanResult.vehicle.model}</div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Color:</span>
                        <div className="font-semibold text-gray-900 dark:text-white">{scanResult.vehicle.color || '-'}</div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Cliente:</span>
                        <div className="font-semibold text-gray-900 dark:text-white">{scanResult.vehicle.customer.full_name}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <span className="font-semibold text-red-900 dark:text-red-200">Vehículo no encontrado</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!showForm && vehicles.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          {isRoot && (
            <CompanyFilter value={selectedCompany} onChange={setSelectedCompany} />
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por placa, marca, modelo, color, cliente, empresa o sticker..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
            />
          </div>
        </div>
      )}

      {showForm && canEdit && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            {editingVehicle ? 'Editar Vehículo' : 'Nuevo Vehículo'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cliente *
                </label>
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Buscar cliente..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                    />
                  </div>
                  <select
                    required
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">
                      {customerSearch
                        ? `Seleccionar (${filteredCustomers.length} encontrado${filteredCustomers.length !== 1 ? 's' : ''})`
                        : 'Seleccionar cliente'}
                    </option>
                    {filteredCustomers.slice(0, 50).map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.full_name} - {customer.phone}
                      </option>
                    ))}
                  </select>
                  {filteredCustomers.length === 0 && customerSearch && (
                    <p className="text-sm text-red-600 dark:text-red-400">No se encontraron clientes con "{customerSearch}"</p>
                  )}
                  {filteredCustomers.length > 0 && customerSearch && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      ✓ {filteredCustomers.length} cliente{filteredCustomers.length !== 1 ? 's' : ''} encontrado{filteredCustomers.length !== 1 ? 's' : ''}
                    </p>
                  )}
                  {filteredCustomers.length > 50 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Se muestran los primeros 50 resultados</p>
                  )}
                  {customers.length === 0 && !customerSearch && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No hay clientes registrados</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Placa / Matrícula *
                </label>
                <input
                  type="text"
                  required
                  value={formData.license_plate}
                  onChange={(e) => setFormData({ ...formData, license_plate: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="ABC-123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Marca *
                </label>
                <input
                  type="text"
                  required
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Toyota, Honda, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Modelo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Corolla, Civic, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Año
                </label>
                <input
                  type="number"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={new Date().getFullYear().toString()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Color
                </label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Blanco, Negro, Rojo, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Vehículo *
                </label>
                <select
                  required
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {vehicleTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  VIN / Número de Serie
                </label>
                <input
                  type="text"
                  value={formData.vin}
                  onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="17 caracteres"
                  maxLength={17}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Código Sticker
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.sticker_code}
                    onChange={(e) => setFormData({ ...formData, sticker_code: e.target.value.toUpperCase() })}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="STK-XXXXXXXX"
                  />
                  <button
                    type="button"
                    onClick={generateStickerCode}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all dark:bg-gray-700 dark:hover:bg-gray-600"
                    title="Generar código"
                  >
                    <QrCode className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  URL de Foto
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={formData.photo_url}
                    onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="https://ejemplo.com/foto.jpg"
                  />
                  <button
                    type="button"
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    title="Subir foto"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notas
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Información adicional sobre el vehículo..."
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all font-medium"
              >
                {editingVehicle ? 'Actualizar' : 'Crear'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 py-2 rounded-lg hover:bg-gray-300 transition-all font-medium"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Vehículo
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Placa
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Detalles
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Cliente
                </th>
                {isRoot && (
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Empresa
                  </th>
                )}
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Sticker
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Estado
                </th>
                {canEdit && (
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredVehicles.map((vehicle) => (
                <tr key={vehicle.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {vehicle.photo_url ? (
                        <img
                          src={vehicle.photo_url}
                          alt={`${vehicle.brand} ${vehicle.model}`}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                          <Car className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">{vehicle.brand} {vehicle.model}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                          {vehicle.year && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {vehicle.year}
                            </span>
                          )}
                          {vehicle.color && (
                            <span className="flex items-center gap-1">
                              <Palette className="w-3 h-3" />
                              {vehicle.color}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg font-bold">
                      {vehicle.license_plate}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {vehicleTypes.find(t => t.value === vehicle.vehicle_type)?.label}
                    </div>
                    {vehicle.vin && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">VIN: {vehicle.vin}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{vehicle.customer.full_name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{vehicle.customer.email || vehicle.customer.phone}</div>
                      </div>
                    </div>
                  </td>
                  {isRoot && (
                    <td className="px-6 py-4">
                      {vehicle.company ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          <span className="text-sm text-gray-900 dark:text-white">{vehicle.company.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">N/A</span>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4">
                    {vehicle.sticker_code ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-1 rounded-full">
                        <QrCode className="w-3 h-3" />
                        {vehicle.sticker_code}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">Sin sticker</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {vehicle.is_active ? (
                      <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded-full w-fit">
                        <CheckCircle className="w-3 h-3" />
                        Activo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-2 py-1 rounded-full w-fit">
                        <XCircle className="w-3 h-3" />
                        Inactivo
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(vehicle)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </button>
                        <button
                          onClick={() => toggleStatus(vehicle)}
                          className={`px-3 py-1 rounded-lg transition-all text-xs font-medium ${
                            vehicle.is_active
                              ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50'
                              : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50'
                          }`}
                          title={vehicle.is_active ? 'Desactivar' : 'Activar'}
                        >
                          {vehicle.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredVehicles.length === 0 && !showForm && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <Car className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {searchTerm ? 'No se encontraron vehículos' : 'No hay vehículos registrados'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Comienza agregando el primer vehículo'}
          </p>
          {!searchTerm && canEdit && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium"
            >
              <Plus className="w-5 h-5" />
              Nuevo Vehículo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
