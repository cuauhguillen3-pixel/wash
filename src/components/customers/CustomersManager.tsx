import { useEffect, useState } from 'react';
import { Plus, CreditCard as Edit2, Users, Phone, Mail, Search, Download, UserX, UserCheck, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CompanyFilter } from '../shared/CompanyFilter';
import type { Database } from '../../lib/database.types';

type Company = Database['public']['Tables']['companies']['Row'];

type Customer = Database['public']['Tables']['customers']['Row'];
type CustomerInsert = Database['public']['Tables']['customers']['Insert'];

interface CustomerWithCompany extends Customer {
  company: Company | null;
}

export function CustomersManager() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<CustomerWithCompany[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');

  const isRoot = profile?.role === 'root';
  const canEdit = !isRoot;
  const [formData, setFormData] = useState<Partial<CustomerInsert>>({
    full_name: '',
    email: '',
    phone: '',
    notes: '',
    is_active: true,
    company_id: profile?.company_id,
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchTerm, selectedCompany]);

  const filterCustomers = () => {
    let filtered = customers;

    if (selectedCompany && isRoot) {
      filtered = filtered.filter(cust => cust.company_id === selectedCompany);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(cust =>
        cust.full_name.toLowerCase().includes(term) ||
        cust.email?.toLowerCase().includes(term) ||
        cust.phone.toLowerCase().includes(term) ||
        cust.company?.name?.toLowerCase().includes(term)
      );
    }

    setFilteredCustomers(filtered);
  };

  const loadCustomers = async () => {
    try {
      let query = supabase
        .from('customers')
        .select(`
          *,
          company:companies(*)
        `)
        .order('created_at', { ascending: false });

      if (!isRoot && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setCustomers(data as CustomerWithCompany[] || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canEdit) return;

    try {
      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(formData)
          .eq('id', editingCustomer.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('customers')
          .insert({
            ...formData,
            is_active: true,
            company_id: profile?.company_id,
          } as CustomerInsert);

        if (error) throw error;
      }

      setShowForm(false);
      setEditingCustomer(null);
      resetForm();
      loadCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
    }
  };

  const handleEdit = (customer: Customer) => {
    if (!canEdit) return;

    setEditingCustomer(customer);
    setFormData(customer);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      notes: '',
      is_active: true,
      company_id: profile?.company_id,
    });
  };

  const toggleCustomerStatus = async (customer: Customer) => {
    if (!canEdit) return;

    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: !customer.is_active })
        .eq('id', customer.id);

      if (error) throw error;
      loadCustomers();
    } catch (error) {
      console.error('Error toggling customer status:', error);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingCustomer(null);
    resetForm();
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
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Clientes</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestiona tu base de clientes</p>
        </div>
        <div className="flex gap-3">
          {filteredCustomers.length > 0 && (
            <button
              onClick={() => {
                const headers = ['Nombre', 'Teléfono', 'Email'];
                const rows = filteredCustomers.map(cust => [
                  cust.full_name,
                  cust.phone,
                  cust.email || ''
                ]);
                const csvContent = [
                  headers.join(','),
                  ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
                ].join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `clientes_${new Date().toISOString().split('T')[0]}.csv`);
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
              Nuevo Cliente
            </button>
          )}
        </div>
      </div>

      {!showForm && customers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
          {isRoot && (
            <CompanyFilter value={selectedCompany} onChange={setSelectedCompany} />
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, teléfono o empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {showForm && canEdit && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">
            {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+52 123 456 7890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="cliente@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Información adicional..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all font-medium"
              >
                {editingCustomer ? 'Actualizar' : 'Crear'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-all font-medium"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map((customer) => {
          return (
            <div
              key={customer.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{customer.full_name}</h3>
                    {customer.is_active ? (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                        Activo
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">
                        Inactivo
                      </span>
                    )}
                  </div>
                  {isRoot && customer.company && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <Building2 className="w-3 h-3" />
                      {customer.company.name}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(customer)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                      title="Editar"
                    >
                      <Edit2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => toggleCustomerStatus(customer)}
                      className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all ${
                        customer.is_active ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}
                      title={customer.is_active ? 'Desactivar' : 'Activar'}
                    >
                      {customer.is_active ? (
                        <UserX className="w-5 h-5" />
                      ) : (
                        <UserCheck className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <span>{customer.phone}</span>
                </div>

                {customer.email && (
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <span>{customer.email}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredCustomers.length === 0 && !showForm && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Comienza agregando tu primer cliente'}
          </p>
          {!searchTerm && canEdit && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium"
            >
              <Plus className="w-5 h-5" />
              Nuevo Cliente
            </button>
          )}
        </div>
      )}
    </div>
  );
}
