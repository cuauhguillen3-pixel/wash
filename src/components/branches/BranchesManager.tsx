import { useEffect, useState } from 'react';
import { Plus, CreditCard as Edit2, MapPin, Phone, Mail, CheckCircle, XCircle, Search, Download, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CompanyFilter } from '../shared/CompanyFilter';
import type { Database } from '../../lib/database.types';

type Branch = Database['public']['Tables']['branches']['Row'];
type BranchInsert = Database['public']['Tables']['branches']['Insert'];
type Company = Database['public']['Tables']['companies']['Row'];

interface BranchWithCompany extends Branch {
  company: Company | null;
}

export function BranchesManager() {
  const { profile } = useAuth();
  const [branches, setBranches] = useState<BranchWithCompany[]>([]);
  const [filteredBranches, setFilteredBranches] = useState<BranchWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');

  const isRoot = profile?.role === 'root';
  const isAdmin = profile?.role === 'admin';
  const canEdit = isAdmin && !isRoot;
  const [formData, setFormData] = useState<Partial<BranchInsert>>({
    name: '',
    address: '',
    phone: '',
    email: '',
    is_active: true,
  });

  useEffect(() => {
    loadBranches();
  }, [profile]);

  useEffect(() => {
    filterBranches();
  }, [branches, searchTerm, selectedCompany]);

  const filterBranches = () => {
    let filtered = branches;

    if (selectedCompany && isRoot) {
      filtered = filtered.filter(branch => branch.company_id === selectedCompany);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(branch =>
        branch.name.toLowerCase().includes(term) ||
        branch.address.toLowerCase().includes(term) ||
        branch.phone?.toLowerCase().includes(term) ||
        branch.email?.toLowerCase().includes(term) ||
        branch.company?.name.toLowerCase().includes(term)
      );
    }

    setFilteredBranches(filtered);
  };

  const loadBranches = async () => {
    try {
      let query = supabase
        .from('branches')
        .select(`
          *,
          company:companies(*)
        `)
        .order('created_at', { ascending: false });

      if (isAdmin && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setBranches(data as BranchWithCompany[] || []);
    } catch (error) {
      console.error('Error loading branches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canEdit) return;

    try {
      const companyId = profile?.company_id;
      if (editingBranch) {
        const { error } = await supabase
          .from('branches')
          .update(formData)
          .eq('id', editingBranch.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('branches')
          .insert({
            ...formData,
            company_id: companyId
          } as BranchInsert);

        if (error) throw error;
      }

      setShowForm(false);
      setEditingBranch(null);
      setFormData({ name: '', address: '', phone: '', email: '', is_active: true });
      loadBranches();
    } catch (error) {
      console.error('Error saving branch:', error);
    }
  };

  const handleEdit = (branch: Branch) => {
    if (!canEdit) return;

    setEditingBranch(branch);
    setFormData(branch);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingBranch(null);
    setFormData({ name: '', address: '', phone: '', email: '', is_active: true });
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
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Sucursales</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestiona las ubicaciones de tu negocio</p>
        </div>
        <div className="flex gap-3">
          {filteredBranches.length > 0 && (
            <button
              onClick={() => {
                const headers = ['Nombre', 'Dirección', 'Teléfono', 'Email', 'Estado', 'Empresa'];
                const rows = filteredBranches.map(branch => [
                  branch.name,
                  branch.address,
                  branch.phone || '',
                  branch.email || '',
                  branch.is_active ? 'Activa' : 'Inactiva',
                  branch.company?.name || ''
                ]);
                const csvContent = [
                  headers.join(','),
                  ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
                ].join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `sucursales_${new Date().toISOString().split('T')[0]}.csv`);
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
              Nueva Sucursal
            </button>
          )}
        </div>
      </div>

      {!showForm && branches.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          {isRoot && (
            <CompanyFilter value={selectedCompany} onChange={setSelectedCompany} />
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, dirección, teléfono, email o empresa..."
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
            {editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                  placeholder="Sucursal Centro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="+52 123 456 7890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="sucursal@carwash.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Estado
                </label>
                <select
                  value={formData.is_active ? 'true' : 'false'}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="true">Activa</option>
                  <option value="false">Inactiva</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Dirección *
              </label>
              <textarea
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                placeholder="Calle, Número, Colonia, Ciudad"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all font-medium"
              >
                {editingBranch ? 'Actualizar' : 'Crear'}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBranches.map((branch) => (
          <div
            key={branch.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{branch.name}</h3>
                {isRoot && branch.company && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <Building2 className="w-3 h-3" />
                    {branch.company.name}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {branch.is_active ? (
                    <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full">
                      <CheckCircle className="w-3 h-3" />
                      Activa
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-full">
                      <XCircle className="w-3 h-3" />
                      Inactiva
                    </span>
                  )}
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={() => handleEdit(branch)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                >
                  <Edit2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{branch.address}</span>
              </div>

              {branch.phone && (
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <span>{branch.phone}</span>
                </div>
              )}

              {branch.email && (
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span>{branch.email}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredBranches.length === 0 && !showForm && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <MapPin className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {searchTerm ? 'No se encontraron sucursales' : 'No hay sucursales registradas'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Comienza agregando tu primera sucursal'}
          </p>
          {!searchTerm && canEdit && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium"
            >
              <Plus className="w-5 h-5" />
              Nueva Sucursal
            </button>
          )}
        </div>
      )}
    </div>
  );
}
