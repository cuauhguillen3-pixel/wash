import { useEffect, useState } from 'react';
import { Plus, Search, Package, CreditCard as Edit2, AlertTriangle, ArrowUp, ArrowDown, RefreshCw, QrCode, Barcode, TrendingUp, TrendingDown, Filter, X, Camera, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CompanyFilter } from '../shared/CompanyFilter';
import type { Database } from '../../lib/database.types';

type Company = Database['public']['Tables']['companies']['Row'];

type Product = Database['public']['Tables']['inventory_products']['Row'];
type Movement = Database['public']['Tables']['inventory_movements']['Row'];
type Category = Database['public']['Tables']['product_categories']['Row'];

interface ProductWithCategory extends Product {
  category?: Category;
  company?: Company;
}

interface MovementWithDetails extends Movement {
  product: Product;
  user?: { full_name: string };
}

type MovementType = 'entrada' | 'salida' | 'ajuste';
type ViewMode = 'products' | 'movements' | 'alerts';

export function InventoryManager() {
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('products');
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductWithCategory[]>([]);
  const [movements, setMovements] = useState<MovementWithDetails[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<ProductWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedCompany, setSelectedCompany] = useState('');

  const isRoot = profile?.role === 'root';
  const [productFormData, setProductFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    sku: '',
    barcode: '',
    qr_code: '',
    photo_url: '',
    unit_of_measure: 'unidad',
    unit_cost: '',
    min_stock: '',
    max_stock: '',
    location: '',
  });
  const [movementFormData, setMovementFormData] = useState({
    product_id: '',
    movement_type: 'entrada' as MovementType,
    quantity: '',
    unit_cost: '',
    reason: '',
    notes: '',
  });
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
  });
  const [error, setError] = useState('');

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'operator';

  const unitOptions = [
    { value: 'unidad', label: 'Unidad' },
    { value: 'litro', label: 'Litro' },
    { value: 'galon', label: 'Galón' },
    { value: 'kilo', label: 'Kilogramo' },
    { value: 'metro', label: 'Metro' },
    { value: 'caja', label: 'Caja' },
    { value: 'paquete', label: 'Paquete' },
  ];

  const movementReasons: Record<MovementType, string[]> = {
    entrada: ['Compra', 'Devolución', 'Donación', 'Producción', 'Otro'],
    salida: ['Venta', 'Uso en servicio', 'Merma', 'Robo', 'Otro'],
    ajuste: ['Inventario físico', 'Corrección de error', 'Daño', 'Caducidad', 'Otro'],
  };

  useEffect(() => {
    loadData();
  }, [profile]);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, categoryFilter, selectedCompany]);

  const loadData = async () => {
    try {
      await Promise.all([
        loadProducts(),
        loadCategories(),
        loadMovements(),
        loadLowStockAlerts(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      let query = supabase
        .from('inventory_products')
        .select(`
          *,
          category:product_categories(*),
          company:companies(*)
        `)
        .order('name');

      if (!isRoot && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setProducts(data as ProductWithCategory[] || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('company_id', profile?.company_id!)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadMovements = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`
          *,
          product:inventory_products(*),
          user:user_profiles(full_name)
        `)
        .eq('company_id', profile?.company_id!)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setMovements(data as MovementWithDetails[] || []);
    } catch (error) {
      console.error('Error loading movements:', error);
    }
  };

  const loadLowStockAlerts = async () => {
    try {
      let query = supabase
        .from('inventory_products')
        .select(`
          *,
          category:product_categories(*),
          company:companies(*)
        `)
        .lte('current_stock', supabase.raw('min_stock'))
        .eq('is_active', true)
        .order('current_stock');

      if (!isRoot && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLowStockProducts(data as ProductWithCategory[] || []);
    } catch (error) {
      console.error('Error loading low stock alerts:', error);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    if (selectedCompany && isRoot) {
      filtered = filtered.filter(p => p.company_id === selectedCompany);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => p.category_id === categoryFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term) ||
        p.company?.name?.toLowerCase().includes(term)
      );
    }

    setFilteredProducts(filtered);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!canEdit) {
      setError('No tienes permisos para realizar esta acción');
      return;
    }

    try {
      const productData = {
        name: productFormData.name,
        description: productFormData.description || null,
        category_id: productFormData.category_id || null,
        sku: productFormData.sku || null,
        barcode: productFormData.barcode || null,
        qr_code: productFormData.qr_code || null,
        photo_url: productFormData.photo_url || null,
        unit_of_measure: productFormData.unit_of_measure,
        unit_cost: parseFloat(productFormData.unit_cost) || 0,
        min_stock: parseFloat(productFormData.min_stock) || 0,
        max_stock: productFormData.max_stock ? parseFloat(productFormData.max_stock) : null,
        location: productFormData.location || null,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('inventory_products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
      } else {
        let sku = productFormData.sku;
        if (!sku) {
          const { data: generatedSku } = await supabase.rpc('generate_sku', {
            p_company_id: profile?.company_id!
          });
          sku = generatedSku;
        }

        const { error } = await supabase
          .from('inventory_products')
          .insert({
            ...productData,
            sku,
            company_id: profile?.company_id!,
            current_stock: 0,
          });

        if (error) throw error;
      }

      setShowProductForm(false);
      setEditingProduct(null);
      resetProductForm();
      loadProducts();
      loadLowStockAlerts();
    } catch (error: any) {
      console.error('Error saving product:', error);
      setError(error.message || 'Error al guardar el producto');
    }
  };

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!canEdit) {
      setError('No tienes permisos para realizar esta acción');
      return;
    }

    try {
      const quantity = parseFloat(movementFormData.quantity);
      const unitCost = parseFloat(movementFormData.unit_cost) || 0;

      const { error } = await supabase
        .from('inventory_movements')
        .insert({
          company_id: profile?.company_id!,
          branch_id: profile?.branch_id || null,
          product_id: movementFormData.product_id,
          movement_type: movementFormData.movement_type,
          quantity: quantity,
          unit_cost: unitCost,
          total_cost: quantity * unitCost,
          reference_type: 'otro',
          reason: movementFormData.reason,
          notes: movementFormData.notes || null,
          performed_by: profile?.id!,
        });

      if (error) throw error;

      setShowMovementForm(false);
      resetMovementForm();
      loadProducts();
      loadMovements();
      loadLowStockAlerts();
    } catch (error: any) {
      console.error('Error creating movement:', error);
      setError(error.message || 'Error al registrar el movimiento');
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!canEdit) {
      setError('No tienes permisos para crear categorías');
      return;
    }

    try {
      const { error } = await supabase
        .from('product_categories')
        .insert({
          company_id: profile?.company_id!,
          name: categoryFormData.name,
          description: categoryFormData.description || null,
        });

      if (error) throw error;

      setShowCategoryForm(false);
      resetCategoryForm();
      loadCategories();
    } catch (error: any) {
      console.error('Error creating category:', error);
      setError(error.message || 'Error al crear la categoría');
    }
  };

  const handleEdit = (product: Product) => {
    if (!canEdit) return;

    setEditingProduct(product);
    setProductFormData({
      name: product.name,
      description: product.description || '',
      category_id: product.category_id || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      qr_code: product.qr_code || '',
      photo_url: product.photo_url || '',
      unit_of_measure: product.unit_of_measure,
      unit_cost: product.unit_cost?.toString() || '',
      min_stock: product.min_stock?.toString() || '',
      max_stock: product.max_stock?.toString() || '',
      location: product.location || '',
    });
    setShowProductForm(true);
  };

  const toggleStatus = async (product: Product) => {
    if (!canEdit) return;

    try {
      const { error } = await supabase
        .from('inventory_products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id);

      if (error) throw error;
      loadProducts();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const resetProductForm = () => {
    setProductFormData({
      name: '',
      description: '',
      category_id: '',
      sku: '',
      barcode: '',
      qr_code: '',
      photo_url: '',
      unit_of_measure: 'unidad',
      unit_cost: '',
      min_stock: '',
      max_stock: '',
      location: '',
    });
    setError('');
  };

  const resetMovementForm = () => {
    setMovementFormData({
      product_id: '',
      movement_type: 'entrada',
      quantity: '',
      unit_cost: '',
      reason: '',
      notes: '',
    });
    setError('');
  };

  const resetCategoryForm = () => {
    setCategoryFormData({
      name: '',
      description: '',
    });
    setError('');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const getStockStatus = (product: Product) => {
    if (product.current_stock <= product.min_stock) {
      return { color: 'text-red-600 bg-red-100', label: 'Bajo' };
    } else if (product.max_stock && product.current_stock >= product.max_stock) {
      return { color: 'text-orange-600 bg-orange-100', label: 'Alto' };
    }
    return { color: 'text-green-600 bg-green-100', label: 'Normal' };
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
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Inventario y Recursos</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestiona productos e insumos</p>
        </div>
        <div className="flex gap-3">
          {lowStockProducts.length > 0 && (
            <button
              onClick={() => setViewMode('alerts')}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-all shadow-md font-medium"
            >
              <AlertTriangle className="w-5 h-5" />
              Alertas ({lowStockProducts.length})
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('products')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              viewMode === 'products'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Package className="w-5 h-5 inline mr-2" />
            Productos
          </button>
          <button
            onClick={() => setViewMode('movements')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              viewMode === 'movements'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <RefreshCw className="w-5 h-5 inline mr-2" />
            Movimientos
          </button>
          <button
            onClick={() => setViewMode('alerts')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              viewMode === 'alerts'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <AlertTriangle className="w-5 h-5 inline mr-2" />
            Alertas
          </button>
        </div>
      </div>

      {viewMode === 'products' && (
        <>
          {!showProductForm && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-4">
              {isRoot && (
                <CompanyFilter value={selectedCompany} onChange={setSelectedCompany} />
              )}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, SKU, código de barras o empresa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full md:w-64 pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">Todas las categorías</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                {canEdit && (
                  <>
                    <button
                      onClick={() => setShowProductForm(true)}
                      className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium"
                    >
                      <Plus className="w-5 h-5" />
                      Nuevo Producto
                    </button>
                    <button
                      onClick={() => setShowCategoryForm(true)}
                      className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all shadow-md font-medium"
                    >
                      <Plus className="w-5 h-5" />
                      Nueva Categoría
                    </button>
                    <button
                      onClick={() => setShowMovementForm(true)}
                      className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-all shadow-md font-medium"
                    >
                      <RefreshCw className="w-5 h-5" />
                      Registrar Movimiento
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {showProductForm && canEdit && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <form onSubmit={handleProductSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nombre del Producto *
                    </label>
                    <input
                      type="text"
                      required
                      value={productFormData.name}
                      onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Categoría
                    </label>
                    <select
                      value={productFormData.category_id}
                      onChange={(e) => setProductFormData({ ...productFormData, category_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Sin categoría</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      SKU (Código)
                    </label>
                    <input
                      type="text"
                      value={productFormData.sku}
                      onChange={(e) => setProductFormData({ ...productFormData, sku: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Se genera automáticamente"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Código de Barras
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={productFormData.barcode}
                        onChange={(e) => setProductFormData({ ...productFormData, barcode: e.target.value })}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <button
                        type="button"
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                        title="Escanear código de barras"
                      >
                        <Barcode className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Código QR
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={productFormData.qr_code}
                        onChange={(e) => setProductFormData({ ...productFormData, qr_code: e.target.value })}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <button
                        type="button"
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                        title="Escanear código QR"
                      >
                        <QrCode className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Unidad de Medida *
                    </label>
                    <select
                      required
                      value={productFormData.unit_of_measure}
                      onChange={(e) => setProductFormData({ ...productFormData, unit_of_measure: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {unitOptions.map(unit => (
                        <option key={unit.value} value={unit.value}>{unit.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Costo Unitario
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={productFormData.unit_cost}
                      onChange={(e) => setProductFormData({ ...productFormData, unit_cost: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Stock Mínimo *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={productFormData.min_stock}
                      onChange={(e) => setProductFormData({ ...productFormData, min_stock: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Stock Máximo
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={productFormData.max_stock}
                      onChange={(e) => setProductFormData({ ...productFormData, max_stock: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ubicación en Almacén
                    </label>
                    <input
                      type="text"
                      value={productFormData.location}
                      onChange={(e) => setProductFormData({ ...productFormData, location: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Ej: Estante A3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      URL de Foto
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={productFormData.photo_url}
                        onChange={(e) => setProductFormData({ ...productFormData, photo_url: e.target.value })}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <button
                        type="button"
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                        title="Subir foto"
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Descripción
                    </label>
                    <textarea
                      value={productFormData.description}
                      onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all font-medium"
                  >
                    {editingProduct ? 'Actualizar' : 'Crear'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProductForm(false);
                      setEditingProduct(null);
                      resetProductForm();
                    }}
                    className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {showMovementForm && canEdit && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Registrar Movimiento de Inventario</h3>
              <form onSubmit={handleMovementSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Producto *
                    </label>
                    <select
                      required
                      value={movementFormData.product_id}
                      onChange={(e) => setMovementFormData({ ...movementFormData, product_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Seleccionar producto</option>
                      {products.filter(p => p.is_active).map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} - Stock: {product.current_stock} {product.unit_of_measure}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tipo de Movimiento *
                    </label>
                    <select
                      required
                      value={movementFormData.movement_type}
                      onChange={(e) => setMovementFormData({ ...movementFormData, movement_type: e.target.value as MovementType, reason: '' })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="entrada">Entrada (Agregar stock)</option>
                      <option value="salida">Salida (Reducir stock)</option>
                      <option value="ajuste">Ajuste (Establecer stock exacto)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cantidad *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={movementFormData.quantity}
                      onChange={(e) => setMovementFormData({ ...movementFormData, quantity: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Costo Unitario
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={movementFormData.unit_cost}
                      onChange={(e) => setMovementFormData({ ...movementFormData, unit_cost: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Motivo *
                    </label>
                    <select
                      required
                      value={movementFormData.reason}
                      onChange={(e) => setMovementFormData({ ...movementFormData, reason: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Seleccionar motivo</option>
                      {movementReasons[movementFormData.movement_type].map(reason => (
                        <option key={reason} value={reason}>{reason}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Notas
                    </label>
                    <textarea
                      value={movementFormData.notes}
                      onChange={(e) => setMovementFormData({ ...movementFormData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all font-medium"
                  >
                    Registrar Movimiento
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMovementForm(false);
                      resetMovementForm();
                    }}
                    className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {showCategoryForm && canEdit && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Nueva Categoría</h3>
              <form onSubmit={handleCategorySubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nombre de la Categoría *
                  </label>
                  <input
                    type="text"
                    required
                    value={categoryFormData.name}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Descripción
                  </label>
                  <textarea
                    value={categoryFormData.description}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all font-medium"
                  >
                    Crear Categoría
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCategoryForm(false);
                      resetCategoryForm();
                    }}
                    className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {!showProductForm && !showMovementForm && !showCategoryForm && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Producto
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        SKU / Códigos
                      </th>
                      {isRoot && (
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Empresa
                        </th>
                      )}
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Stock Actual
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Costo Unit.
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Estado
                      </th>
                      {canEdit && (
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Acciones
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredProducts.map((product) => {
                      const stockStatus = getStockStatus(product);
                      return (
                        <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {product.photo_url ? (
                                <img
                                  src={product.photo_url}
                                  alt={product.name}
                                  className="w-12 h-12 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                  <Package className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                                </div>
                              )}
                              <div>
                                <div className="font-semibold text-gray-900 dark:text-white">{product.name}</div>
                                {product.category && (
                                  <div className="text-xs text-gray-600 dark:text-gray-400">{product.category.name}</div>
                                )}
                                {product.location && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">Ubicación: {product.location}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm space-y-1">
                              {product.sku && (
                                <div className="font-mono text-gray-900 dark:text-gray-300">SKU: {product.sku}</div>
                              )}
                              {product.barcode && (
                                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                  <Barcode className="w-3 h-3" />
                                  {product.barcode}
                                </div>
                              )}
                              {product.qr_code && (
                                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                  <QrCode className="w-3 h-3" />
                                  {product.qr_code}
                                </div>
                              )}
                            </div>
                          </td>
                          {isRoot && (
                            <td className="px-6 py-4">
                              {product.company ? (
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                  <span className="text-sm text-gray-900 dark:text-white">{product.company.name}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">N/A</span>
                              )}
                            </td>
                          )}
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="font-bold text-gray-900 dark:text-white">
                                {product.current_stock} {product.unit_of_measure}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                Mín: {product.min_stock} {product.max_stock && `/ Máx: ${product.max_stock}`}
                              </div>
                              <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${stockStatus.color}`}>
                                {stockStatus.label}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(Number(product.unit_cost))}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block text-xs px-3 py-1 rounded-full font-medium ${
                              product.is_active
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {product.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          {canEdit && (
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleEdit(product)}
                                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                                  title="Editar"
                                >
                                  <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                </button>
                                <button
                                  onClick={() => toggleStatus(product)}
                                  className={`px-3 py-1 rounded-lg transition-all text-xs font-medium ${
                                    product.is_active
                                      ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
                                      : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                                  }`}
                                >
                                  {product.is_active ? 'Desactivar' : 'Activar'}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filteredProducts.length === 0 && !showProductForm && !showMovementForm && !showCategoryForm && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {searchTerm || categoryFilter !== 'all' ? 'No se encontraron productos' : 'No hay productos registrados'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchTerm || categoryFilter !== 'all' ? 'Intenta con otros criterios' : 'Comienza agregando el primer producto'}
              </p>
            </div>
          )}
        </>
      )}

      {viewMode === 'movements' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Últimos 50 Movimientos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Cantidad
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Motivo
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Usuario
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {movements.map((movement) => (
                  <tr key={movement.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {new Date(movement.created_at).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 dark:text-white">{movement.product.name}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{movement.product.sku}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium ${
                        movement.movement_type === 'entrada'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : movement.movement_type === 'salida'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {movement.movement_type === 'entrada' && <ArrowUp className="w-3 h-3" />}
                        {movement.movement_type === 'salida' && <ArrowDown className="w-3 h-3" />}
                        {movement.movement_type === 'ajuste' && <RefreshCw className="w-3 h-3" />}
                        {movement.movement_type.charAt(0).toUpperCase() + movement.movement_type.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {movement.quantity} {movement.product.unit_of_measure}
                      </div>
                      {movement.total_cost > 0 && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {formatCurrency(Number(movement.total_cost))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">{movement.reason}</div>
                      {movement.notes && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{movement.notes}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">{movement.user?.full_name || '-'}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'alerts' && (
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-300">
                Productos con Stock Bajo ({lowStockProducts.length})
              </h3>
            </div>
            <p className="text-red-700 dark:text-red-400 text-sm">
              Los siguientes productos tienen stock igual o menor al mínimo establecido
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Producto
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Stock Actual
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Stock Mínimo
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Diferencia
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Ubicación
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {lowStockProducts.map((product) => {
                    const diff = Number(product.min_stock) - Number(product.current_stock);
                    return (
                      <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {product.photo_url ? (
                              <img
                                src={product.photo_url}
                                alt={product.name}
                                className="w-12 h-12 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                <Package className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white">{product.name}</div>
                              {product.category && (
                                <div className="text-xs text-gray-600 dark:text-gray-400">{product.category.name}</div>
                              )}
                              {product.sku && (
                                <div className="text-xs font-mono text-gray-500 dark:text-gray-500">{product.sku}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-red-600 dark:text-red-400">
                            {product.current_stock} {product.unit_of_measure}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {product.min_stock} {product.unit_of_measure}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
                            <TrendingDown className="w-4 h-4" />
                            {diff.toFixed(2)} {product.unit_of_measure}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 dark:text-white">{product.location || '-'}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {lowStockProducts.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <Package className="w-16 h-16 text-green-300 dark:text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No hay alertas de stock bajo
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Todos los productos tienen stock suficiente
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
