import { useEffect, useState } from 'react';
import { Plus, Search, FileText, Eye, CreditCard as Edit2, Printer, Clock, CheckCircle, XCircle, Package, DollarSign, User, Car, Calendar, Filter, Receipt, X, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CompanyFilter } from '../shared/CompanyFilter';
import type { Database } from '../../lib/database.types';

type Company = Database['public']['Tables']['companies']['Row'];

type ServiceOrder = Database['public']['Tables']['service_orders']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];
type Vehicle = Database['public']['Tables']['vehicles']['Row'];
type Service = Database['public']['Tables']['services']['Row'];
type ServicePackage = Database['public']['Tables']['service_packages']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];
type Employee = Database['public']['Tables']['employees']['Row'];
type Branch = Database['public']['Tables']['branches']['Row'];

interface OrderWithDetails extends ServiceOrder {
  customer: Customer;
  vehicle: Vehicle;
  items: OrderItem[];
  employee?: Employee;
  company?: Company;
  branch?: Branch;
}

type OrderStatus = 'pendiente' | 'en_proceso' | 'terminado' | 'entregado' | 'cancelado';

export function OrdersManager() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderWithDetails[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<OrderWithDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [selectedCompany, setSelectedCompany] = useState('');

  const isRoot = profile?.role === 'root';
  const [formData, setFormData] = useState({
    branch_id: '',
    customer_id: '',
    vehicle_id: '',
    assigned_to: '',
    payment_method: '',
    notes: '',
  });
  const [orderItems, setOrderItems] = useState<{
    item_type: 'service' | 'package' | 'complement';
    service_id?: string;
    package_id?: string;
    name: string;
    quantity: number;
    unit_price: number;
    discount_amount: number;
  }[]>([]);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [error, setError] = useState('');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoicingOrder, setInvoicingOrder] = useState<OrderWithDetails | null>(null);
  const [existingInvoiceRequest, setExistingInvoiceRequest] = useState<any>(null);
  const [invoiceFormData, setInvoiceFormData] = useState({
    rfc: '',
    razon_social: '',
    regimen_fiscal: '601',
    uso_cfdi: 'G03',
    calle: '',
    numero_exterior: '',
    numero_interior: '',
    colonia: '',
    codigo_postal: '',
    municipio: '',
    estado: '',
    email: '',
    telefono: '',
    notes: '',
  });

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'operator';

  const statusLabels: Record<OrderStatus, string> = {
    pendiente: 'Pendiente',
    en_proceso: 'En Proceso',
    terminado: 'Terminado',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
  };

  const statusColors: Record<OrderStatus, string> = {
    pendiente: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    en_proceso: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    terminado: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    entregado: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    cancelado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const paymentMethods = [
    { value: 'efectivo', label: 'Efectivo' },
    { value: 'tarjeta', label: 'Tarjeta' },
    { value: 'transferencia', label: 'Transferencia' },
    { value: 'credito', label: 'Crédito' },
  ];

  useEffect(() => {
    loadData();
  }, [profile]);

  useEffect(() => {
    filterOrders();
  }, [orders, searchTerm, statusFilter, selectedCompany]);

  useEffect(() => {
    filterCustomers();
  }, [customers, customerSearchTerm]);

  useEffect(() => {
    filterEmployees();
  }, [employees, formData.branch_id]);

  const loadData = async () => {
    try {
      await Promise.all([
        loadOrders(),
        loadCustomers(),
        loadVehicles(),
        loadServices(),
        loadPackages(),
        loadEmployees(),
        loadBranches(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      let query = supabase
        .from('service_orders')
        .select(`
          *,
          customer:customers(*),
          vehicle:vehicles(*),
          items:order_items(*),
          employee:employees(*),
          company:companies(*),
          branch:branches(*)
        `)
        .order('created_at', { ascending: false });

      if (!isRoot && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setOrders(data as OrderWithDetails[] || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('full_name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('company_id', profile?.company_id!)
        .eq('is_active', true)
        .order('license_plate');

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('company_id', profile?.company_id!)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  const loadPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('service_packages')
        .select('*')
        .eq('company_id', profile?.company_id!)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setPackages(data || []);
    } catch (error) {
      console.error('Error loading packages:', error);
    }
  };

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', profile?.company_id!)
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('company_id', profile?.company_id!)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };

  const filterOrders = () => {
    let filtered = orders;

    if (selectedCompany && isRoot) {
      filtered = filtered.filter(order => order.company_id === selectedCompany);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(order =>
        order.ticket_number.toLowerCase().includes(term) ||
        order.customer.full_name.toLowerCase().includes(term) ||
        (order.vehicle?.license_plate?.toLowerCase().includes(term) || false) ||
        order.company?.name?.toLowerCase().includes(term) ||
        order.branch?.name?.toLowerCase().includes(term)
      );
    }

    setFilteredOrders(filtered);
  };

  const filterCustomers = () => {
    if (!customerSearchTerm.trim()) {
      setFilteredCustomers(customers);
      return;
    }

    const term = customerSearchTerm.toLowerCase().trim();
    const filtered = customers.filter(customer => {
      const fullName = customer.full_name.toLowerCase();
      const email = customer.email?.toLowerCase() || '';
      const phone = customer.phone?.toLowerCase() || '';

      const searchParts = term.split(' ').filter(p => p.length > 0);

      return searchParts.every(part =>
        fullName.includes(part) ||
        email.includes(part) ||
        phone.includes(part)
      );
    });
    setFilteredCustomers(filtered);
  };

  const filterEmployees = () => {
    if (!formData.branch_id) {
      setFilteredEmployees(employees);
      return;
    }

    const filtered = employees.filter(employee => employee.branch_id === formData.branch_id);
    setFilteredEmployees(filtered);
  };

  const calculateTotals = () => {
    const subtotal = orderItems.reduce((sum, item) => {
      return sum + (item.unit_price * item.quantity);
    }, 0);

    const itemsDiscount = orderItems.reduce((sum, item) => {
      return sum + item.discount_amount;
    }, 0);

    const percentageDiscount = subtotal * (discountPercentage / 100);
    const totalDiscount = itemsDiscount + percentageDiscount;
    const total = subtotal - totalDiscount;

    return {
      subtotal: subtotal.toFixed(2),
      discount: totalDiscount.toFixed(2),
      total: total.toFixed(2),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!canEdit) {
      setError('No tienes permisos para crear órdenes');
      return;
    }

    if (orderItems.length === 0) {
      setError('Debes agregar al menos un servicio o paquete');
      return;
    }

    try {
      const { data: ticketData } = await supabase
        .rpc('generate_ticket_number', { p_company_id: profile?.company_id! });

      const totals = calculateTotals();

      const { data: orderData, error: orderError } = await supabase
        .from('service_orders')
        .insert({
          company_id: profile?.company_id!,
          branch_id: formData.branch_id || null,
          ticket_number: ticketData,
          customer_id: formData.customer_id,
          vehicle_id: formData.vehicle_id || null,
          status: 'pendiente',
          subtotal: parseFloat(totals.subtotal),
          discount_amount: parseFloat(totals.discount),
          discount_percentage: discountPercentage,
          total: parseFloat(totals.total),
          payment_method: formData.payment_method || null,
          payment_status: 'pagado',
          notes: formData.notes || null,
          created_by: profile?.id!,
          assigned_to: formData.assigned_to || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const items = orderItems.map(item => ({
        order_id: orderData.id,
        item_type: item.item_type,
        service_id: item.service_id || null,
        package_id: item.package_id || null,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        subtotal: item.unit_price * item.quantity,
        total: (item.unit_price * item.quantity) - item.discount_amount,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(items);

      if (itemsError) throw itemsError;

      const paymentMethodMap: Record<string, 'cash' | 'card' | 'transfer' | 'other'> = {
        'efectivo': 'cash',
        'tarjeta': 'card',
        'transferencia': 'transfer',
        'credito': 'other',
      };

      const { data: incomeCategory } = await supabase
        .from('income_categories')
        .select('id')
        .eq('company_id', profile?.company_id!)
        .eq('name', 'Servicios de Lavado')
        .maybeSingle();

      const { data: customerData } = await supabase
        .from('customers')
        .select('full_name')
        .eq('id', formData.customer_id)
        .single();

      await supabase
        .from('transactions')
        .insert({
          company_id: profile?.company_id!,
          branch_id: formData.branch_id || null,
          type: 'income',
          category_id: incomeCategory?.id || null,
          reference_type: 'service_order',
          reference_id: orderData.id,
          amount: parseFloat(totals.total),
          payment_method: paymentMethodMap[formData.payment_method || 'efectivo'] || 'cash',
          reference: ticketData,
          description: `Orden de servicio ${ticketData} - ${customerData?.full_name}`,
          notes: 'Pago recibido por servicios realizados',
          transaction_date: new Date().toISOString(),
          created_by: profile?.id!,
        });

      setShowForm(false);
      resetForm();
      await loadOrders();

      // Show print dialog with a small delay to ensure state is updated
      setTimeout(() => {
        if (window.confirm('¿Deseas imprimir el ticket de la orden?')) {
          openPrintTicketFromDB(orderData.id);
        }
      }, 500);
    } catch (error: any) {
      console.error('Error creating order:', error);
      setError(error.message || 'Error al crear la orden');
    }
  };

  const addService = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    setOrderItems([...orderItems, {
      item_type: 'service',
      service_id: serviceId,
      name: service.name,
      quantity: 1,
      unit_price: Number(service.base_price),
      discount_amount: 0,
    }]);
  };

  const addPackage = (packageId: string) => {
    const pkg = packages.find(p => p.id === packageId);
    if (!pkg) return;

    setOrderItems([...orderItems, {
      item_type: 'package',
      package_id: packageId,
      name: pkg.name,
      quantity: 1,
      unit_price: Number(pkg.price),
      discount_amount: 0,
    }]);
  };

  const removeItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    const updated = [...orderItems];
    updated[index].quantity = Math.max(1, quantity);
    setOrderItems(updated);
  };

  const updateItemDiscount = (index: number, discount: number) => {
    const updated = [...orderItems];
    updated[index].discount_amount = Math.max(0, discount);
    setOrderItems(updated);
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const updateData: any = { status: newStatus };
      const order = orders.find(o => o.id === orderId);

      if (newStatus === 'en_proceso' && !order?.started_at) {
        updateData.started_at = new Date().toISOString();
      } else if (newStatus === 'terminado' && !order?.completed_at) {
        updateData.completed_at = new Date().toISOString();
      } else if (newStatus === 'entregado' && !order?.delivered_at) {
        updateData.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('service_orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      loadOrders();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const openInvoiceModal = async (order: OrderWithDetails) => {
    setInvoicingOrder(order);
    setError('');

    try {
      const { data: existingRequest, error: fetchError } = await supabase
        .from('invoice_requests')
        .select('*')
        .eq('order_id', order.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingRequest) {
        setExistingInvoiceRequest(existingRequest);
        setInvoiceFormData({
          rfc: existingRequest.rfc,
          razon_social: existingRequest.razon_social,
          regimen_fiscal: existingRequest.regimen_fiscal,
          uso_cfdi: existingRequest.uso_cfdi,
          calle: existingRequest.calle || '',
          numero_exterior: existingRequest.numero_exterior || '',
          numero_interior: existingRequest.numero_interior || '',
          colonia: existingRequest.colonia || '',
          codigo_postal: existingRequest.codigo_postal,
          municipio: existingRequest.municipio || '',
          estado: existingRequest.estado || '',
          email: existingRequest.email,
          telefono: existingRequest.telefono || '',
          notes: existingRequest.notes || '',
        });
      } else {
        setExistingInvoiceRequest(null);
        setInvoiceFormData({
          rfc: '',
          razon_social: order.customer.full_name || '',
          regimen_fiscal: '601',
          uso_cfdi: 'G03',
          calle: '',
          numero_exterior: '',
          numero_interior: '',
          colonia: '',
          codigo_postal: '',
          municipio: '',
          estado: '',
          email: order.customer.email || '',
          telefono: order.customer.phone || '',
          notes: '',
        });
      }
    } catch (error) {
      console.error('Error checking invoice request:', error);
      setExistingInvoiceRequest(null);
    }

    setShowInvoiceModal(true);
  };

  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!invoicingOrder) return;

    try {
      const { error } = await supabase
        .from('invoice_requests')
        .insert({
          company_id: profile?.company_id!,
          order_id: invoicingOrder.id,
          rfc: invoiceFormData.rfc,
          razon_social: invoiceFormData.razon_social,
          regimen_fiscal: invoiceFormData.regimen_fiscal,
          uso_cfdi: invoiceFormData.uso_cfdi,
          calle: invoiceFormData.calle || null,
          numero_exterior: invoiceFormData.numero_exterior || null,
          numero_interior: invoiceFormData.numero_interior || null,
          colonia: invoiceFormData.colonia || null,
          codigo_postal: invoiceFormData.codigo_postal,
          municipio: invoiceFormData.municipio || null,
          estado: invoiceFormData.estado || null,
          email: invoiceFormData.email,
          telefono: invoiceFormData.telefono || null,
          notes: invoiceFormData.notes || null,
          status: 'pendiente',
          requested_by: profile?.id!,
        });

      if (error) throw error;

      setShowInvoiceModal(false);
      setInvoicingOrder(null);
      alert('Solicitud de factura creada exitosamente');
    } catch (error: any) {
      console.error('Error creating invoice request:', error);
      setError(error.message || 'Error al crear solicitud de factura');
    }
  };

  const resetForm = () => {
    setFormData({
      branch_id: '',
      customer_id: '',
      vehicle_id: '',
      assigned_to: '',
      payment_method: '',
      notes: '',
    });
    setOrderItems([]);
    setDiscountPercentage(0);
    setCustomerSearchTerm('');
    setError('');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const openPrintTicketFromDB = async (orderId: string) => {
    try {
      // Fetch the complete order data from database
      const { data: orderData, error: orderError } = await supabase
        .from('service_orders')
        .select(`
          *,
          customer:customers(full_name, phone),
          vehicle:vehicles(brand, model, license_plate),
          branch:branches(name, company_id),
          items:order_items(*)
        `)
        .eq('id', orderId)
        .single();

      if (orderError || !orderData) {
        console.error('Error loading order:', orderError);
        return;
      }

      // Fetch company settings
      let companySettings = null;
      if (orderData.branch?.company_id) {
        const { data: settingsData } = await supabase
          .from('company_settings')
          .select('*')
          .eq('company_id', orderData.branch.company_id)
          .maybeSingle();

        companySettings = settingsData;
      }

      // Create a new window for printing
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) return;

      const customer = orderData.customer;
      const vehicle = orderData.vehicle;
      const branch = orderData.branch;
      const order = orderData;

      // Helper function to format currency in the template
      const formatCurrencyInTemplate = (amount: number) => {
        return new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN',
        }).format(amount);
      };

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ticket #${order.ticket_number}</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            max-width: 80mm;
            margin: 0 auto;
            padding: 10px;
            font-size: 12px;
          }
          .header {
            text-align: center;
            border-bottom: 2px dashed #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          .header h2 {
            margin: 5px 0;
            font-size: 16px;
          }
          .logo {
            max-width: 150px;
            max-height: 80px;
            margin: 10px auto;
            display: block;
          }
          .header-text {
            font-size: 10px;
            margin: 5px 0;
            white-space: pre-line;
          }
          .section {
            margin: 10px 0;
            padding: 5px 0;
          }
          .row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
          }
          .items {
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 10px 0;
            margin: 10px 0;
          }
          .item {
            margin: 5px 0;
          }
          .total-section {
            margin-top: 10px;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 2px dashed #000;
            font-size: 10px;
          }
          @media print {
            body {
              margin: 0;
              padding: 5px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${companySettings?.logo_url ? `<img src="${companySettings.logo_url}" class="logo" alt="Logo">` : '<h2>CAR WASH</h2>'}
          ${companySettings?.ticket_header_text ? `<div class="header-text">${companySettings.ticket_header_text}</div>` : ''}
          ${branch ? `<div>${branch.name}</div>` : ''}
          <div>TICKET #${order.ticket_number}</div>
          <div>${new Date(order.created_at).toLocaleString('es-MX')}</div>
        </div>

        <div class="section">
          <strong>Cliente:</strong><br>
          ${customer?.full_name || 'N/A'}<br>
          ${customer?.phone || ''}
        </div>

        ${vehicle ? `
        <div class="section">
          <strong>Vehículo:</strong><br>
          ${vehicle.brand} ${vehicle.model}<br>
          Placas: ${vehicle.license_plate}
        </div>
        ` : ''}

        <div class="items">
          <strong>SERVICIOS:</strong>
          ${order.items?.map(item => `
            <div class="item">
              <div class="row">
                <span>${item.name}</span>
              </div>
              <div class="row">
                <span>${item.quantity} x ${formatCurrencyInTemplate(item.unit_price)}</span>
                <span>${formatCurrencyInTemplate(item.total)}</span>
              </div>
            </div>
          `).join('') || ''}
        </div>

        <div class="total-section">
          <div class="row">
            <span>Subtotal:</span>
            <span>${formatCurrencyInTemplate(order.subtotal)}</span>
          </div>
          ${order.discount_amount > 0 ? `
          <div class="row">
            <span>Descuento:</span>
            <span>-${formatCurrencyInTemplate(order.discount_amount)}</span>
          </div>
          ` : ''}
          <div class="row" style="font-size: 14px; margin-top: 5px;">
            <span>TOTAL:</span>
            <span>${formatCurrencyInTemplate(order.total)}</span>
          </div>
        </div>

        <div class="section">
          <div><strong>Estado:</strong> ${getStatusText(order.status)}</div>
          <div><strong>Método de pago:</strong> ${order.payment_method || 'Pendiente'}</div>
        </div>

        <div class="footer">
          ${companySettings?.ticket_footer_text || '¡Gracias por su preferencia!<br>Vuelva pronto'}
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
    } catch (error) {
      console.error('Error printing ticket:', error);
    }
  };

  const openPrintTicket = (orderId: string) => {
    openPrintTicketFromDB(orderId);
  };

  const getStatusText = (status: OrderStatus): string => {
    const statusMap: Record<OrderStatus, string> = {
      'pendiente': 'Pendiente',
      'en_proceso': 'En Proceso',
      'terminado': 'Terminado',
      'entregado': 'Entregado',
      'facturado': 'Facturado',
      'cancelado': 'Cancelado'
    };
    return statusMap[status] || status;
  };

  const printTicket = (order: OrderWithDetails) => {
    openPrintTicket(order.id);
  };

  const customerVehicles = vehicles.filter(v => v.customer_id === formData.customer_id);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Órdenes de Servicio</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestiona las órdenes de lavado</p>
        </div>
        {!showForm && !viewingOrder && canEdit && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md font-medium"
          >
            <Plus className="w-5 h-5" />
            Nueva Orden
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Nueva Orden de Servicio</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sucursal *
                </label>
                <select
                  required
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value, assigned_to: '' })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Seleccionar sucursal</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cliente *
                </label>
                <input type="hidden" required value={formData.customer_id} />
                {!formData.customer_id ? (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Buscar cliente por nombre, email o teléfono..."
                        value={customerSearchTerm}
                        onChange={(e) => setCustomerSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        autoComplete="off"
                      />
                    </div>
                    {customerSearchTerm && filteredCustomers.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredCustomers.map(customer => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, customer_id: customer.id, vehicle_id: '' });
                              setCustomerSearchTerm('');
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-600 last:border-b-0 transition-colors"
                          >
                            <div className="font-medium text-gray-900 dark:text-white">{customer.full_name}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                              {customer.email && <span>{customer.email}</span>}
                              {customer.email && customer.phone && <span className="mx-2">•</span>}
                              {customer.phone && <span>{customer.phone}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {customerSearchTerm && customerSearchTerm.trim() !== '' && filteredCustomers.length === 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 text-center text-gray-500 dark:text-gray-400">
                        No se encontraron clientes
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {customers.find(c => c.id === formData.customer_id)?.full_name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {customers.find(c => c.id === formData.customer_id)?.email ||
                         customers.find(c => c.id === formData.customer_id)?.phone}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, customer_id: '', vehicle_id: '' });
                        setCustomerSearchTerm('');
                      }}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    >
                      Cambiar
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Vehículo
                </label>
                <select
                  value={formData.vehicle_id}
                  onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={!formData.customer_id}
                >
                  <option value="">Sin asignar</option>
                  {customerVehicles.map(vehicle => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.license_plate} - {vehicle.brand} {vehicle.model}
                    </option>
                  ))}
                </select>
                {formData.customer_id && customerVehicles.length === 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Este cliente no tiene vehículos registrados</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Asignar a (Empleado)
                </label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={!formData.branch_id}
                >
                  <option value="">Sin asignar</option>
                  {filteredEmployees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.full_name} - {employee.position}
                    </option>
                  ))}
                </select>
                {formData.branch_id && filteredEmployees.length === 0 && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">No hay empleados en esta sucursal</p>
                )}
                {!formData.branch_id && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Selecciona una sucursal primero</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Método de Pago
                </label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Seleccionar método</option>
                  {paymentMethods.map(method => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notas
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Observaciones o instrucciones especiales..."
                />
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Servicios y Paquetes</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Agregar Servicio
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addService(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Seleccionar servicio...</option>
                    {services.map(service => (
                      <option key={service.id} value={service.id}>
                        {service.name} - {formatCurrency(Number(service.base_price))}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Agregar Paquete
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addPackage(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Seleccionar paquete...</option>
                    {packages.map(pkg => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} - {formatCurrency(Number(pkg.price))}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {orderItems.length > 0 && (
                <div className="space-y-3">
                  {orderItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">{item.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {item.item_type === 'package' ? 'Paquete' : 'Servicio'}
                        </div>
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItemQuantity(index, parseInt(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="w-32">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Precio Unit.</div>
                        <div className="font-semibold dark:text-white">{formatCurrency(item.unit_price)}</div>
                      </div>
                      <div className="w-32">
                        <label className="text-xs text-gray-600 dark:text-gray-400">Descuento</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.discount_amount}
                          onChange={(e) => updateItemDiscount(index, parseFloat(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="w-32">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Subtotal</div>
                        <div className="font-semibold dark:text-white">{formatCurrency((item.unit_price * item.quantity) - item.discount_amount)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {orderItems.length === 0 && (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <Package className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-600 dark:text-gray-400">Agrega servicios o paquetes a la orden</p>
                </div>
              )}
            </div>

            {orderItems.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 dark:text-gray-300">Subtotal:</span>
                    <span className="text-lg font-semibold dark:text-white">{formatCurrency(parseFloat(totals.subtotal))}</span>
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <label className="text-gray-700 dark:text-gray-300">Descuento adicional (%):</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)}
                      className="w-24 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="flex justify-between items-center text-red-600 dark:text-red-400">
                    <span>Descuento Total:</span>
                    <span className="font-semibold">-{formatCurrency(parseFloat(totals.discount))}</span>
                  </div>
                  <div className="flex justify-between items-center text-2xl font-bold text-blue-600 dark:text-blue-400 border-t border-gray-200 dark:border-gray-600 pt-3">
                    <span>Total:</span>
                    <span>{formatCurrency(parseFloat(totals.total))}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={orderItems.length === 0}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-all font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Crear Orden
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-all font-medium"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {!showForm && !viewingOrder && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            {isRoot && (
              <CompanyFilter value={selectedCompany} onChange={setSelectedCompany} />
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar por ticket, cliente, placa, empresa o sucursal..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">Todos los estados</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Ticket
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Cliente / Vehículo
                    </th>
                    {isRoot && (
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Empresa / Sucursal
                      </th>
                    )}
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-blue-600 dark:text-blue-400">{order.ticket_number}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{order.customer.full_name}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                              <Car className="w-3 h-3" />
                              {order.vehicle ? (
                                `${order.vehicle.license_plate} - ${order.vehicle.brand} ${order.vehicle.model}`
                              ) : (
                                'Sin vehículo asignado'
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      {isRoot && (
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-2">
                            <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" />
                            <div>
                              {order.company && (
                                <div className="font-medium text-gray-900 dark:text-white">{order.company.name}</div>
                              )}
                              {order.branch && (
                                <div className="text-sm text-gray-600 dark:text-gray-400">{order.branch.name}</div>
                              )}
                              {!order.company && !order.branch && (
                                <span className="text-xs text-gray-400 dark:text-gray-500">N/A</span>
                              )}
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">{order.items.length} item(s)</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 dark:text-white">{formatCurrency(Number(order.total))}</div>
                        {order.discount_amount > 0 && (
                          <div className="text-xs text-red-600 dark:text-red-400">Desc: {formatCurrency(Number(order.discount_amount))}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium ${statusColors[order.status as OrderStatus]}`}>
                          {statusLabels[order.status as OrderStatus]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(order.created_at).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewingOrder(order)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-all"
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          <button
                            onClick={() => openInvoiceModal(order)}
                            className="p-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-all"
                            title="Solicitar factura"
                          >
                            <Receipt className="w-4 h-4 text-green-600 dark:text-green-400" />
                          </button>
                          {canEdit && order.status !== 'cancelado' && (
                            <select
                              value={order.status}
                              onChange={(e) => updateOrderStatus(order.id, e.target.value as OrderStatus)}
                              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {Object.entries(statusLabels).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {searchTerm || statusFilter !== 'all' ? 'No se encontraron órdenes' : 'No hay órdenes registradas'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm || statusFilter !== 'all' ? 'Intenta con otros criterios de búsqueda' : 'Crea la primera orden de servicio'}
              </p>
            </div>
          )}
        </>
      )}

      {viewingOrder && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Orden #{viewingOrder.ticket_number}</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {new Date(viewingOrder.created_at).toLocaleDateString('es-MX', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => printTicket(viewingOrder)}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
              <button
                onClick={() => setViewingOrder(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Cliente</h4>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{viewingOrder.customer.full_name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{viewingOrder.customer.email || viewingOrder.customer.phone}</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Vehículo</h4>
                {viewingOrder.vehicle ? (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      <Car className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{viewingOrder.vehicle.license_plate}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {viewingOrder.vehicle.brand} {viewingOrder.vehicle.model} {viewingOrder.vehicle.year}
                      </div>
                      {viewingOrder.vehicle.color && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{viewingOrder.vehicle.color}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400">Sin vehículo asignado</div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Estado</h4>
                <span className={`inline-flex items-center gap-1 text-sm px-4 py-2 rounded-lg font-medium ${statusColors[viewingOrder.status as OrderStatus]}`}>
                  {statusLabels[viewingOrder.status as OrderStatus]}
                </span>
              </div>

              {viewingOrder.employee && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Asignado a</h4>
                  <div className="text-gray-900 dark:text-white">{viewingOrder.employee.full_name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{viewingOrder.employee.position}</div>
                </div>
              )}

              {viewingOrder.payment_method && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Método de Pago</h4>
                  <div className="text-gray-900 dark:text-white capitalize">{viewingOrder.payment_method}</div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mb-6">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Servicios y Paquetes</h4>
            <div className="space-y-2">
              {viewingOrder.items.map((item) => (
                <div key={item.id} className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">{item.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {item.item_type === 'package' ? 'Paquete' : item.item_type === 'complement' ? 'Complemento' : 'Servicio'} - Cantidad: {item.quantity}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 dark:text-white">{formatCurrency(Number(item.total))}</div>
                    {item.discount_amount > 0 && (
                      <div className="text-xs text-red-600 dark:text-red-400">Desc: {formatCurrency(Number(item.discount_amount))}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 space-y-3">
            <div className="flex justify-between items-center text-gray-700 dark:text-gray-300">
              <span>Subtotal:</span>
              <span className="text-lg font-semibold">{formatCurrency(Number(viewingOrder.subtotal))}</span>
            </div>
            {viewingOrder.discount_amount > 0 && (
              <div className="flex justify-between items-center text-red-600 dark:text-red-400">
                <span>Descuento:</span>
                <span className="font-semibold">-{formatCurrency(Number(viewingOrder.discount_amount))}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-2xl font-bold text-blue-600 dark:text-blue-400 border-t border-gray-200 dark:border-gray-600 pt-3">
              <span>Total:</span>
              <span>{formatCurrency(Number(viewingOrder.total))}</span>
            </div>
          </div>

          {viewingOrder.notes && (
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-900/50">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notas</h4>
              <p className="text-gray-900 dark:text-gray-100">{viewingOrder.notes}</p>
            </div>
          )}
        </div>
      )}

      {showInvoiceModal && invoicingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {existingInvoiceRequest ? 'Información de Factura' : 'Solicitar Factura'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Orden: {invoicingOrder.ticket_number} - {formatCurrency(Number(invoicingOrder.total))}</p>
              </div>
              <button
                onClick={() => {
                  setShowInvoiceModal(false);
                  setInvoicingOrder(null);
                  setExistingInvoiceRequest(null);
                  setError('');
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
              >
                <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleInvoiceSubmit} className="p-6 space-y-6">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {existingInvoiceRequest ? (
                <>
                  <div className={`border rounded-lg p-4 ${
                    existingInvoiceRequest.status === 'procesado'
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : existingInvoiceRequest.status === 'cancelado'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                  }`}>
                    <div className="flex items-center gap-3 mb-3">
                      {existingInvoiceRequest.status === 'procesado' ? (
                        <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                      ) : existingInvoiceRequest.status === 'cancelado' ? (
                        <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                      ) : (
                        <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                      )}
                      <div>
                        <h4 className={`text-lg font-semibold ${
                          existingInvoiceRequest.status === 'procesado'
                            ? 'text-green-900 dark:text-green-300'
                            : existingInvoiceRequest.status === 'cancelado'
                            ? 'text-red-900 dark:text-red-300'
                            : 'text-yellow-900 dark:text-yellow-300'
                        }`}>
                          {existingInvoiceRequest.status === 'procesado' && 'Factura Procesada'}
                          {existingInvoiceRequest.status === 'cancelado' && 'Solicitud Cancelada'}
                          {existingInvoiceRequest.status === 'pendiente' && 'Solicitud Pendiente'}
                        </h4>
                        <p className={`text-sm ${
                          existingInvoiceRequest.status === 'procesado'
                            ? 'text-green-700 dark:text-green-400'
                            : existingInvoiceRequest.status === 'cancelado'
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-yellow-700 dark:text-yellow-400'
                        }`}>
                          {existingInvoiceRequest.status === 'procesado' && 'Esta orden ya ha sido facturada'}
                          {existingInvoiceRequest.status === 'cancelado' && 'La solicitud de factura fue cancelada'}
                          {existingInvoiceRequest.status === 'pendiente' && 'La solicitud está en proceso de ser facturada'}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                      <div><span className="font-medium">Solicitado:</span> {new Date(existingInvoiceRequest.requested_at).toLocaleString('es-MX')}</div>
                      {existingInvoiceRequest.processed_at && (
                        <div><span className="font-medium">Procesado:</span> {new Date(existingInvoiceRequest.processed_at).toLocaleString('es-MX')}</div>
                      )}
                      {existingInvoiceRequest.processed_notes && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="font-medium">Notas:</span> {existingInvoiceRequest.processed_notes}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Datos Fiscales</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-900 dark:text-gray-100">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">RFC:</span>
                        <div className="font-mono font-semibold">{existingInvoiceRequest.rfc}</div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Razón Social:</span>
                        <div className="font-semibold">{existingInvoiceRequest.razon_social}</div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Régimen Fiscal:</span>
                        <div className="font-semibold">{existingInvoiceRequest.regimen_fiscal}</div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Uso de CFDI:</span>
                        <div className="font-semibold">{existingInvoiceRequest.uso_cfdi}</div>
                      </div>
                    </div>
                  </div>

                  {existingInvoiceRequest.calle && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Dirección Fiscal</h4>
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        <div>{existingInvoiceRequest.calle} {existingInvoiceRequest.numero_exterior} {existingInvoiceRequest.numero_interior}</div>
                        <div>{existingInvoiceRequest.colonia}</div>
                        <div>C.P. {existingInvoiceRequest.codigo_postal}, {existingInvoiceRequest.municipio}, {existingInvoiceRequest.estado}</div>
                      </div>
                    </div>
                  )}

                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Datos de Contacto</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-900 dark:text-gray-100">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Email:</span>
                        <div className="font-semibold">{existingInvoiceRequest.email}</div>
                      </div>
                      {existingInvoiceRequest.telefono && (
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Teléfono:</span>
                          <div className="font-semibold">{existingInvoiceRequest.telefono}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {existingInvoiceRequest.notes && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Notas del Cliente</h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{existingInvoiceRequest.notes}</p>
                    </div>
                  )}

                  <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => {
                        setShowInvoiceModal(false);
                        setInvoicingOrder(null);
                        setExistingInvoiceRequest(null);
                        setError('');
                      }}
                      className="px-6 bg-gray-600 dark:bg-gray-700 text-white py-3 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-all font-semibold"
                    >
                      Cerrar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Datos Fiscales Requeridos</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-400">Complete la información fiscal para generar la factura electrónica (CFDI)</p>
                  </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    RFC *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={13}
                    value={invoiceFormData.rfc}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, rfc: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="XAXX010101000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Razón Social *
                  </label>
                  <input
                    type="text"
                    required
                    value={invoiceFormData.razon_social}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, razon_social: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Nombre o razón social"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Régimen Fiscal *
                  </label>
                  <select
                    required
                    value={invoiceFormData.regimen_fiscal}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, regimen_fiscal: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="601">601 - General de Ley Personas Morales</option>
                    <option value="603">603 - Personas Morales con Fines no Lucrativos</option>
                    <option value="605">605 - Sueldos y Salarios e Ingresos Asimilados a Salarios</option>
                    <option value="606">606 - Arrendamiento</option>
                    <option value="608">608 - Demás ingresos</option>
                    <option value="610">610 - Residentes en el Extranjero sin Establecimiento Permanente en México</option>
                    <option value="611">611 - Ingresos por Dividendos (socios y accionistas)</option>
                    <option value="612">612 - Personas Físicas con Actividades Empresariales y Profesionales</option>
                    <option value="614">614 - Ingresos por intereses</option>
                    <option value="616">616 - Sin obligaciones fiscales</option>
                    <option value="620">620 - Sociedades Cooperativas de Producción que optan por diferir sus ingresos</option>
                    <option value="621">621 - Incorporación Fiscal</option>
                    <option value="622">622 - Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras</option>
                    <option value="623">623 - Opcional para Grupos de Sociedades</option>
                    <option value="624">624 - Coordinados</option>
                    <option value="625">625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas</option>
                    <option value="626">626 - Régimen Simplificado de Confianza</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Uso de CFDI *
                  </label>
                  <select
                    required
                    value={invoiceFormData.uso_cfdi}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, uso_cfdi: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="G01">G01 - Adquisición de mercancías</option>
                    <option value="G02">G02 - Devoluciones, descuentos o bonificaciones</option>
                    <option value="G03">G03 - Gastos en general</option>
                    <option value="I01">I01 - Construcciones</option>
                    <option value="I02">I02 - Mobilario y equipo de oficina por inversiones</option>
                    <option value="I03">I03 - Equipo de transporte</option>
                    <option value="I04">I04 - Equipo de computo y accesorios</option>
                    <option value="I05">I05 - Dados, troqueles, moldes, matrices y herramental</option>
                    <option value="I06">I06 - Comunicaciones telefónicas</option>
                    <option value="I07">I07 - Comunicaciones satelitales</option>
                    <option value="I08">I08 - Otra maquinaria y equipo</option>
                    <option value="D01">D01 - Honorarios médicos, dentales y gastos hospitalarios</option>
                    <option value="D02">D02 - Gastos médicos por incapacidad o discapacidad</option>
                    <option value="D03">D03 - Gastos funerales</option>
                    <option value="D04">D04 - Donativos</option>
                    <option value="D05">D05 - Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación)</option>
                    <option value="D06">D06 - Aportaciones voluntarias al SAR</option>
                    <option value="D07">D07 - Primas por seguros de gastos médicos</option>
                    <option value="D08">D08 - Gastos de transportación escolar obligatoria</option>
                    <option value="D09">D09 - Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones</option>
                    <option value="D10">D10 - Pagos por servicios educativos (colegiaturas)</option>
                    <option value="S01">S01 - Sin efectos fiscales</option>
                    <option value="CP01">CP01 - Pagos</option>
                    <option value="CN01">CN01 - Nómina</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 mt-2">Dirección Fiscal</h4>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Calle
                  </label>
                  <input
                    type="text"
                    value={invoiceFormData.calle}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, calle: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      No. Exterior
                    </label>
                    <input
                      type="text"
                      value={invoiceFormData.numero_exterior}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, numero_exterior: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      No. Interior
                    </label>
                    <input
                      type="text"
                      value={invoiceFormData.numero_interior}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, numero_interior: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Colonia
                  </label>
                  <input
                    type="text"
                    value={invoiceFormData.colonia}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, colonia: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Código Postal *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    value={invoiceFormData.codigo_postal}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, codigo_postal: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="00000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Municipio/Alcaldía
                  </label>
                  <input
                    type="text"
                    value={invoiceFormData.municipio}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, municipio: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Estado
                  </label>
                  <input
                    type="text"
                    value={invoiceFormData.estado}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, estado: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 mt-2">Datos de Contacto</h4>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={invoiceFormData.email}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="correo@ejemplo.com"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Se enviará la factura a este correo</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={invoiceFormData.telefono}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, telefono: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="5512345678"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notas Adicionales
                  </label>
                  <textarea
                    value={invoiceFormData.notes}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Información adicional para la factura..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-all font-semibold flex items-center justify-center gap-2"
                >
                  <Receipt className="w-5 h-5" />
                  Crear Solicitud de Factura
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInvoiceModal(false);
                    setInvoicingOrder(null);
                    setExistingInvoiceRequest(null);
                    setError('');
                  }}
                  className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all font-semibold"
                >
                  Cancelar
                </button>
              </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
