import { useEffect, useState } from 'react';
import { Shield, Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Role {
  id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  is_system_role: boolean;
  is_active: boolean;
  level: number;
  created_at: string;
}

export function RolesManager() {
  const { profile } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    level: 50,
  });
  const [error, setError] = useState('');

  const isAdmin = profile?.role && ['admin', 'root'].includes(profile.role);

  useEffect(() => {
    loadRoles();
  }, [profile]);

  const loadRoles = async () => {
    try {
      let query = supabase
        .from('roles')
        .select('*')
        .order('level', { ascending: false });

      if (profile?.role === 'root') {
        query = query.or(`company_id.eq.${profile?.company_id},company_id.is.null`);
      } else if (profile?.role === 'admin') {
        const { data: currentRole } = await supabase
          .from('roles')
          .select('level')
          .eq('name', profile.role)
          .maybeSingle();

        const userLevel = currentRole?.level || 90;

        query = query
          .or(`company_id.eq.${profile?.company_id},company_id.is.null`)
          .lt('level', userLevel);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRoles(data || []);
    } catch (error) {
      console.error('Error loading roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isAdmin) {
      setError('No tienes permisos para realizar esta acción');
      return;
    }

    if (profile?.role === 'admin') {
      const { data: currentRole } = await supabase
        .from('roles')
        .select('level')
        .eq('name', profile.role)
        .maybeSingle();

      const userLevel = currentRole?.level || 90;

      if (formData.level >= userLevel) {
        setError(`No puedes crear roles con nivel igual o superior a tu nivel (${userLevel})`);
        return;
      }
    }

    try {
      if (editingRole) {
        const { error } = await supabase
          .from('roles')
          .update({
            name: formData.name,
            description: formData.description,
            level: formData.level,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingRole.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('roles')
          .insert({
            company_id: profile?.company_id,
            name: formData.name,
            description: formData.description,
            level: formData.level,
            is_system_role: false,
            is_active: true,
          });

        if (error) throw error;
      }

      resetForm();
      loadRoles();
    } catch (error: any) {
      console.error('Error saving role:', error);
      setError(error.message || 'Error al guardar el rol');
    }
  };

  const deleteRole = async (roleId: string) => {
    if (!isAdmin) {
      alert('No tienes permisos para realizar esta acción');
      return;
    }

    if (!confirm('¿Estás seguro de eliminar este rol?')) return;

    try {
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;
      loadRoles();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      alert(error.message || 'Error al eliminar el rol');
    }
  };

  const toggleRoleStatus = async (roleId: string, currentStatus: boolean) => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from('roles')
        .update({ is_active: !currentStatus })
        .eq('id', roleId);

      if (error) throw error;
      loadRoles();
    } catch (error) {
      console.error('Error toggling role status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      level: 50,
    });
    setEditingRole(null);
    setShowForm(false);
    setError('');
  };

  const startEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      level: role.level,
    });
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <Shield className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Acceso Restringido</h3>
        <p className="text-gray-600">Solo los administradores pueden gestionar roles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Roles del Sistema</h3>
          <p className="text-gray-600 text-sm mt-1">Gestiona los roles y niveles de acceso</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nuevo Rol
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">
            {editingRole ? 'Editar Rol' : 'Nuevo Rol'}
          </h4>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del Rol *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="ej: Supervisor, Técnico Senior"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe las responsabilidades de este rol"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nivel de Acceso (1-{profile?.role === 'admin' ? '89' : '100'})
              </label>
              <input
                type="number"
                required
                min="1"
                max={profile?.role === 'admin' ? 89 : 100}
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Mayor nivel = más privilegios. {profile?.role === 'admin' ? 'Admin=90' : 'Root=100, Admin=90'}, Manager=70, Operator=50
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all"
              >
                {editingRole ? 'Actualizar Rol' : 'Crear Rol'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-all"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Rol</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Descripción</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase">Nivel</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase">Tipo</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase">Estado</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {roles.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-gray-900">{role.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{role.description || '-'}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {role.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      role.is_system_role
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {role.is_system_role ? 'Sistema' : 'Personalizado'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => toggleRoleStatus(role.id, role.is_active)}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                        role.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {role.is_active ? (
                        <>
                          <Check className="w-3 h-3" />
                          Activo
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3" />
                          Inactivo
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => startEdit(role)}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-all"
                        title="Editar rol"
                      >
                        <Edit2 className="w-4 h-4 text-blue-600" />
                      </button>
                      {!role.is_system_role && (
                        <button
                          onClick={() => deleteRole(role.id)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-all"
                          title="Eliminar rol"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {roles.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay roles configurados</h3>
          <p className="text-gray-600">Crea el primer rol personalizado para tu empresa</p>
        </div>
      )}
    </div>
  );
}
