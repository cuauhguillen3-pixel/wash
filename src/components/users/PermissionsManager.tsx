import { useEffect, useState } from 'react';
import { Shield, Check, X, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
}

interface Permission {
  id: string;
  module: string;
  action: string;
  description: string | null;
}

interface RolePermission {
  role_id: string;
  permission_id: string;
  granted: boolean;
}

const MODULE_NAMES: Record<string, string> = {
  dashboard: 'Panel Principal',
  orders: 'Órdenes de Servicio',
  customers: 'Clientes',
  vehicles: 'Vehículos',
  services: 'Servicios y Paquetes',
  inventory: 'Inventario',
  staff: 'Personal',
  users: 'Usuarios del Sistema',
  branches: 'Sucursales',
  companies: 'Empresas',
  accounting: 'Contabilidad',
  reports: 'Reportes',
  marketing: 'Marketing',
  appointments: 'Citas',
  cash: 'Caja',
};

export function PermissionsManager() {
  const { profile } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Map<string, boolean>>(new Map());

  const isAdmin = profile?.role && ['admin', 'root'].includes(profile.role);

  useEffect(() => {
    loadData();
  }, [profile]);

  useEffect(() => {
    if (selectedRole) {
      loadRolePermissions(selectedRole);
    }
  }, [selectedRole]);

  const loadData = async () => {
    try {
      let rolesQuery = supabase
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('level', { ascending: false });

      if (profile?.role === 'root') {
        rolesQuery = rolesQuery.or(`company_id.eq.${profile?.company_id},company_id.is.null`);
      } else if (profile?.role === 'admin') {
        const { data: currentRole } = await supabase
          .from('roles')
          .select('level')
          .eq('name', profile.role)
          .maybeSingle();

        const userLevel = currentRole?.level || 90;

        rolesQuery = rolesQuery
          .or(`company_id.eq.${profile?.company_id},company_id.is.null`)
          .lt('level', userLevel);
      }

      const [rolesRes, permissionsRes] = await Promise.all([
        rolesQuery,
        supabase
          .from('permissions')
          .select('*')
          .order('module, action'),
      ]);

      if (rolesRes.error) throw rolesRes.error;
      if (permissionsRes.error) throw permissionsRes.error;

      setRoles(rolesRes.data || []);
      setPermissions(permissionsRes.data || []);

      if (rolesRes.data && rolesRes.data.length > 0) {
        setSelectedRole(rolesRes.data[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRolePermissions = async (roleId: string) => {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role_id', roleId);

      if (error) throw error;
      setRolePermissions(data || []);
      setChanges(new Map());
    } catch (error) {
      console.error('Error loading role permissions:', error);
    }
  };

  const hasPermission = (permissionId: string): boolean => {
    if (changes.has(permissionId)) {
      return changes.get(permissionId)!;
    }
    return rolePermissions.some(rp => rp.permission_id === permissionId && rp.granted);
  };

  const togglePermission = (permissionId: string) => {
    if (!isAdmin) return;
    const currentValue = hasPermission(permissionId);
    const newChanges = new Map(changes);
    newChanges.set(permissionId, !currentValue);
    setChanges(newChanges);
  };

  const savePermissions = async () => {
    if (!isAdmin || !selectedRole) return;
    setSaving(true);

    try {
      const updates: any[] = [];
      const inserts: any[] = [];
      const deletes: string[] = [];

      changes.forEach((granted, permissionId) => {
        const existing = rolePermissions.find(rp => rp.permission_id === permissionId);

        if (existing) {
          if (granted) {
            updates.push({
              role_id: selectedRole,
              permission_id: permissionId,
              granted: true,
            });
          } else {
            deletes.push(permissionId);
          }
        } else if (granted) {
          inserts.push({
            role_id: selectedRole,
            permission_id: permissionId,
            granted: true,
          });
        }
      });

      if (deletes.length > 0) {
        await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', selectedRole)
          .in('permission_id', deletes);
      }

      if (inserts.length > 0) {
        await supabase
          .from('role_permissions')
          .insert(inserts);
      }

      if (updates.length > 0) {
        for (const update of updates) {
          await supabase
            .from('role_permissions')
            .upsert(update, { onConflict: 'role_id,permission_id' });
        }
      }

      await loadRolePermissions(selectedRole);
      alert('Permisos actualizados correctamente');
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      alert(error.message || 'Error al guardar los permisos');
    } finally {
      setSaving(false);
    }
  };

  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

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
        <p className="text-gray-600">Solo los administradores pueden gestionar permisos.</p>
      </div>
    );
  }

  const selectedRoleData = roles.find(r => r.id === selectedRole);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Permisos por Rol</h3>
          <p className="text-gray-600 text-sm mt-1">Define qué puede hacer cada rol en el sistema</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <label className="text-sm font-medium text-gray-700">Seleccionar Rol:</label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name} {role.description ? `- ${role.description}` : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedRoleData?.is_system_role && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              Este es un rol del sistema. Los cambios en sus permisos pueden afectar el funcionamiento de la aplicación.
            </p>
          </div>
        )}

        {changes.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <p className="text-sm text-blue-800">
              Tienes {changes.size} cambio(s) sin guardar
            </p>
            <button
              onClick={savePermissions}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        )}

        <div className="space-y-6">
          {Object.entries(groupedPermissions).map(([module, perms]) => (
            <div key={module} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <h4 className="font-semibold text-gray-900">{MODULE_NAMES[module] || module}</h4>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {perms.map((perm) => {
                    const isGranted = hasPermission(perm.id);
                    return (
                      <button
                        key={perm.id}
                        onClick={() => togglePermission(perm.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                          isGranted
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                          isGranted ? 'bg-green-500' : 'bg-gray-200'
                        }`}>
                          {isGranted ? (
                            <Check className="w-4 h-4 text-white" />
                          ) : (
                            <X className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <div className={`text-sm font-medium ${
                            isGranted ? 'text-green-900' : 'text-gray-700'
                          }`}>
                            {perm.action}
                          </div>
                          {perm.description && (
                            <div className={`text-xs ${
                              isGranted ? 'text-green-700' : 'text-gray-500'
                            }`}>
                              {perm.description}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {roles.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay roles disponibles</h3>
          <p className="text-gray-600">Crea roles en la sección de Roles primero</p>
        </div>
      )}
    </div>
  );
}
