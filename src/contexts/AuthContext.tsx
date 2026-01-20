import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { hasPermission, type Permission } from '../lib/permissions';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null; deactivationMessage?: string }>;
  signUp: (email: string, password: string, fullName: string, role: UserProfile['role']) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  userPermissions: Record<string, boolean>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [deactivationError, setDeactivationError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*, company:companies(*)')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      // Verificar si el usuario tiene empresa y si está activa
      if (data && data.company_id && data.role !== 'root') {
        const companyData = (data as any).company;

        if (!companyData || !companyData.is_active) {
          // Empresa desactivada - cerrar sesión
          await supabase.auth.signOut();
          setProfile(null);
          setUserPermissions({});
          setLoading(false);

          // Construir mensaje detallado de desactivación
          let message = 'Tu empresa ha sido desactivada y no puedes acceder al sistema.';

          if (companyData?.deactivation_reason) {
            message += `\n\nMotivo: ${companyData.deactivation_reason}`;
          }

          if (companyData?.deactivated_at) {
            const deactivatedDate = new Date(companyData.deactivated_at);
            message += `\nFecha de desactivación: ${deactivatedDate.toLocaleString('es-MX', {
              dateStyle: 'long',
              timeStyle: 'short'
            })}`;
          }

          if (companyData?.subscription_end_date) {
            const endDate = new Date(companyData.subscription_end_date);
            message += `\nFecha de vencimiento: ${endDate.toLocaleDateString('es-MX', {
              dateStyle: 'long'
            })}`;
          }

          message += '\n\nContacta al administrador para más información.';

          setDeactivationError(message);
          throw new Error(message);
        }
      }

      setProfile(data);

      if (data) {
        await loadUserPermissions(data.role);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setProfile(null);
      setUserPermissions({});
    } finally {
      setLoading(false);
    }
  };

  const loadUserPermissions = async (roleName: string) => {
    try {
      const { data: roleData } = await supabase
        .from('roles')
        .select('id')
        .eq('name', roleName)
        .maybeSingle();

      if (!roleData) {
        setUserPermissions({});
        return;
      }

      const { data: permsData } = await supabase
        .from('role_permissions')
        .select(`
          permission_id,
          granted,
          permission:permissions(module, action)
        `)
        .eq('role_id', roleData.id)
        .eq('granted', true);

      const permissionsMap: Record<string, boolean> = {};

      if (permsData) {
        permsData.forEach((rp: any) => {
          if (rp.permission) {
            const key = `${rp.permission.module}.${rp.permission.action}`;
            permissionsMap[key] = rp.granted;
          }
        });
      }

      setUserPermissions(permissionsMap);
    } catch (error) {
      console.error('Error loading user permissions:', error);
      setUserPermissions({});
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setDeactivationError(null);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      // Esperar un momento para que loadProfile se ejecute y capture el error de desactivación
      await new Promise(resolve => setTimeout(resolve, 500));

      if (deactivationError) {
        return { error: null, deactivationMessage: deactivationError };
      }

      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: UserProfile['role']) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) return { error };

      if (data.user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: data.user.id,
            full_name: fullName,
            role: role,
          });

        if (profileError) {
          return { error: profileError as unknown as AuthError };
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUserPermissions({});
  };

  const checkPermission = (permission: Permission): boolean => {
    if (!profile) return false;
    return hasPermission(profile.role, permission, userPermissions);
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        hasPermission: checkPermission,
        userPermissions,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
