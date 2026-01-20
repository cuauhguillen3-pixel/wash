import { useEffect, useState } from 'react';
import { Plus, CreditCard as Edit2, UserCog, Phone, Building2, CheckCircle, XCircle, Search, Download, Shield, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database, UserRole } from '../../lib/database.types';
import { getRoleLabel, getRoleColor, getRoleDescription } from '../../lib/permissions';
import { RolesManager } from './RolesManager';
import { PermissionsManager } from './PermissionsManager';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
type Company = Database['public']['Tables']['companies']['Row'];
type Branch = Database['public']['Tables']['branches']['Row'];

interface UserWithCompany extends UserProfile {
  company: Company | null;
}

type ViewMode = 'users' | 'roles' | 'permissions';

export function UsersManager() {
  const { profile, hasPermission } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('users');
  const [users, setUsers] = useState<UserWithCompany[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithCompany[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableRoles, setAvailableRoles] = useState<Array<{name: string, description: string}>>([]);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'operator' as UserRole,
    company_id: '',
    branch_id: '',
    phone: '',
    notes: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [profile]);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm]);

  const loadData = async () => {
    try {
      await Promise.all([loadUsers(), loadCompanies(), loadBranches(), loadAvailableRoles()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableRoles = async () => {
    try {
      if (profile?.role === 'root') {
        const { data, error } = await supabase
          .from('roles')
          .select('name, description')
          .eq('is_active', true)
          .order('level', { ascending: false });

        if (error) throw error;
        setAvailableRoles(data || []);
      } else if (profile?.role === 'admin') {
        const { data: currentRole } = await supabase
          .from('roles')
          .select('level')
          .eq('name', profile.role)
          .maybeSingle();

        const userLevel = currentRole?.level || 90;

        const { data, error } = await supabase
          .from('roles')
          .select('name, description, level')
          .or(`company_id.eq.${profile?.company_id},company_id.is.null`)
          .eq('is_active', true)
          .lt('level', userLevel)
          .order('level', { ascending: false });

        if (error) throw error;
        setAvailableRoles((data || []).map(r => ({ name: r.name, description: r.description || '' })));
      }
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const loadUsers = async () => {
    try {
      let query = supabase
        .from('user_profiles')
        .select(`
          *,
          company:companies(*)
        `)
        .order('created_at', { ascending: false });

      if (profile?.role !== 'root') {
        query = query.eq('company_id', profile?.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = data as UserWithCompany[] || [];

      if (profile?.role === 'admin') {
        const { data: currentUserRole } = await supabase
          .from('roles')
          .select('level')
          .eq('name', profile.role)
          .maybeSingle();

        const userLevel = currentUserRole?.level || 90;

        const { data: allRoles } = await supabase
          .from('roles')
          .select('name, level');

        const roleMap = new Map((allRoles || []).map(r => [r.name, r.level]));

        filteredData = filteredData.filter(user => {
          const userRoleLevel = roleMap.get(user.role) || 0;
          return userRoleLevel < userLevel;
        });
      }

      setUsers(filteredData);
    } catch (error) {
      console.error('Error loading users:', error);
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

  const loadBranches = async () => {
    try {
      let query = supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (profile?.role === 'admin' && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };

  const filterUsers = () => {
    if (!searchTerm) {
      setFilteredUsers(users);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = users.filter(user =>
      user.full_name.toLowerCase().includes(term) ||
      user.email?.toLowerCase().includes(term) ||
      user.phone?.toLowerCase().includes(term) ||
      user.role.toLowerCase().includes(term) ||
      user.company?.name.toLowerCase().includes(term)
    );
    setFilteredUsers(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingUser) {
        const { error } = await supabase
          .from('user_profiles')
          .update({
            full_name: formData.full_name,
            role: formData.role,
            company_id: formData.company_id || null,
            branch_id: formData.branch_id || null,
            phone: formData.phone,
            notes: formData.notes || null,
          })
          .eq('id', editingUser.id);

        if (error) throw error;
      } else {
        const companyId = profile?.role === 'admin' ? profile.company_id : formData.company_id || null;

        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              full_name: formData.full_name,
              role: formData.role,
              company_id: companyId,
              branch_id: formData.branch_id || null,
              phone: formData.phone,
              notes: formData.notes || null,
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Error al crear el usuario');
        }
      }

      setShowForm(false);
      setEditingUser(null);
      resetForm();
      loadUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      setError(error.message || 'Error al guardar el usuario');
    }
  };

  const handleEdit = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      email: user.email || '',
      password: '',
      full_name: user.full_name,
      role: user.role,
      company_id: user.company_id || '',
      branch_id: user.branch_id || '',
      phone: user.phone || '',
      notes: user.notes || '',
    });
    setShowForm(true);
  };

  const toggleStatus = async (user: UserProfile) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);

      if (error) throw error;
      loadUsers();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      full_name: '',
      role: 'operator',
      company_id: profile?.role === 'admin' ? profile.company_id || '' : '',
      branch_id: '',
      phone: '',
      notes: '',
    });
    setError('');
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingUser(null);
    resetForm();
  };

  const exportToCSV = () => {
    const headers = ['Nombre', 'Email', 'Teléfono', 'Rol', 'Empresa', 'Estado'];
    const rows = filteredUsers.map(user => [
      user.full_name,
      user.email || '',
      user.phone || '',
      getRoleLabel(user.role),
      user.company?.name || 'Sin empresa',
      user.is_active ? 'Activo' : 'Inactivo'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `usuarios_${new Date().toISOString().split('T')[0]}.csv`);
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
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Gestión de Usuarios</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Administra usuarios, roles y permisos del sistema</p>
        </div>
        {viewMode === 'users' && (
          <div className="flex gap-3">
            {filteredUsers.length > 0 && (
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all shadow-md font-medium"
              >
                <Download className="w-5 h-5" />
                Exportar
              </button>
            )}
            {!showForm && hasPermission('manage_users') && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium"
              >
                <Plus className="w-5 h-5" />
                Nuevo Usuario
              </button>
            )}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            onClick={() => setViewMode('users')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
              viewMode === 'users'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <UserCog className="w-5 h-5" />
            Usuarios
          </button>
          <button
            onClick={() => setViewMode('roles')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
              viewMode === 'roles'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Shield className="w-5 h-5" />
            Roles
          </button>
          <button
            onClick={() => setViewMode('permissions')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
              viewMode === 'permissions'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Key className="w-5 h-5" />
            Permisos
          </button>
        </div>
      </div>

      {viewMode === 'roles' && <RolesManager />}
      {viewMode === 'permissions' && <PermissionsManager />}

      {viewMode === 'users' && (
        <>
          {!showForm && users.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, teléfono, rol o empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!editingUser && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="usuario@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Contraseña *
                    </label>
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="••••••••"
                      minLength={6}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Juan Pérez"
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="+52 123 456 7890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rol * <span className="text-xs text-gray-500 dark:text-gray-400">({getRoleDescription(formData.role)})</span>
                </label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {availableRoles.map(role => (
                    <option key={role.name} value={role.name}>
                      {getRoleLabel(role.name as UserRole)} {role.description ? `- ${role.description}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {profile?.role === 'root' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Empresa *
                  </label>
                  <select
                    required
                    value={formData.company_id}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Seleccionar empresa</option>
                    {companies.map(company => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {profile?.role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sucursal
                  </label>
                  <select
                    value={formData.branch_id}
                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Todas las sucursales</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Si no seleccionas una sucursal, el usuario tendrá acceso a todas las sucursales de la empresa
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notas
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Información adicional sobre el usuario (certificaciones, instrucciones especiales, etc.)"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all font-medium"
              >
                {editingUser ? 'Actualizar' : 'Crear'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all font-medium"
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
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Teléfono
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Rol
                </th>
                {profile?.role === 'root' && (
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Empresa
                  </th>
                )}
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Estado
                </th>
                {hasPermission('manage_users') && (
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900 dark:text-white">{user.full_name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 dark:text-gray-300">{user.email || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 dark:text-gray-300">{user.phone || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  {profile?.role === 'root' && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Building2 className="w-4 h-4" />
                        {user.company?.name || 'Sin empresa'}
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    {user.is_active ? (
                      <span className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-full w-fit">
                        <CheckCircle className="w-3 h-3" />
                        Activo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded-full w-fit">
                        <XCircle className="w-3 h-3" />
                        Inactivo
                      </span>
                    )}
                  </td>
                  {hasPermission('manage_users') && (
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </button>
                        <button
                          onClick={() => toggleStatus(user)}
                          className={`px-3 py-1 rounded-lg transition-all text-xs font-medium ${
                            user.is_active
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                          }`}
                          title={user.is_active ? 'Desactivar' : 'Activar'}
                        >
                          {user.is_active ? 'Desactivar' : 'Activar'}
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

      {filteredUsers.length === 0 && !showForm && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <UserCog className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Comienza agregando tu primer usuario'}
          </p>
          {!searchTerm && hasPermission('manage_users') && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium"
            >
              <Plus className="w-5 h-5" />
              Nuevo Usuario
            </button>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
}