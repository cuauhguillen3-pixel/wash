import { useEffect, useState } from 'react';
import { Receipt, CheckCircle, XCircle, Clock, Eye, X, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../lib/database.types';

type InvoiceRequest = Database['public']['Tables']['invoice_requests']['Row'];
type ServiceOrder = Database['public']['Tables']['service_orders']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];

interface InvoiceRequestWithDetails extends InvoiceRequest {
  service_order: ServiceOrder & {
    customer: Customer;
  };
}

export function InvoiceRequests() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<InvoiceRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingRequest, setViewingRequest] = useState<InvoiceRequestWithDetails | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendiente' | 'procesado' | 'cancelado'>('all');
  const [processNotes, setProcessNotes] = useState('');
  const [error, setError] = useState('');

  const isAdmin = profile?.role && ['admin', 'manager'].includes(profile.role);

  useEffect(() => {
    loadRequests();
  }, [profile, statusFilter]);

  const loadRequests = async () => {
    try {
      let query = supabase
        .from('invoice_requests')
        .select(`
          *,
          service_order:service_orders(
            *,
            customer:customers(*)
          )
        `)
        .eq('company_id', profile?.company_id!)
        .order('requested_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRequests(data as InvoiceRequestWithDetails[] || []);
    } catch (error) {
      console.error('Error loading invoice requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsProcessed = async (requestId: string) => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from('invoice_requests')
        .update({
          status: 'procesado',
          processed_by: profile?.id!,
          processed_at: new Date().toISOString(),
          processed_notes: processNotes || null,
        })
        .eq('id', requestId);

      if (error) throw error;

      await supabase
        .from('service_orders')
        .update({
          invoiced_at: new Date().toISOString(),
        })
        .eq('id', requests.find(r => r.id === requestId)?.order_id!);

      setViewingRequest(null);
      setProcessNotes('');
      loadRequests();
      alert('Factura marcada como procesada');
    } catch (error: any) {
      console.error('Error marking as processed:', error);
      setError(error.message || 'Error al procesar la solicitud');
    }
  };

  const markAsCancelled = async (requestId: string) => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from('invoice_requests')
        .update({
          status: 'cancelado',
          processed_by: profile?.id!,
          processed_at: new Date().toISOString(),
          processed_notes: processNotes || null,
        })
        .eq('id', requestId);

      if (error) throw error;

      setViewingRequest(null);
      setProcessNotes('');
      loadRequests();
      alert('Solicitud cancelada');
    } catch (error: any) {
      console.error('Error cancelling request:', error);
      setError(error.message || 'Error al cancelar la solicitud');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const statusLabels = {
    pendiente: 'Pendiente',
    procesado: 'Facturado',
    cancelado: 'Cancelado',
  };

  const statusColors = {
    pendiente: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    procesado: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    cancelado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const statusIcons = {
    pendiente: Clock,
    procesado: CheckCircle,
    cancelado: XCircle,
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Todas ({requests.length})
          </button>
          <button
            onClick={() => setStatusFilter('pendiente')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              statusFilter === 'pendiente'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setStatusFilter('procesado')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              statusFilter === 'procesado'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Facturadas
          </button>
          <button
            onClick={() => setStatusFilter('cancelado')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              statusFilter === 'cancelado'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Canceladas
          </button>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <Receipt className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No hay solicitudes de factura
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {statusFilter === 'all'
              ? 'Las solicitudes de factura aparecerán aquí'
              : `No hay solicitudes con estado: ${statusLabels[statusFilter]}`}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Ticket</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Cliente</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">RFC</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Razón Social</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Monto</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Estado</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Fecha</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {requests.map((request) => {
                  const StatusIcon = statusIcons[request.status as keyof typeof statusIcons];
                  return (
                    <tr key={request.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-blue-600 dark:text-blue-400">{request.service_order.ticket_number}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 dark:text-white">{request.service_order.customer.full_name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{request.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-sm text-gray-600 dark:text-gray-300">{request.rfc}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">{request.razon_social}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(Number(request.service_order.total))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${statusColors[request.status as keyof typeof statusColors]}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusLabels[request.status as keyof typeof statusLabels]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(request.requested_at).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewingRequest(request)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewingRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Solicitud de Factura</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Orden: {viewingRequest.service_order.ticket_number}</p>
              </div>
              <button
                onClick={() => {
                  setViewingRequest(null);
                  setProcessNotes('');
                  setError('');
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
              >
                <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3">Información de la Orden</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-600 dark:text-gray-400">Ticket:</span> <span className="font-semibold dark:text-white">{viewingRequest.service_order.ticket_number}</span></div>
                    <div><span className="text-gray-600 dark:text-gray-400">Cliente:</span> <span className="font-semibold dark:text-white">{viewingRequest.service_order.customer.full_name}</span></div>
                    <div><span className="text-gray-600 dark:text-gray-400">Total:</span> <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(Number(viewingRequest.service_order.total))}</span></div>
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-300 mb-3">Estado de Solicitud</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${statusColors[viewingRequest.status as keyof typeof statusColors]}`}>
                        {(() => {
                          const StatusIcon = statusIcons[viewingRequest.status as keyof typeof statusIcons];
                          return <StatusIcon className="w-3 h-3" />;
                        })()}
                        {statusLabels[viewingRequest.status as keyof typeof statusLabels]}
                      </span>
                    </div>
                    <div><span className="text-gray-600 dark:text-gray-400">Solicitado:</span> <span className="dark:text-white">{new Date(viewingRequest.requested_at).toLocaleString('es-MX')}</span></div>
                    {viewingRequest.processed_at && (
                      <div><span className="text-gray-600 dark:text-gray-400">Procesado:</span> <span className="dark:text-white">{new Date(viewingRequest.processed_at).toLocaleString('es-MX')}</span></div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Datos Fiscales</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">RFC:</span>
                    <div className="font-mono font-semibold dark:text-white">{viewingRequest.rfc}</div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Razón Social:</span>
                    <div className="font-semibold dark:text-white">{viewingRequest.razon_social}</div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Régimen Fiscal:</span>
                    <div className="font-semibold dark:text-white">{viewingRequest.regimen_fiscal}</div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Uso de CFDI:</span>
                    <div className="font-semibold dark:text-white">{viewingRequest.uso_cfdi}</div>
                  </div>
                </div>
              </div>

              {viewingRequest.calle && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Dirección Fiscal</h4>
                  <div className="text-sm text-gray-900 dark:text-white">
                    <div>{viewingRequest.calle} {viewingRequest.numero_exterior} {viewingRequest.numero_interior}</div>
                    <div>{viewingRequest.colonia}</div>
                    <div>C.P. {viewingRequest.codigo_postal}, {viewingRequest.municipio}, {viewingRequest.estado}</div>
                  </div>
                </div>
              )}

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Datos de Contacto</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Email:</span>
                    <div className="font-semibold dark:text-white">{viewingRequest.email}</div>
                  </div>
                  {viewingRequest.telefono && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Teléfono:</span>
                      <div className="font-semibold dark:text-white">{viewingRequest.telefono}</div>
                    </div>
                  )}
                </div>
              </div>

              {viewingRequest.notes && (
                <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Notas del Cliente</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{viewingRequest.notes}</p>
                </div>
              )}

              {viewingRequest.processed_notes && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Notas de Procesamiento</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-400">{viewingRequest.processed_notes}</p>
                </div>
              )}

              {isAdmin && viewingRequest.status === 'pendiente' && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Procesar Solicitud</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Notas de Procesamiento
                      </label>
                      <textarea
                        value={processNotes}
                        onChange={(e) => setProcessNotes(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Folio fiscal, observaciones, etc..."
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => markAsProcessed(viewingRequest.id)}
                        className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-all font-semibold flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Marcar como Facturado
                      </button>
                      <button
                        onClick={() => markAsCancelled(viewingRequest.id)}
                        className="flex-1 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition-all font-semibold flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-5 h-5" />
                        Cancelar Solicitud
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
