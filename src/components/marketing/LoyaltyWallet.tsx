import { useEffect, useState } from 'react';
import { Plus, Settings, User, TrendingUp, TrendingDown, Clock, Search, Coins, Gift, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../lib/database.types';

type LoyaltyProgram = Database['public']['Tables']['loyalty_programs']['Row'];
type CustomerWallet = Database['public']['Tables']['customer_wallets']['Row'];
type WalletTransaction = Database['public']['Tables']['wallet_transactions']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];

interface WalletWithCustomer extends CustomerWallet {
  customer: Customer;
}

interface TransactionWithDetails extends WalletTransaction {
  customer: Customer;
}

type View = 'program' | 'wallets' | 'transactions';

export function LoyaltyWallet() {
  const { profile } = useAuth();
  const [activeView, setActiveView] = useState<View>('program');
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [wallets, setWallets] = useState<WalletWithCustomer[]>([]);
  const [filteredWallets, setFilteredWallets] = useState<WalletWithCustomer[]>([]);
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [programData, setProgramData] = useState({
    name: '',
    description: '',
    points_per_currency: 1,
    currency_per_point: 1,
    min_points_redeem: 100,
    expiration_days: '',
  });
  const [transactionData, setTransactionData] = useState({
    customer_id: '',
    transaction_type: 'earn' as 'earn' | 'redeem' | 'adjust',
    points: 0,
    description: '',
  });
  const [error, setError] = useState('');

  const isAdmin = profile?.role === 'admin';
  const canManage = isAdmin || profile?.role === 'manager';

  useEffect(() => {
    loadData();
  }, [profile]);

  useEffect(() => {
    filterWallets();
  }, [wallets, searchTerm]);

  const loadData = async () => {
    try {
      await Promise.all([loadProgram(), loadWallets(), loadTransactions(), loadCustomers()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProgram = async () => {
    try {
      const { data, error } = await supabase
        .from('loyalty_programs')
        .select('*')
        .eq('company_id', profile?.company_id!)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      setProgram(data);
    } catch (error) {
      console.error('Error loading program:', error);
    }
  };

  const loadWallets = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_wallets')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('company_id', profile?.company_id!)
        .order('total_points', { ascending: false });

      if (error) throw error;
      setWallets(data as WalletWithCustomer[] || []);
    } catch (error) {
      console.error('Error loading wallets:', error);
    }
  };

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('company_id', profile?.company_id!)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setTransactions(data as TransactionWithDetails[] || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', profile?.company_id!)
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const filterWallets = () => {
    if (!searchTerm) {
      setFilteredWallets(wallets);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = wallets.filter(wallet =>
      wallet.customer.full_name.toLowerCase().includes(term) ||
      wallet.customer.email?.toLowerCase().includes(term) ||
      wallet.customer.phone?.toLowerCase().includes(term)
    );
    setFilteredWallets(filtered);
  };

  const handleProgramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isAdmin) {
      setError('Solo administradores pueden gestionar programas de fidelidad');
      return;
    }

    try {
      if (program) {
        const { error } = await supabase
          .from('loyalty_programs')
          .update({
            name: programData.name,
            description: programData.description,
            points_per_currency: programData.points_per_currency,
            currency_per_point: programData.currency_per_point,
            min_points_redeem: programData.min_points_redeem,
            expiration_days: programData.expiration_days ? parseInt(programData.expiration_days) : null,
          })
          .eq('id', program.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('loyalty_programs')
          .insert({
            company_id: profile?.company_id!,
            name: programData.name,
            description: programData.description,
            points_per_currency: programData.points_per_currency,
            currency_per_point: programData.currency_per_point,
            min_points_redeem: programData.min_points_redeem,
            expiration_days: programData.expiration_days ? parseInt(programData.expiration_days) : null,
          });

        if (error) throw error;
      }

      setShowProgramForm(false);
      loadProgram();
    } catch (error: any) {
      console.error('Error saving program:', error);
      setError(error.message || 'Error al guardar el programa');
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!canManage) {
      setError('No tienes permisos para realizar transacciones');
      return;
    }

    try {
      let wallet = wallets.find(w => w.customer_id === transactionData.customer_id);

      if (!wallet) {
        const { data: newWallet, error: walletError } = await supabase
          .from('customer_wallets')
          .insert({
            customer_id: transactionData.customer_id,
            company_id: profile?.company_id!,
            loyalty_program_id: program?.id || null,
          })
          .select()
          .single();

        if (walletError) throw walletError;
        wallet = newWallet;
      }

      const points = transactionData.transaction_type === 'redeem'
        ? -Math.abs(transactionData.points)
        : Math.abs(transactionData.points);

      const newAvailablePoints = (wallet.available_points || 0) + points;
      const newTotalPoints = (wallet.total_points || 0) + points;
      const newLifetimePoints = transactionData.transaction_type === 'earn'
        ? (wallet.lifetime_points || 0) + points
        : wallet.lifetime_points;

      if (newAvailablePoints < 0) {
        throw new Error('El cliente no tiene suficientes puntos disponibles');
      }

      const { error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert({
          wallet_id: wallet.id,
          customer_id: transactionData.customer_id,
          company_id: profile?.company_id!,
          transaction_type: transactionData.transaction_type,
          points: points,
          balance_after: newAvailablePoints,
          description: transactionData.description,
          created_by: profile?.id!,
          expires_at: transactionData.transaction_type === 'earn' && program?.expiration_days
            ? new Date(Date.now() + program.expiration_days * 24 * 60 * 60 * 1000).toISOString()
            : null,
        });

      if (transactionError) throw transactionError;

      const { error: updateError } = await supabase
        .from('customer_wallets')
        .update({
          available_points: newAvailablePoints,
          total_points: newTotalPoints,
          lifetime_points: newLifetimePoints,
        })
        .eq('id', wallet.id);

      if (updateError) throw updateError;

      setShowTransactionForm(false);
      setTransactionData({
        customer_id: '',
        transaction_type: 'earn',
        points: 0,
        description: '',
      });
      loadWallets();
      loadTransactions();
    } catch (error: any) {
      console.error('Error processing transaction:', error);
      setError(error.message || 'Error al procesar la transacción');
    }
  };

  const editProgram = () => {
    if (!program) return;
    setProgramData({
      name: program.name,
      description: program.description || '',
      points_per_currency: Number(program.points_per_currency),
      currency_per_point: Number(program.currency_per_point),
      min_points_redeem: program.min_points_redeem,
      expiration_days: program.expiration_days?.toString() || '',
    });
    setShowProgramForm(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveView('program')}
          className={`px-4 py-2 border-b-2 font-medium text-sm transition-all ${
            activeView === 'program'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configuración
          </div>
        </button>
        <button
          onClick={() => setActiveView('wallets')}
          className={`px-4 py-2 border-b-2 font-medium text-sm transition-all ${
            activeView === 'wallets'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4" />
            Monederos
          </div>
        </button>
        <button
          onClick={() => setActiveView('transactions')}
          className={`px-4 py-2 border-b-2 font-medium text-sm transition-all ${
            activeView === 'transactions'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Historial
          </div>
        </button>
      </div>

      {activeView === 'program' && (
        <div className="space-y-6">
          {!program && !showProgramForm ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
              <Award className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No hay programa de fidelidad configurado
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Crea un programa de puntos para recompensar a tus clientes
              </p>
              {isAdmin && (
                <button
                  onClick={() => setShowProgramForm(true)}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Crear Programa
                </button>
              )}
            </div>
          ) : showProgramForm ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                {program ? 'Editar Programa' : 'Nuevo Programa de Fidelidad'}
              </h3>
              <form onSubmit={handleProgramSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nombre del Programa *
                    </label>
                    <input
                      type="text"
                      required
                      value={programData.name}
                      onChange={(e) => setProgramData({ ...programData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                      placeholder="Programa de Puntos VIP"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Descripción
                    </label>
                    <textarea
                      value={programData.description}
                      onChange={(e) => setProgramData({ ...programData, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                      placeholder="Gana puntos con cada compra y canjéalos por descuentos"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Puntos por cada $1 gastado *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={programData.points_per_currency}
                      onChange={(e) => setProgramData({ ...programData, points_per_currency: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Valor de cada punto en $ *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={programData.currency_per_point}
                      onChange={(e) => setProgramData({ ...programData, currency_per_point: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Mínimo de puntos para canjear *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={programData.min_points_redeem}
                      onChange={(e) => setProgramData({ ...programData, min_points_redeem: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Días de expiración (vacío = sin expiración)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={programData.expiration_days}
                      onChange={(e) => setProgramData({ ...programData, expiration_days: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                      placeholder="365"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all font-medium"
                  >
                    {program ? 'Actualizar' : 'Crear Programa'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProgramForm(false)}
                    className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          ) : program && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{program.name}</h3>
                  {program.description && (
                    <p className="text-gray-600 dark:text-gray-300 mt-1">{program.description}</p>
                  )}
                </div>
                {isAdmin && (
                  <button
                    onClick={editProgram}
                    className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-all"
                  >
                    <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Ganancia de Puntos</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {program.points_per_currency} pts
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">por cada $1 gastado</div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Valor del Punto</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(Number(program.currency_per_point))}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">por punto</div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Mínimo Canje</div>
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {program.min_points_redeem}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">puntos mínimos</div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Expiración</div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {program.expiration_days || '∞'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {program.expiration_days ? 'días' : 'sin expiración'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeView === 'wallets' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Monederos de Clientes</h3>
              <p className="text-sm text-gray-600">Gestiona los puntos de fidelidad</p>
            </div>
            {canManage && (
              <button
                onClick={() => setShowTransactionForm(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium"
              >
                <Plus className="w-5 h-5" />
                Registrar Transacción
              </button>
            )}
          </div>

          {showTransactionForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                Nueva Transacción
              </h3>
              <form onSubmit={handleTransactionSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cliente *
                    </label>
                    <select
                      required
                      value={transactionData.customer_id}
                      onChange={(e) => setTransactionData({ ...transactionData, customer_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Seleccionar cliente</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.full_name} - {customer.email || customer.phone}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de Transacción *
                    </label>
                    <select
                      required
                      value={transactionData.transaction_type}
                      onChange={(e) => setTransactionData({ ...transactionData, transaction_type: e.target.value as any })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="earn">Ganar Puntos</option>
                      <option value="redeem">Canjear Puntos</option>
                      <option value="adjust">Ajuste Manual</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cantidad de Puntos *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={transactionData.points || ''}
                      onChange={(e) => setTransactionData({ ...transactionData, points: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descripción *
                    </label>
                    <input
                      type="text"
                      required
                      value={transactionData.description}
                      onChange={(e) => setTransactionData({ ...transactionData, description: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Por compra de $500"
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

          {wallets.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, email o teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWallets.map((wallet) => (
              <div key={wallet.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{wallet.customer.full_name}</h4>
                      <p className="text-sm text-gray-600">{wallet.customer.email || wallet.customer.phone}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Puntos Disponibles</div>
                    <div className="text-3xl font-bold text-blue-600">
                      {wallet.available_points.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      ≈ {formatCurrency(wallet.available_points * Number(program?.currency_per_point || 0))}
                    </div>
                  </div>

                  <div className="flex gap-2 text-sm">
                    <div className="flex-1 bg-gray-50 rounded p-2">
                      <div className="text-xs text-gray-600">Total</div>
                      <div className="font-semibold text-gray-900">{wallet.total_points.toLocaleString()}</div>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded p-2">
                      <div className="text-xs text-gray-600">Histórico</div>
                      <div className="font-semibold text-gray-900">{wallet.lifetime_points.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredWallets.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
              <Coins className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchTerm ? 'No se encontraron monederos' : 'No hay monederos registrados'}
              </h3>
              <p className="text-gray-600">
                {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Los monederos se crean automáticamente al registrar transacciones'}
              </p>
            </div>
          )}
        </div>
      )}

      {activeView === 'transactions' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Historial de Transacciones</h3>
            <p className="text-sm text-gray-600">Últimas 100 transacciones</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Puntos
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Balance
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Descripción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(transaction.created_at).toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{transaction.customer.full_name}</div>
                        <div className="text-xs text-gray-500">{transaction.customer.email || transaction.customer.phone}</div>
                      </td>
                      <td className="px-6 py-4">
                        {transaction.transaction_type === 'earn' && (
                          <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full w-fit">
                            <TrendingUp className="w-3 h-3" />
                            Ganancia
                          </span>
                        )}
                        {transaction.transaction_type === 'redeem' && (
                          <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full w-fit">
                            <TrendingDown className="w-3 h-3" />
                            Canje
                          </span>
                        )}
                        {transaction.transaction_type === 'adjust' && (
                          <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full w-fit">
                            <Settings className="w-3 h-3" />
                            Ajuste
                          </span>
                        )}
                        {transaction.transaction_type === 'expire' && (
                          <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full w-fit">
                            <Clock className="w-3 h-3" />
                            Expiración
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-semibold ${
                          transaction.points > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.points > 0 ? '+' : ''}{transaction.points.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {transaction.balance_after.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {transaction.description || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {transactions.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
              <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No hay transacciones registradas
              </h3>
              <p className="text-gray-600">
                Las transacciones aparecerán aquí cuando se registren movimientos de puntos
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
