import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { useState } from 'react';

export function TrialBanner() {
  const { profile, session } = useAuth();
  const [loading, setLoading] = useState(false);

  // Cast profile to any to access the joined company data
  const company = (profile as any)?.company;

  if (!company) return null;

  // Only show for trialing status
  if (company.subscription_status !== 'trialing') return null;

  const endDate = new Date(company.subscription_end_date);
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // If expired, the blocking screen will handle it. We only show if days > 0
  if (daysRemaining <= 0) return null;

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // Get fresh session to ensure token is valid
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !currentSession?.access_token) {
        console.error('Session error:', sessionError);
        alert('Su sesión ha expirado. Por favor, inicie sesión nuevamente.');
        setLoading(false);
        return;
      }

      console.log('Initiating checkout session with token:', currentSession.access_token.substring(0, 10) + '...');
      
      // Call the edge function to create a checkout session
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          companyId: company.id,
          email: profile?.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Checkout session error:', response.status, errorData);
        throw new Error(errorData.error || errorData.message || 'Error del servidor');
      }

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
    <div className="bg-indigo-600 text-white px-4 py-3 shadow-md relative z-50">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-300 animate-pulse" />
          <p className="font-medium">
            <span className="font-bold text-yellow-300">{daysRemaining} días</span> restantes de tu prueba gratuita.
            {!loading && " Suscríbete ahora para evitar interrupciones."}
          </p>
        </div>
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="bg-white text-indigo-600 px-4 py-1.5 rounded-full font-bold text-sm hover:bg-indigo-50 transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-75 disabled:cursor-not-allowed"
        >
          <CreditCard className="w-4 h-4" />
          {loading ? 'Procesando...' : 'Suscribirse ($20/mes)'}
        </button>
      </div>
    </div>
  );
}
