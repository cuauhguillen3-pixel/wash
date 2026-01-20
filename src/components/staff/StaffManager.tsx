import { useEffect, useState } from 'react';
import { Plus, CreditCard as Edit2, UserCog, Phone, MapPin, CheckCircle, XCircle, Building2, Search, Download, Mail, MailCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../lib/database.types';

type Employee = Database['public']['Tables']['employees']['Row'];
type Branch = Database['public']['Tables']['branches']['Row'];
type Company = Database['public']['Tables']['companies']['Row'];

interface EmployeeWithRelations extends Employee {
  branch: Branch | null;
  company: Company | null;
  has_user_account: boolean;
}

export function StaffManager() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeWithRelations[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    position: 'employee',
    hire_date: '',
    company_id: '',
    branch_id: '',
    notes: '',
  });
  const [error, setError] = useState('');

  const isRoot = profile?.role === 'root';
  const isAdmin = profile?.role === 'admin';
  const canEdit = isAdmin && !isRoot;

  useEffect(() => {
    loadData();
  }, [profile]);

  useEffect(() => {
    filterEmployees();
  }, [employees, searchTerm]);

  const loadData = async () => {
    try {
      await Promise.all([loadEmployees(), loadBranches(), loadCompanies()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      let query = supabase
        .from('employees')
        .select(`
          *,
          branch:branches(*),
          company:companies(*)
        `)
        .order('created_at', { ascending: false });

      if (isAdmin && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data: employeesData, error: employeesError } = await query;
      if (employeesError) throw employeesError;

      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('email');

      if (usersError) throw usersError;

      const userEmails = new Set(usersData?.map(u => u.email?.toLowerCase()) || []);

      const employeesWithAccounts = (employeesData || []).map(emp => ({
        ...emp,
        has_user_account: emp.email ? userEmails.has(emp.email.toLowerCase()) : false,
      })) as EmployeeWithRelations[];

      setEmployees(employeesWithAccounts);
    } catch (error) {
      console.error('Error loading employees:', error);
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

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const filterEmployees = () => {
    if (!searchTerm) {
      setFilteredEmployees(employees);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = employees.filter(emp =>
      emp.full_name.toLowerCase().includes(term) ||
      emp.email?.toLowerCase().includes(term) ||
      emp.phone?.toLowerCase().includes(term) ||
      emp.position?.toLowerCase().includes(term) ||
      emp.company?.name.toLowerCase().includes(term) ||
      emp.branch?.name.toLowerCase().includes(term)
    );
    setFilteredEmployees(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!canEdit) {
      setError('No tienes permisos para realizar esta acción');
      return;
    }

    try {
      const companyId = profile?.company_id;

      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update({
            full_name: formData.full_name,
            email: formData.email || null,
            phone: formData.phone || null,
            position: formData.position,
            hire_date: formData.hire_date || null,
            branch_id: formData.branch_id || null,
            notes: formData.notes || null,
          })
          .eq('id', editingEmployee.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('employees')
          .insert({
            company_id: companyId!,
            full_name: formData.full_name,
            email: formData.email || null,
            phone: formData.phone || null,
            position: formData.position,
            hire_date: formData.hire_date || null,
            branch_id: formData.branch_id || null,
            notes: formData.notes || null,
          });

        if (error) throw error;
      }

      setShowForm(false);
      setEditingEmployee(null);
      resetForm();
      loadEmployees();
    } catch (error: any) {
      console.error('Error saving employee:', error);
      setError(error.message || 'Error al guardar el empleado');
    }
  };

  const handleEdit = (employee: Employee) => {
    if (!canEdit) return;

    setEditingEmployee(employee);
    setFormData({
      full_name: employee.full_name,
      email: employee.email || '',
      phone: employee.phone || '',
      position: employee.position || 'employee',
      hire_date: employee.hire_date || '',
      company_id: employee.company_id,
      branch_id: employee.branch_id || '',
      notes: employee.notes || '',
    });
    setShowForm(true);
  };

  const toggleStatus = async (employee: Employee) => {
    if (!canEdit) return;

    try {
      const { error } = await supabase
        .from('employees')
        .update({ is_active: !employee.is_active })
        .eq('id', employee.id);

      if (error) throw error;
      loadEmployees();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      position: 'employee',
      hire_date: '',
      company_id: profile?.company_id || '',
      branch_id: '',
      notes: '',
    });
    setError('');
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingEmployee(null);
    resetForm();
  };

  const exportToCSV = () => {
    const headers = ['Nombre', 'Email', 'Teléfono', 'Posición', 'Empresa', 'Sucursal', 'Estado', 'Tiene Usuario'];
    const rows = filteredEmployees.map(emp => [
      emp.full_name,
      emp.email || '',
      emp.phone || '',
      emp.position || '',
      emp.company?.name || '',
      emp.branch?.name || '',
      emp.is_active ? 'Activo' : 'Inactivo',
      emp.has_user_account ? 'Sí' : 'No'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `empleados_${new Date().toISOString().split('T')[0]}.csv`);
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
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Personal</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestiona los empleados de la empresa</p>
        </div>
        <div className="flex gap-3">
          {filteredEmployees.length > 0 && (
            <button
              onClick={exportToCSV}
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
              Nuevo Empleado
            </button>
          )}
        </div>
      </div>

      {!showForm && employees.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, teléfono, posición, empresa o sucursal..."
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
            {editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                  placeholder="Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                  placeholder="empleado@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                  placeholder="+52 123 456 7890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Posición
                </label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                  placeholder="Lavador, Encargado, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fecha de Contratación
                </label>
                <input
                  type="date"
                  value={formData.hire_date}
                  onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sucursal
                </label>
                <select
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Sin asignar</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notas
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                  placeholder="Información adicional sobre el empleado..."
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all font-medium"
              >
                {editingEmployee ? 'Actualizar' : 'Crear'}
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
                  Empleado
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Contacto
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Posición
                </th>
                {isRoot && (
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Empresa
                  </th>
                )}
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Sucursal
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Usuario
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
              {filteredEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900 dark:text-white">{employee.full_name}</div>
                    {employee.hire_date && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Desde: {new Date(employee.hire_date).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {employee.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          {employee.has_user_account ? (
                            <MailCheck className="w-4 h-4 text-green-600 dark:text-green-400" title="Tiene cuenta de usuario" />
                          ) : (
                            <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500" title="Sin cuenta de usuario" />
                          )}
                          <span>{employee.email}</span>
                        </div>
                      )}
                      {employee.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <Phone className="w-4 h-4" />
                          <span>{employee.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900 dark:text-white">{employee.position || '-'}</span>
                  </td>
                  {isRoot && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Building2 className="w-4 h-4" />
                        {employee.company?.name || '-'}
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <MapPin className="w-4 h-4" />
                      {employee.branch?.name || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {employee.email ? (
                      employee.has_user_account ? (
                        <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 px-2 py-1 rounded-full w-fit">
                          <CheckCircle className="w-3 h-3" />
                          Tiene Usuario
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-2 py-1 rounded-full w-fit">
                          <XCircle className="w-3 h-3" />
                          Sin Usuario
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">Sin Email</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {employee.is_active ? (
                      <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 px-2 py-1 rounded-full w-fit">
                        <CheckCircle className="w-3 h-3" />
                        Activo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 px-2 py-1 rounded-full w-fit">
                        <XCircle className="w-3 h-3" />
                        Inactivo
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(employee)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </button>
                        <button
                          onClick={() => toggleStatus(employee)}
                          className={`px-3 py-1 rounded-lg transition-all text-xs font-medium ${
                            employee.is_active
                              ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
                              : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30'
                          }`}
                          title={employee.is_active ? 'Desactivar' : 'Activar'}
                        >
                          {employee.is_active ? 'Desactivar' : 'Activar'}
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

      {filteredEmployees.length === 0 && !showForm && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <UserCog className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {searchTerm ? 'No se encontraron empleados' : 'No hay empleados registrados'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Comienza agregando tu primer empleado'}
          </p>
          {!searchTerm && canEdit && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium"
            >
              <Plus className="w-5 h-5" />
              Nuevo Empleado
            </button>
          )}
        </div>
      )}
    </div>
  );
}