import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CreditCard, LogOut, ShieldCheck, Check } from 'lucide-react';

export function SubscriptionRequired() {
  const { signOut, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const company = (profile as any)?.company;

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          companyId: company?.id,
          email: profile?.email,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No checkout URL returned', data);
        alert('Error al iniciar el pago. Por favor contacte a soporte.');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Error de conexión. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-indigo-600 p-8 text-center">
          <ShieldCheck className="w-16 h-16 text-white mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-2">Periodo de Prueba Finalizado</h2>
          <p className="text-indigo-100">
            ¡Esperamos que hayas disfrutado tu mes gratis!
          </p>
        </div>

        <div className="p-8">
          <div className="text-center mb-8">
            <p className="text-gray-600 mb-6">
              Para continuar gestionando tu Car Wash sin interrupciones, activa tu suscripción mensual.
            </p>
            
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
              <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-2">Plan Pro Mensual</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-gray-900">$20</span>
                <span className="text-gray-500">/ mes</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 text-gray-700">
              <div className="bg-green-100 p-1 rounded-full">
                <Check className="w-4 h-4 text-green-600" />
              </div>
              <span>Acceso ilimitado a todas las funciones</span>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <div className="bg-green-100 p-1 rounded-full">
                <Check className="w-4 h-4 text-green-600" />
              </div>
              <span>Soporte técnico prioritario</span>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <div className="bg-green-100 p-1 rounded-full">
                <Check className="w-4 h-4 text-green-600" />
              </div>
              <span>Cancelación en cualquier momento</span>
            </div>
          </div>

          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center justify-center gap-2 mb-4 disabled:opacity-75"
          >
            <CreditCard className="w-6 h-6" />
            {loading ? 'Procesando...' : 'Activar Suscripción'}
          </button>

          <button
            onClick={() => signOut()}
            className="w-full text-gray-500 hover:text-gray-700 font-medium flex items-center justify-center gap-2 py-2"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </div>
      
      <p className="mt-8 text-center text-gray-400 text-sm">
        Pagos seguros procesados por Stripe
      </p>
    </div>
  );
}
