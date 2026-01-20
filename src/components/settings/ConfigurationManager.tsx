import React, { useState, useEffect } from 'react';
import { Upload, Save, Image as ImageIcon, Settings, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BillingSettings } from './BillingSettings';

interface CompanySettings {
  id: string;
  company_id: string;
  logo_url: string | null;
  ticket_header_text: string;
  ticket_footer_text: string;
}

export default function ConfigurationManager() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (profile?.company_id) {
      loadSettings();
    }
  }, [profile?.company_id]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', profile?.company_id || '')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings(data);
        setHeaderText(data.ticket_header_text || '');
        setFooterText(data.ticket_footer_text || '');
        if (data.logo_url) {
          setLogoPreview(data.logo_url);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      alert('Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo es demasiado grande. Máximo 5MB');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!selectedFile || !profile?.company_id) return null;

    try {
      setUploading(true);

      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${profile.company_id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      if (settings?.logo_url) {
        const oldFileName = settings.logo_url.split('/').pop();
        if (oldFileName) {
          await supabase.storage
            .from('company-logos')
            .remove([oldFileName]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Error al subir el logo');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!profile?.company_id) {
      alert('No se pudo identificar tu empresa');
      return;
    }

    try {
      setSaving(true);

      let logoUrl = settings?.logo_url || null;

      if (selectedFile) {
        const uploadedUrl = await uploadLogo();
        if (uploadedUrl) {
          logoUrl = uploadedUrl;
        }
      }

      if (settings) {
        const { error } = await supabase
          .from('company_settings')
          .update({
            logo_url: logoUrl,
            ticket_header_text: headerText,
            ticket_footer_text: footerText,
            updated_at: new Date().toISOString(),
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert({
            company_id: profile.company_id,
            logo_url: logoUrl,
            ticket_header_text: headerText,
            ticket_footer_text: footerText,
          });

        if (error) throw error;
      }

      alert('Configuración guardada exitosamente');
      setSelectedFile(null);
      await loadSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Configuración de la Empresa</h1>

        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('general')}
            className={`pb-4 px-6 font-medium text-sm transition-colors relative ${
              activeTab === 'general'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              General
            </div>
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`pb-4 px-6 font-medium text-sm transition-colors relative ${
              activeTab === 'billing'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Facturación
            </div>
          </button>
        </div>

        {activeTab === 'general' ? (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                  <ImageIcon className="w-5 h-5" />
                  Logo de la Empresa
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Este logo aparecerá en los tickets y documentos PDF generados por el sistema.
                  Formatos aceptados: JPG, PNG, WEBP. Tamaño máximo: 5MB.
                </p>

                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    {logoPreview ? (
                      <div className="w-48 h-48 border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-48 h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                        <div className="text-center text-gray-400 dark:text-gray-500">
                          <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                          <p className="text-sm">Sin logo</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="logo-upload"
                      />
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                        <Upload className="w-4 h-4" />
                        Seleccionar Logo
                      </div>
                    </label>
                    {selectedFile && (
                      <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                        Archivo seleccionado: {selectedFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                  Textos para Tickets y Documentos
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Texto del Encabezado
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Este texto aparecerá en la parte superior de los tickets y documentos.
                    </p>
                    <textarea
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                      placeholder="Ejemplo: Bienvenido a [Nombre de la Empresa]&#10;Dirección, teléfono, email&#10;RFC: XXXXXXXXXXXXXX"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Texto del Pie de Página
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Este texto aparecerá en la parte inferior de los tickets y documentos.
                    </p>
                    <textarea
                      value={footerText}
                      onChange={(e) => setFooterText(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                      placeholder="Ejemplo: ¡Gracias por su preferencia!&#10;Síguenos en redes sociales: @empresa&#10;www.miempresa.com"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-6 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving || uploading}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {saving || uploading ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            </div>

            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Vista Previa del Ticket</h3>
              <div className="bg-white dark:bg-gray-700 p-4 rounded border border-gray-200 dark:border-gray-600 text-sm">
                {headerText && (
                  <div className="border-b border-gray-200 dark:border-gray-600 pb-3 mb-3 whitespace-pre-line text-gray-700 dark:text-gray-200">
                    {headerText}
                  </div>
                )}
                
                <div className="text-center py-4 text-gray-400 dark:text-gray-400 italic">
                  [Aquí irá el contenido del ticket: productos, total, etc.]
                </div>

                {footerText && (
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3 whitespace-pre-line text-gray-700 dark:text-gray-200 text-center text-xs">
                    {footerText}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <BillingSettings />
        )}
      </div>
    </div>
  );
}
