import { useEffect, useState } from 'react';
import { Plus, Calendar, Clock, DollarSign, CheckCircle, XCircle, Loader, Search, Download, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../lib/database.types';

type Appointment = Database['public']['Tables']['appointments']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];
type Branch = Database['public']['Tables']['branches']['Row'];
type Service = Database['public']['Tables']['services']['Row'];

interface AppointmentWithDetails extends Appointment {
  customer: Customer;
  branch: Branch;
}

export function AppointmentsManager() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<AppointmentWithDetails[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const isRoot = profile?.role === 'root';
  const isAdmin = profile?.role === 'admin';
  const canEdit = !isRoot;
  const [formData, setFormData] = useState({
    customer_id: '',
    branch_id: profile?.branch_id || '',
    vehicle_plate: '',
    scheduled_date: '',
    scheduled_time: '',
    selected_services: [] as string[],
    payment_method: 'cash' as 'cash' | 'card' | 'transfer',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [profile]);

  useEffect(() => {
    filterAppointments();
  }, [appointments, searchTerm]);

  const loadData = async () => {
    try {
      await Promise.all([
        loadAppointments(),
        loadCustomers(),
        loadBranches(),
        loadServices(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAppointments = async () => {
    try {
      let query = supabase
        .from('appointments')
        .select(`
          *,
          customer:customers(*),
          branch:branches(*)
        `)
        .order('scheduled_date', { ascending: false });

      if (isAdmin && profile?.company_id) {
        query = query.eq('branch_id', profile.branch_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAppointments(data as AppointmentWithDetails[] || []);
    } catch (error) {
      console.error('Error loading appointments:', error);
    }
  };

  const filterAppointments = () => {
    if (!searchTerm) {
      setFilteredAppointments(appointments);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = appointments.filter(apt =>
      apt.customer.full_name.toLowerCase().includes(term) ||
      apt.vehicle_plate.toLowerCase().includes(term) ||
      apt.branch.name.toLowerCase().includes(term) ||
      apt.status.toLowerCase().includes(term)
    );
    setFilteredAppointments(filtered);
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('full_name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadBranches = async () => {
    try {
      let query = supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (isAdmin && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !canEdit) return;

    try {
      const scheduledDateTime = new Date(`${formData.scheduled_date}T${formData.scheduled_time}`);
      const totalAmount = formData.selected_services.reduce((sum, serviceId) => {
        const service = services.find(s => s.id === serviceId);
        return sum + (service ? Number(service.base_price) : 0);
      }, 0);

      const { data: appointment, error: aptError } = await supabase
        .from('appointments')
        .insert({
          customer_id: formData.customer_id,
          branch_id: formData.branch_id,
          vehicle_plate: formData.vehicle_plate,
          scheduled_date: scheduledDateTime.toISOString(),
          total_amount: totalAmount,
          payment_method: formData.payment_method,
          notes: formData.notes,
          created_by: profile.id,
          status: 'pending',
          payment_status: 'pending',
        })
        .select()
        .single();

      if (aptError) throw aptError;

      if (appointment) {
        const serviceInserts = formData.selected_services.map(serviceId => {
          const service = services.find(s => s.id === serviceId);
          return {
            appointment_id: appointment.id,
            service_id: serviceId,
            price: service ? Number(service.base_price) : 0,
          };
        });

        const { error: servicesError } = await supabase
          .from('appointment_services')
          .insert(serviceInserts);

        if (servicesError) throw servicesError;
      }

      setShowForm(false);
      resetForm();
      loadAppointments();
    } catch (error) {
      console.error('Error saving appointment:', error);
    }
  };

  const updateStatus = async (appointmentId: string, status: Appointment['status']) => {
    if (!canEdit) return;

    try {
      const updateData: any = { status };
      if (status === 'completed' && profile) {
        updateData.completed_by = profile.id;
        updateData.payment_status = 'paid';
      }

      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointmentId);

      if (error) throw error;
      loadAppointments();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      branch_id: profile?.branch_id || '',
      vehicle_plate: '',
      scheduled_date: '',
      scheduled_time: '',
      selected_services: [],
      payment_method: 'cash',
      notes: '',
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    resetForm();
  };

  const toggleService = (serviceId: string) => {
    setFormData(prev => ({
      ...prev,
      selected_services: prev.selected_services.includes(serviceId)
        ? prev.selected_services.filter(id => id !== serviceId)
        : [...prev.selected_services, serviceId]
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'in_progress': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'in_progress': return 'En Progreso';
      case 'completed': return 'Completado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
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
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Citas</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestiona las citas de servicio</p>
        </div>
        <div className="flex gap-3">
          {filteredAppointments.length > 0 && (
            <button
              onClick={() => {
                const headers = ['Cliente', 'Teléfono', 'Vehículo', 'Fecha', 'Estado', 'Total', 'Sucursal'];
                const rows = filteredAppointments.map(apt => [
                  apt.customer.full_name,
                  apt.customer.phone,
                  apt.vehicle_plate,
                  new Date(apt.scheduled_date).toLocaleDateString(),
                  getStatusLabel(apt.status),
                  apt.total_amount,
                  apt.branch.name
                ]);
                const csvContent = [
                  headers.join(','),
                  ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
                ].join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `citas_${new Date().toISOString().split('T')[0]}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all shadow-md font-medium"
            >
              <Download className="w-5 h-5" />
              Exportar
            </button>
          )}
          {!showForm && canEdit && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium"
            >
              <Plus className="w-5 h-5" />
              Nueva Cita
            </button>
          )}
        </div>
      </div>

      {!showForm && appointments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por cliente, vehículo, sucursal o estado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
            />
          </div>
        </div>
      )}

      {showForm && canEdit && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Nueva Cita</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cliente *
                </label>
                <select
                  required
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Seleccionar cliente</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name} - {customer.phone}
                    </option>
                  ))}
                </select>
              </div>

              {profile?.role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sucursal *
                  </label>
                  <select
                    required
                    value={formData.branch_id}
                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Seleccionar sucursal</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Placa del Vehículo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.vehicle_plate}
                  onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                  placeholder="ABC-1234"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fecha *
                </label>
                <input
                  type="date"
                  required
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hora *
                </label>
                <input
                  type="time"
                  required
                  value={formData.scheduled_time}
                  onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Método de Pago
                </label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="transfer">Transferencia</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Servicios * (Total: ${formData.selected_services.reduce((sum, id) => {
                  const service = services.find(s => s.id === id);
                  return sum + (service ? Number(service.base_price) : 0);
                }, 0).toFixed(2)})
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {services.map(service => (
                  <label
                    key={service.id}
                    className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.selected_services.includes(service.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-500'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.selected_services.includes(service.id)}
                      onChange={() => toggleService(service.id)}
                      className="w-5 h-5 text-blue-600"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">{service.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        ${Number(service.base_price).toFixed(2)} • {service.duration_minutes} min
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notas
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                placeholder="Información adicional..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={formData.selected_services.length === 0}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Crear Cita
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredAppointments.map((appointment) => (
          <div
            key={appointment.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {appointment.customer.full_name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{appointment.vehicle_plate}</p>
                {isRoot && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <Building2 className="w-3 h-3" />
                    {appointment.branch.name}
                  </div>
                )}
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                {getStatusLabel(appointment.status)}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Calendar className="w-4 h-4" />
                {new Date(appointment.scheduled_date).toLocaleDateString('es-MX', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <DollarSign className="w-4 h-4" />
                Total: ${Number(appointment.total_amount).toFixed(2)}
              </div>

              {appointment.payment_status === 'paid' && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  Pagado
                </div>
              )}
            </div>

            {canEdit && appointment.status === 'pending' && (
              <div className="flex gap-2">
                <button
                  onClick={() => updateStatus(appointment.id, 'in_progress')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  <Loader className="w-4 h-4" />
                  Iniciar
                </button>
                <button
                  onClick={() => updateStatus(appointment.id, 'cancelled')}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all text-sm font-medium dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                >
                  Cancelar
                </button>
              </div>
            )}

            {canEdit && appointment.status === 'in_progress' && (
              <button
                onClick={() => updateStatus(appointment.id, 'completed')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-medium dark:bg-green-500 dark:hover:bg-green-600"
              >
                <CheckCircle className="w-4 h-4" />
                Completar
              </button>
            )}
          </div>
        ))}
      </div>

      {filteredAppointments.length === 0 && !showForm && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4 dark:text-gray-600" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2 dark:text-white">
            {searchTerm ? 'No se encontraron citas' : 'No hay citas registradas'}
          </h3>
          <p className="text-gray-600 mb-6 dark:text-gray-400">
            {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Comienza creando tu primera cita'}
          </p>
          {!searchTerm && canEdit && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium"
            >
              <Plus className="w-5 h-5" />
              Nueva Cita
            </button>
          )}
        </div>
      )}
    </div>
  );
}
