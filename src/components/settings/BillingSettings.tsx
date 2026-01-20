import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CreditCard, Calendar, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { formatDate } from '../../lib/utils';

export function BillingSettings() {
  const { profile, session } = useAuth();
  const [loading, setLoading] = useState(false);
  const company = (profile as any)?.company;

  if (!company) return null;

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      if (!session?.access_token) {
        alert('Sesión no válida. Por favor recargue la página.');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          companyId: company.id,
          email: profile?.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al iniciar suscripción');
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Error al iniciar el pago.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      case 'trialing': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
      case 'canceled': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'past_due': return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Activa';
      case 'trialing': return 'Prueba Gratuita';
      case 'canceled': return 'Cancelada';
      case 'past_due': return 'Pago Pendiente';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Estado de la Suscripción
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Plan Actual</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white capitalize">
              {company.subscription_type || 'Estándar'} ($20/mes)
            </p>
          </div>

          <div className={`p-4 rounded-lg border ${getStatusColor(company.subscription_status)} border-opacity-20`}>
            <p className="text-sm opacity-80 mb-1">Estado</p>
            <div className="flex items-center gap-2">
              {company.subscription_status === 'active' && <CheckCircle className="w-5 h-5" />}
              {company.subscription_status === 'trialing' && <Clock className="w-5 h-5" />}
              {company.subscription_status === 'canceled' && <XCircle className="w-5 h-5" />}
              {company.subscription_status === 'past_due' && <AlertTriangle className="w-5 h-5" />}
              <p className="text-xl font-bold capitalize">
                {getStatusLabel(company.subscription_status)}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Fecha de Inicio</p>
            <div className="flex items-center gap-2 text-gray-900 dark:text-white">
              <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <p className="font-medium">
                {company.subscription_start_date 
                  ? formatDate(company.subscription_start_date) 
                  : '-'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {company.subscription_status === 'trialing' ? 'Fin de la Prueba' : 'Próxima Renovación'}
            </p>
            <div className="flex items-center gap-2 text-gray-900 dark:text-white">
              <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <p className="font-medium">
                {company.subscription_end_date 
                  ? formatDate(company.subscription_end_date) 
                  : '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
          {(company.subscription_status === 'trialing' || 
            company.subscription_status === 'canceled' || 
            company.subscription_status === 'past_due') && (
            <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
              <div>
                <h4 className="font-medium text-indigo-900 dark:text-indigo-300">Activar Suscripción Premium</h4>
                <p className="text-sm text-indigo-700 dark:text-indigo-400 mt-1">
                  Obtén acceso ilimitado a todas las funciones por solo $20/mes.
                </p>
              </div>
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Procesando...' : 'Suscribirse Ahora'}
              </button>
            </div>
          )}

          {company.subscription_status === 'active' && (
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              Tu suscripción está activa. El próximo cobro se realizará automáticamente.
              {/* Future: Add Stripe Customer Portal link here */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
