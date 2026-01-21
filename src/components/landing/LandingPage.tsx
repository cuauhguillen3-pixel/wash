import { ArrowRight, Building2, Calendar, Users, TrendingUp, Shield, Zap, CheckCircle, Car } from 'lucide-react';
import { useState } from 'react';

interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
}

export function LandingPage({ onLogin, onRegister }: LandingPageProps) {
  const [logoError, setLogoError] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex justify-end items-center h-20">
            <div className="absolute left-4 top-2 md:top-4 z-50">
              {!logoError ? (
                <img 
                  src="/logo.png" 
                  alt="Carwash Suite" 
                  className="h-32 md:h-64 w-auto object-contain drop-shadow-xl"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="bg-blue-900 p-2 rounded-lg">
                    <Car className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-gray-900 leading-none">Carwash</span>
                    <span className="text-sm font-semibold text-blue-600 leading-none">Suite</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={onLogin}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                Iniciar Sesión
              </button>
              <button
                onClick={onRegister}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium shadow-md"
              >
                Registrar Empresa
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Gestiona tu Carwash con
            <span className="text-blue-600"> Eficiencia Total</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Sistema completo de gestión para carwash con múltiples sucursales.
            Control de citas, personal, inventario y reportes en tiempo real.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onRegister}
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold text-lg shadow-lg hover:shadow-xl"
            >
              Comenzar Gratis
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={onLogin}
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 rounded-lg hover:bg-gray-50 transition-all font-semibold text-lg shadow-lg border-2 border-gray-200"
            >
              Iniciar Sesión
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all">
            <div className="bg-blue-100 w-14 h-14 rounded-xl flex items-center justify-center mb-4">
              <Calendar className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Gestión de Citas
            </h3>
            <p className="text-gray-600">
              Agenda y administra citas de forma eficiente. Control de horarios, servicios y asignación de personal.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all">
            <div className="bg-green-100 w-14 h-14 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Control de Personal
            </h3>
            <p className="text-gray-600">
              Administra tu equipo de trabajo. Roles, permisos, horarios y desempeño en un solo lugar.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all">
            <div className="bg-orange-100 w-14 h-14 rounded-xl flex items-center justify-center mb-4">
              <TrendingUp className="w-7 h-7 text-orange-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Reportes en Tiempo Real
            </h3>
            <p className="text-gray-600">
              Analiza el rendimiento de tu negocio con reportes detallados de ventas, servicios y productividad.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Todo lo que necesitas para tu Carwash
            </h2>
            <p className="text-xl text-gray-600">
              Funcionalidades completas para empresas de todos los tamaños
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-start gap-4 p-6 rounded-xl hover:bg-gray-50 transition-all">
              <div className="flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Múltiples Sucursales
                </h3>
                <p className="text-gray-600">
                  Gestiona todas tus sucursales desde un solo sistema centralizado.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 rounded-xl hover:bg-gray-50 transition-all">
              <div className="flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Control de Inventario
                </h3>
                <p className="text-gray-600">
                  Administra productos, materiales y stock en tiempo real.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 rounded-xl hover:bg-gray-50 transition-all">
              <div className="flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Base de Clientes
                </h3>
                <p className="text-gray-600">
                  Mantén un registro detallado de tus clientes y su historial.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 rounded-xl hover:bg-gray-50 transition-all">
              <div className="flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Marketing Integrado
                </h3>
                <p className="text-gray-600">
                  Herramientas de marketing para atraer y retener clientes.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 rounded-xl hover:bg-gray-50 transition-all">
              <div className="flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Control de Caja
                </h3>
                <p className="text-gray-600">
                  Registra y controla todas las operaciones de efectivo.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 rounded-xl hover:bg-gray-50 transition-all">
              <div className="flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Roles y Permisos
                </h3>
                <p className="text-gray-600">
                  Sistema de permisos flexible para diferentes niveles de acceso.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-blue-600 to-blue-700 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Por qué elegir Carwash Suite
            </h2>
            <p className="text-xl text-blue-100">
              La solución más completa y confiable del mercado
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                Seguro y Confiable
              </h3>
              <p className="text-blue-100">
                Tus datos están protegidos con las mejores prácticas de seguridad.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                Rápido y Eficiente
              </h3>
              <p className="text-blue-100">
                Sistema optimizado para operaciones rápidas y fluidas.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                Soporte Dedicado
              </h3>
              <p className="text-blue-100">
                Equipo de soporte listo para ayudarte cuando lo necesites.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            ¿Listo para transformar tu negocio?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Únete a las empresas que ya están mejorando su gestión con Carwash Suite
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onRegister}
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold text-lg shadow-lg hover:shadow-xl"
            >
              Registrar mi Empresa
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={onLogin}
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 rounded-lg hover:bg-gray-50 transition-all font-semibold text-lg shadow-lg border-2 border-gray-200"
            >
              Iniciar Sesión
            </button>
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Car className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold">Carwash Suite</span>
            </div>
            <div className="text-gray-400 text-sm">
              2025 Carwash Suite. Sistema de gestión profesional para carwash.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
