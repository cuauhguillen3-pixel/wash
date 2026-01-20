import { useEffect, useState } from 'react';
import { Plus, DollarSign, TrendingUp, TrendingDown, X, Check, Calendar, CreditCard, Wallet, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../lib/database.types';

type CashRegister = Database['public']['Tables']['cash_registers']['Row'];
type Transaction = Database['public']['Tables']['transactions']['Row'];
type ExpenseCategory = Database['public']['Tables']['expense_categories']['Row'];
type IncomeCategory = Database['public']['Tables']['income_categories']['Row'];

interface TransactionWithCategory extends Transaction {
  expense_category?: ExpenseCategory;
  income_category?: IncomeCategory;
}

export function CashFlowManager() {
  const { profile } = useAuth();
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null);
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showOpenRegisterForm, setShowOpenRegisterForm] = useState(false);
  const [showCloseRegisterForm, setShowCloseRegisterForm] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [closingBalance, setClosingBalance] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');

  const [transactionForm, setTransactionForm] = useState({
    type: 'income' as 'income' | 'expense',
    category_id: '',
    amount: '',
    payment_method: 'cash' as 'cash' | 'card' | 'transfer' | 'other',
    description: '',
    notes: '',
  });

  const canManage = profile?.role && ['admin', 'manager', 'cashier'].includes(profile.role);

  useEffect(() => {
    loadData();
  }, [profile, selectedDate]);

  const loadData = async () => {
    try {
      await Promise.all([
        loadCashRegister(),
        loadTransactions(),
        loadCategories(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCashRegister = async () => {
    try {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('company_id', profile?.company_id!)
        .gte('opened_at', startOfDay.toISOString())
        .lte('opened_at', endOfDay.toISOString())
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setCashRegister(data);
    } catch (error) {
      console.error('Error loading cash register:', error);
    }
  };

  const loadTransactions = async () => {
    try {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('company_id', profile?.company_id!)
        .gte('transaction_date', startOfDay.toISOString())
        .lte('transaction_date', endOfDay.toISOString())
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setTransactions(data as TransactionWithCategory[] || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const [expenseRes, incomeRes] = await Promise.all([
        supabase
          .from('expense_categories')
          .select('*')
          .eq('company_id', profile?.company_id!)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('income_categories')
          .select('*')
          .eq('company_id', profile?.company_id!)
          .eq('is_active', true)
          .order('name'),
      ]);

      if (expenseRes.error) throw expenseRes.error;
      if (incomeRes.error) throw incomeRes.error;

      setExpenseCategories(expenseRes.data || []);
      setIncomeCategories(incomeRes.data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const { error } = await supabase
        .from('cash_registers')
        .insert({
          company_id: profile?.company_id!,
          opened_by: profile?.id!,
          opening_balance: parseFloat(openingBalance),
          status: 'open',
        });

      if (error) throw error;

      setShowOpenRegisterForm(false);
      setOpeningBalance('0');
      loadCashRegister();
    } catch (error: any) {
      console.error('Error opening register:', error);
      setError(error.message || 'Error al abrir la caja');
    }
  };

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!cashRegister) return;

    try {
      const totalIncome = transactions
        .filter(t => t.type === 'income' && t.payment_method === 'cash')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalExpenses = transactions
        .filter(t => t.type === 'expense' && t.payment_method === 'cash')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const expectedBalance = Number(cashRegister.opening_balance) + totalIncome - totalExpenses;
      const actualBalance = parseFloat(closingBalance);
      const difference = actualBalance - expectedBalance;

      const { error } = await supabase
        .from('cash_registers')
        .update({
          closed_by: profile?.id!,
          closing_balance: actualBalance,
          expected_balance: expectedBalance,
          difference: difference,
          status: 'closed',
          closed_at: new Date().toISOString(),
        })
        .eq('id', cashRegister.id);

      if (error) throw error;

      setShowCloseRegisterForm(false);
      setClosingBalance('');
      loadCashRegister();
    } catch (error: any) {
      console.error('Error closing register:', error);
      setError(error.message || 'Error al cerrar la caja');
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!canManage) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .insert({
          company_id: profile?.company_id!,
          cash_register_id: cashRegister?.id,
          type: transactionForm.type,
          category_id: transactionForm.category_id || null,
          amount: parseFloat(transactionForm.amount),
          payment_method: transactionForm.payment_method,
          description: transactionForm.description,
          notes: transactionForm.notes || null,
          created_by: profile?.id!,
        });

      if (error) throw error;

      setShowTransactionForm(false);
      resetTransactionForm();
      loadTransactions();
    } catch (error: any) {
      console.error('Error creating transaction:', error);
      setError(error.message || 'Error al crear la transacción');
    }
  };

  const resetTransactionForm = () => {
    setTransactionForm({
      type: 'income',
      category_id: '',
      amount: '',
      payment_method: 'cash',
      description: '',
      notes: '',
    });
    setError('');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const netCashFlow = totalIncome - totalExpenses;

  const filteredTransactions = transactions.filter(t => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return t.description.toLowerCase().includes(term) ||
           t.reference?.toLowerCase().includes(term);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 dark:text-gray-400">Ingresos del Día</span>
            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalIncome)}</div>
          <div className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
            <Plus className="w-4 h-4" />
            {filteredTransactions.filter(t => t.type === 'income').length} transacciones
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 dark:text-gray-400">Gastos del Día</span>
            <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalExpenses)}</div>
          <div className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
            <TrendingDown className="w-4 h-4" />
            {filteredTransactions.filter(t => t.type === 'expense').length} transacciones
          </div>
        </div>

        <div className={`rounded-xl p-6 text-white shadow-lg ${
          netCashFlow >= 0
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700'
            : 'bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-100">Flujo Neto</span>
            <DollarSign className="w-6 h-6" />
          </div>
          <div className="text-3xl font-bold">{formatCurrency(netCashFlow)}</div>
          <div className="text-sm text-blue-100 mt-1">
            {netCashFlow >= 0 ? 'Positivo' : 'Negativo'}
          </div>
        </div>
      </div>

      {cashRegister && cashRegister.status === 'open' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wallet className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">Caja Abierta</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Balance inicial: {formatCurrency(Number(cashRegister.opening_balance))}
                </div>
              </div>
            </div>
            {canManage && (
              <button
                onClick={() => setShowCloseRegisterForm(true)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-all"
              >
                Cerrar Caja
              </button>
            )}
          </div>
        </div>
      )}

      {(!cashRegister || cashRegister.status === 'closed') && (
        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wallet className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">Caja Cerrada</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {cashRegister ? `Cerrada el ${new Date(cashRegister.closed_at!).toLocaleString('es-MX')}` : 'No hay caja abierta para esta fecha'}
                </div>
              </div>
            </div>
            {canManage && new Date(selectedDate).toDateString() === new Date().toDateString() && (
              <button
                onClick={() => setShowOpenRegisterForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all"
              >
                Abrir Caja
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fecha
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex-1 relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Buscar
            </label>
            <Search className="absolute left-3 top-[42px] transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar transacciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
            />
          </div>
          {canManage && cashRegister?.status === 'open' && (
            <div className="flex items-end">
              <button
                onClick={() => setShowTransactionForm(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium whitespace-nowrap"
              >
                <Plus className="w-5 h-5" />
                Nueva Transacción
              </button>
            </div>
          )}
        </div>
      </div>

      {showOpenRegisterForm && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Abrir Caja</h3>
          <form onSubmit={handleOpenRegister} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Balance Inicial *
              </label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all font-medium"
              >
                Abrir Caja
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOpenRegisterForm(false);
                  setOpeningBalance('0');
                  setError('');
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-all font-medium"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {showCloseRegisterForm && cashRegister && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Cerrar Caja</h3>
          <form onSubmit={handleCloseRegister} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Balance Inicial:</span>
                <span className="font-semibold">{formatCurrency(Number(cashRegister.opening_balance))}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>+ Ingresos en Efectivo:</span>
                <span className="font-semibold">
                  {formatCurrency(transactions.filter(t => t.type === 'income' && t.payment_method === 'cash').reduce((sum, t) => sum + Number(t.amount), 0))}
                </span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>- Gastos en Efectivo:</span>
                <span className="font-semibold">
                  {formatCurrency(transactions.filter(t => t.type === 'expense' && t.payment_method === 'cash').reduce((sum, t) => sum + Number(t.amount), 0))}
                </span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="font-semibold text-gray-900">Balance Esperado:</span>
                <span className="font-bold text-lg">
                  {formatCurrency(Number(cashRegister.opening_balance) +
                    transactions.filter(t => t.type === 'income' && t.payment_method === 'cash').reduce((sum, t) => sum + Number(t.amount), 0) -
                    transactions.filter(t => t.type === 'expense' && t.payment_method === 'cash').reduce((sum, t) => sum + Number(t.amount), 0)
                  )}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Balance Real en Caja *
              </label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={closingBalance}
                onChange={(e) => setClosingBalance(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-all font-medium"
              >
                Cerrar Caja
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCloseRegisterForm(false);
                  setClosingBalance('');
                  setError('');
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-all font-medium"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {showTransactionForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Nueva Transacción</h3>
          <form onSubmit={handleTransactionSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo *
                </label>
                <select
                  value={transactionForm.type}
                  onChange={(e) => setTransactionForm({ ...transactionForm, type: e.target.value as 'income' | 'expense', category_id: '' })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="income">Ingreso</option>
                  <option value="expense">Gasto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Categoría
                </label>
                <select
                  value={transactionForm.category_id}
                  onChange={(e) => setTransactionForm({ ...transactionForm, category_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Sin categoría</option>
                  {transactionForm.type === 'expense'
                    ? expenseCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))
                    : incomeCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))
                  }
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Monto *
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  value={transactionForm.amount}
                  onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Método de Pago *
                </label>
                <select
                  value={transactionForm.payment_method}
                  onChange={(e) => setTransactionForm({ ...transactionForm, payment_method: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="transfer">Transferencia</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descripción *
                </label>
                <input
                  type="text"
                  required
                  value={transactionForm.description}
                  onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Descripción de la transacción"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notas
                </label>
                <textarea
                  value={transactionForm.notes}
                  onChange={(e) => setTransactionForm({ ...transactionForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all font-medium"
              >
                Registrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTransactionForm(false);
                  resetTransactionForm();
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-all font-medium dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transacciones del Día</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hora</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Descripción</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Método</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Monto</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No hay transacciones registradas para esta fecha
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {new Date(transaction.transaction_date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        transaction.type === 'income'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {transaction.type === 'income' ? (
                          <>
                            <TrendingUp className="w-3 h-3" />
                            Ingreso
                          </>
                        ) : (
                          <>
                            <TrendingDown className="w-3 h-3" />
                            Gasto
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {transaction.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        {transaction.payment_method === 'cash' && <Wallet className="w-4 h-4" />}
                        {transaction.payment_method === 'card' && <CreditCard className="w-4 h-4" />}
                        {transaction.payment_method === 'cash' ? 'Efectivo' :
                         transaction.payment_method === 'card' ? 'Tarjeta' :
                         transaction.payment_method === 'transfer' ? 'Transferencia' : 'Otro'}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-right font-semibold ${
                      transaction.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'} {formatCurrency(Number(transaction.amount))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
