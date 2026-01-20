import { useEffect, useState } from 'react';
import { Download, Calendar, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export function FinancialReports() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    incomeByCategory: [] as Array<{ category: string; amount: number }>,
    expensesByCategory: [] as Array<{ category: string; amount: number }>,
    transactionsByDay: [] as Array<{ date: string; income: number; expenses: number }>,
  });

  useEffect(() => {
    loadReport();
  }, [profile, startDate, endDate]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const [transactionsRes, incomeCatsRes, expenseCatsRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('company_id', profile?.company_id!)
          .gte('transaction_date', start.toISOString())
          .lte('transaction_date', end.toISOString()),
        supabase
          .from('income_categories')
          .select('*')
          .eq('company_id', profile?.company_id!),
        supabase
          .from('expense_categories')
          .select('*')
          .eq('company_id', profile?.company_id!),
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      const transactions = transactionsRes.data || [];
      const incomeCategories = incomeCatsRes.data || [];
      const expenseCategories = expenseCatsRes.data || [];

      const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalExpenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const incomeByCategory = incomeCategories.map(cat => {
        const amount = transactions
          .filter(t => t.type === 'income' && t.category_id === cat.id)
          .reduce((sum, t) => sum + Number(t.amount), 0);
        return { category: cat.name, amount };
      }).filter(item => item.amount > 0);

      const expensesByCategory = expenseCategories.map(cat => {
        const amount = transactions
          .filter(t => t.type === 'expense' && t.category_id === cat.id)
          .reduce((sum, t) => sum + Number(t.amount), 0);
        return { category: cat.name, amount };
      }).filter(item => item.amount > 0);

      const transactionsByDay: Array<{ date: string; income: number; expenses: number }> = [];
      const current = new Date(start);
      while (current <= end) {
        const dayStart = new Date(current);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(current);
        dayEnd.setHours(23, 59, 59, 999);

        const dayIncome = transactions
          .filter(t => {
            const tDate = new Date(t.transaction_date);
            return t.type === 'income' && tDate >= dayStart && tDate <= dayEnd;
          })
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const dayExpenses = transactions
          .filter(t => {
            const tDate = new Date(t.transaction_date);
            return t.type === 'expense' && tDate >= dayStart && tDate <= dayEnd;
          })
          .reduce((sum, t) => sum + Number(t.amount), 0);

        if (dayIncome > 0 || dayExpenses > 0) {
          transactionsByDay.push({
            date: current.toISOString().split('T')[0],
            income: dayIncome,
            expenses: dayExpenses,
          });
        }

        current.setDate(current.getDate() + 1);
      }

      setReport({
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
        incomeByCategory,
        expensesByCategory,
        transactionsByDay,
      });
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const exportToCSV = () => {
    const headers = ['Tipo', 'Monto'];
    const rows = [
      ['Ingresos Totales', report.totalIncome],
      ['Gastos Totales', report.totalExpenses],
      ['Utilidad Neta', report.netProfit],
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `estado_financiero_${startDate}_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Periodo del Reporte</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fecha Fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={exportToCSV}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-all shadow-md font-medium"
            >
              <Download className="w-5 h-5" />
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Ingresos Totales</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(report.totalIncome)}</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Gastos Totales</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(report.totalExpenses)}</div>
            </div>
          </div>
        </div>

        <div className={`rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${
          report.netProfit >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-lg ${
              report.netProfit >= 0 ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-orange-100 dark:bg-orange-900/40'
            }`}>
              <DollarSign className={`w-6 h-6 ${
                report.netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'
              }`} />
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Utilidad Neta</div>
              <div className={`text-2xl font-bold ${
                report.netProfit >= 0 ? 'text-blue-900 dark:text-blue-100' : 'text-orange-900 dark:text-orange-100'
              }`}>
                {formatCurrency(report.netProfit)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Estado de Resultados</h3>
        <div className="space-y-4">
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-700 dark:text-gray-300 font-medium">Ingresos</span>
              <span className="text-green-600 dark:text-green-400 font-semibold text-lg">{formatCurrency(report.totalIncome)}</span>
            </div>
          </div>

          <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-700 dark:text-gray-300 font-medium">Gastos Operativos</span>
              <span className="text-red-600 dark:text-red-400 font-semibold text-lg">({formatCurrency(report.totalExpenses)})</span>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-900 dark:text-white font-bold text-lg">Utilidad Neta</span>
              <span className={`font-bold text-2xl ${
                report.netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(report.netProfit)}
              </span>
            </div>
          </div>

          {report.netProfit >= 0 ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
              <p className="text-green-700 dark:text-green-400 font-medium">
                El negocio está generando utilidades en este periodo
              </p>
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
              <p className="text-red-700 dark:text-red-400 font-medium">
                Los gastos superan los ingresos en este periodo
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
