import { useEffect, useState } from 'react';
import { Plus, CreditCard as Edit2, Building2, Phone, Mail, CheckCircle, XCircle, Calendar, Clock, AlertTriangle, Power, PowerOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../lib/database.types';

type Company = Database['public']['Tables']['companies']['Row'];
type CompanyInsert = Database['public']['Tables']['companies']['Insert'];

type SubscriptionType = 'anual' | 'mensual' | 'indeterminado';

export function CompaniesManager() {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState<Partial<CompanyInsert>>({
    name: '',
    legal_name: '',
    tax_id: '',
    address: '',
    phone: '',
    email: '',
    is_active: true,
  });
  const [subscriptionData, setSubscriptionData] = useState({
    subscription_type: 'anual' as SubscriptionType,
    subscription_end_date: '',
  });

  const isRoot = profile?.role === 'root';

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingCompany) {
        const { error } = await supabase
          .from('companies')
          .update(formData)
          .eq('id', editingCompany.id);

        if (error) throw error;
      } else {
        // Al crear nueva empresa, establecer suscripción de 1 año por defecto
        const startDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);

        const { error } = await supabase
          .from('companies')
          .insert({
            ...formData,
            subscription_type: 'anual',
            subscription_start_date: startDate.toISOString(),
            subscription_end_date: endDate.toISOString(),
            auto_deactivate: true,
          } as any);

        if (error) throw error;
      }

      setShowForm(false);
      setEditingCompany(null);
      setFormData({ name: '', legal_name: '', tax_id: '', address: '', phone: '', email: '', is_active: true });
      loadCompanies();
    } catch (error) {
      console.error('Error saving company:', error);
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormData(company);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingCompany(null);
    setFormData({ name: '', legal_name: '', tax_id: '', address: '', phone: '', email: '', is_active: true });
  };

  const handleToggleCompanyStatus = async (company: Company) => {
    if (!isRoot) return;

    try {
      const newStatus = !company.is_active;
      const updateData: any = {
        is_active: newStatus,
      };

      if (!newStatus) {
        // Desactivando
        const { data: { user } } = await supabase.auth.getUser();
        updateData.deactivation_reason = 'Desactivación manual';
        updateData.deactivated_at = new Date().toISOString();
        updateData.deactivated_by = user?.id;
      } else {
        // Reactivando
        updateData.deactivation_reason = null;
        updateData.deactivated_at = null;
        updateData.deactivated_by = null;
      }

      const { error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', company.id);

      if (error) throw error;
      await loadCompanies();
    } catch (error) {
      console.error('Error toggling company status:', error);
    }
  };

  const openSubscriptionModal = (company: Company) => {
    setSelectedCompany(company);
    const endDate = company.subscription_end_date
      ? new Date(company.subscription_end_date).toISOString().split('T')[0]
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    setSubscriptionData({
      subscription_type: (company.subscription_type as SubscriptionType) || 'anual',
      subscription_end_date: endDate,
    });
    setShowSubscriptionModal(true);
  };

  const handleUpdateSubscription = async () => {
    if (!selectedCompany || !isRoot) return;

    try {
      const updateData: any = {
        subscription_type: subscriptionData.subscription_type,
      };

      if (subscriptionData.subscription_type === 'indeterminado') {
        updateData.subscription_end_date = null;
        updateData.auto_deactivate = false;
      } else {
        updateData.subscription_end_date = new Date(subscriptionData.subscription_end_date).toISOString();
        updateData.auto_deactivate = true;

        // Si la nueva fecha es futura y la empresa está inactiva por expiración, reactivarla
        if (!selectedCompany.is_active &&
            selectedCompany.deactivation_reason === 'Suscripción expirada' &&
            new Date(subscriptionData.subscription_end_date) > new Date()) {
          updateData.is_active = true;
          updateData.deactivation_reason = null;
          updateData.deactivated_at = null;
        }
      }

      const { error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', selectedCompany.id);

      if (error) throw error;

      setShowSubscriptionModal(false);
      setSelectedCompany(null);
      await loadCompanies();
    } catch (error) {
      console.error('Error updating subscription:', error);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const getSubscriptionLabel = (type: string | null) => {
    const labels: Record<string, string> = {
      anual: 'Anual',
      mensual: 'Mensual',
      indeterminado: 'Indeterminado',
    };
    return labels[type || 'anual'] || 'Anual';
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
          <h2 className="text-3xl font-bold text-gray-900">Empresas</h2>
          <p className="text-gray-600 mt-1">Gestiona las empresas del sistema</p>
        </div>
        {!showForm && isRoot && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium"
          >
            <Plus className="w-5 h-5" />
            Nueva Empresa
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">
            {editingCompany ? 'Editar Empresa' : 'Nueva Empresa'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Comercial *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Carwash Express"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Razón Social
                </label>
                <input
                  type="text"
                  value={formData.legal_name || ''}
                  onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Carwash Express S.A. de C.V."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  RFC / Tax ID
                </label>
                <input
                  type="text"
                  value={formData.tax_id || ''}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ABC123456XYZ"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.phone || ''}
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
                  placeholder="contacto@empresa.com"
                />
              </div>

              {editingCompany && isRoot && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado
                  </label>
                  <select
                    value={formData.is_active ? 'true' : 'false'}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="true">Activa</option>
                    <option value="false">Inactiva</option>
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dirección Fiscal
              </label>
              <textarea
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Calle, Número, Colonia, Ciudad, Estado, CP"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all font-medium"
              >
                {editingCompany ? 'Actualizar' : 'Crear'}
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
        {companies.map((company) => {
          const daysRemaining = getDaysRemaining(company.subscription_end_date);
          const isExpiringSoon = daysRemaining !== null && daysRemaining <= 30 && daysRemaining > 0;
          const isExpired = daysRemaining !== null && daysRemaining < 0;

          return (
            <div
              key={company.id}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 hover:shadow-md transition-all ${
                isExpired ? 'border-red-300' : isExpiringSoon ? 'border-yellow-300' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">{company.name}</h3>
                  {company.legal_name && (
                    <p className="text-sm text-gray-600 mt-1">{company.legal_name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {company.is_active ? (
                      <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Activa
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                        <XCircle className="w-3 h-3" />
                        Inactiva
                      </span>
                    )}
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      {getSubscriptionLabel(company.subscription_type)}
                    </span>
                  </div>
                </div>
                {isRoot && (
                  <button
                    onClick={() => handleEdit(company)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                  >
                    <Edit2 className="w-5 h-5 text-gray-600" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {company.tax_id && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">RFC:</span> {company.tax_id}
                  </div>
                )}

                {company.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    <span>{company.phone}</span>
                  </div>
                )}

                {company.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <span>{company.email}</span>
                  </div>
                )}

                {company.subscription_type !== 'indeterminado' && company.subscription_end_date && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span className="font-medium">Vence:</span>
                      <span>{formatDate(company.subscription_end_date)}</span>
                    </div>
                    {daysRemaining !== null && (
                      <div className="flex items-center gap-2 text-sm mt-1">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span className={`font-medium ${
                          isExpired ? 'text-red-600' : isExpiringSoon ? 'text-yellow-600' : 'text-gray-600'
                        }`}>
                          {isExpired
                            ? `Expirado hace ${Math.abs(daysRemaining)} días`
                            : `${daysRemaining} días restantes`
                          }
                        </span>
                      </div>
                    )}
                    {isExpiringSoon && (
                      <div className="flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded mt-2">
                        <AlertTriangle className="w-3 h-3" />
                        Renovación próxima
                      </div>
                    )}
                  </div>
                )}

                {company.subscription_type === 'indeterminado' && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      Suscripción sin vencimiento
                    </div>
                  </div>
                )}

                {company.deactivation_reason && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                      {company.deactivation_reason}
                    </div>
                  </div>
                )}
              </div>

              {isRoot && (
                <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                  <button
                    onClick={() => openSubscriptionModal(company)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all text-sm font-medium"
                  >
                    <Calendar className="w-4 h-4" />
                    Suscripción
                  </button>
                  <button
                    onClick={() => handleToggleCompanyStatus(company)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
                      company.is_active
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {company.is_active ? (
                      <>
                        <PowerOff className="w-4 h-4" />
                        Desactivar
                      </>
                    ) : (
                      <>
                        <Power className="w-4 h-4" />
                        Activar
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {companies.length === 0 && !showForm && (
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No hay empresas registradas
          </h3>
          <p className="text-gray-600 mb-6">
            Comienza agregando tu primera empresa
          </p>
          {isRoot && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium"
            >
              <Plus className="w-5 h-5" />
              Nueva Empresa
            </button>
          )}
        </div>
      )}

      {showSubscriptionModal && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Gestionar Suscripción
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {selectedCompany.name}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Suscripción
                </label>
                <select
                  value={subscriptionData.subscription_type}
                  onChange={(e) => setSubscriptionData({
                    ...subscriptionData,
                    subscription_type: e.target.value as SubscriptionType,
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="anual">Anual</option>
                  <option value="mensual">Mensual</option>
                  <option value="indeterminado">Indeterminado</option>
                </select>
              </div>

              {subscriptionData.subscription_type !== 'indeterminado' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha de Vencimiento
                  </label>
                  <input
                    type="date"
                    value={subscriptionData.subscription_end_date}
                    onChange={(e) => setSubscriptionData({
                      ...subscriptionData,
                      subscription_end_date: e.target.value,
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  {subscriptionData.subscription_type === 'indeterminado'
                    ? 'La empresa no tendrá fecha de vencimiento y no se desactivará automáticamente.'
                    : 'La empresa se desactivará automáticamente cuando expire la suscripción.'
                  }
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateSubscription}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all font-medium"
              >
                Guardar
              </button>
              <button
                onClick={() => {
                  setShowSubscriptionModal(false);
                  setSelectedCompany(null);
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-all font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
