import { useState } from 'react';
import { DollarSign, Calculator, FileText, Receipt, FileCheck } from 'lucide-react';
import { CashFlowManager } from './CashFlowManager';
import { FinancialReports } from './FinancialReports';
import { TaxCompliance } from './TaxCompliance';
import { InvoiceRequests } from './InvoiceRequests';
import { useAuth } from '../../contexts/AuthContext';

type ViewMode = 'cash-flow' | 'reports' | 'invoices' | 'tax';

export function AccountingManager() {
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('cash-flow');

  const isRoot = profile?.role === 'root';

  if (isRoot) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg p-6 text-center">
          <Calculator className="w-16 h-16 text-yellow-600 dark:text-yellow-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Acceso Restringido
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            La gestión de contabilidad no está disponible para usuarios root.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Contabilidad y Finanzas</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestiona las finanzas de tu negocio</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <button
            onClick={() => setViewMode('cash-flow')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
              viewMode === 'cash-flow'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <DollarSign className="w-5 h-5" />
            Caja e Ingresos/Gastos
          </button>
          <button
            onClick={() => setViewMode('reports')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
              viewMode === 'reports'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <FileText className="w-5 h-5" />
            Estados Financieros
          </button>
          <button
            onClick={() => setViewMode('invoices')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
              viewMode === 'invoices'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <FileCheck className="w-5 h-5" />
            Facturas
          </button>
          <button
            onClick={() => setViewMode('tax')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
              viewMode === 'tax'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <Receipt className="w-5 h-5" />
            Impuestos
          </button>
        </div>
      </div>

      {viewMode === 'cash-flow' && <CashFlowManager />}
      {viewMode === 'reports' && <FinancialReports />}
      {viewMode === 'invoices' && <InvoiceRequests />}
      {viewMode === 'tax' && <TaxCompliance />}
    </div>
  );
}
