import { useState } from 'react';
import { Tag, Wallet, Gift, TrendingUp } from 'lucide-react';
import { LoyaltyWallet } from './LoyaltyWallet';

type Section = 'campaigns' | 'wallet' | 'coupons' | 'segments';

export function MarketingManager() {
  const [activeSection, setActiveSection] = useState<Section>('wallet');

  const sections = [
    { id: 'campaigns' as Section, name: 'Campañas', icon: TrendingUp, available: false },
    { id: 'wallet' as Section, name: 'Monedero Fidelidad', icon: Wallet, available: true },
    { id: 'coupons' as Section, name: 'Cupones', icon: Gift, available: false },
    { id: 'segments' as Section, name: 'Segmentos', icon: Tag, available: false },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Marketing</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Campañas, cupones y segmentos</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <nav className="flex -mb-px">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => section.available && setActiveSection(section.id)}
                  className={`
                    flex items-center gap-2 px-6 py-4 border-b-2 font-medium text-sm transition-all
                    ${activeSection === section.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : section.available
                        ? 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                        : 'border-transparent text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    }
                  `}
                  disabled={!section.available}
                >
                  <Icon className="w-5 h-5" />
                  {section.name}
                  {!section.available && (
                    <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                      Próximamente
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeSection === 'wallet' && <LoyaltyWallet />}
          {activeSection === 'campaigns' && (
            <div className="text-center py-12">
              <TrendingUp className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Campañas de Marketing
              </h3>
              <p className="text-gray-600 dark:text-gray-400">Funcionalidad disponible próximamente</p>
            </div>
          )}
          {activeSection === 'coupons' && (
            <div className="text-center py-12">
              <Gift className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Cupones y Descuentos
              </h3>
              <p className="text-gray-600 dark:text-gray-400">Funcionalidad disponible próximamente</p>
            </div>
          )}
          {activeSection === 'segments' && (
            <div className="text-center py-12">
              <Tag className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Segmentación de Clientes
              </h3>
              <p className="text-gray-600 dark:text-gray-400">Funcionalidad disponible próximamente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
