import { DollarSign } from 'lucide-react';

export function CashManager() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Caja</h2>
        <p className="text-gray-600 mt-1">Gestión de caja y cortes</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <DollarSign className="w-20 h-20 text-gray-300 mx-auto mb-4" />
        <h3 className="text-2xl font-semibold text-gray-900 mb-2">
          Módulo de Caja
        </h3>
        <p className="text-gray-600 mb-4">
          Apertura, cierre y cortes de caja en desarrollo
        </p>
        <div className="text-sm text-gray-500">
          Funcionalidad disponible próximamente
        </div>
      </div>
    </div>
  );
}
