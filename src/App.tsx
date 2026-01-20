import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LoginForm } from './components/auth/LoginForm';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { CompaniesManager } from './components/companies/CompaniesManager';
import { BranchesManager } from './components/branches/BranchesManager';
import { ServicesManager } from './components/services/ServicesManager';
import { AppointmentsManager } from './components/appointments/AppointmentsManager';
import { CustomersManager } from './components/customers/CustomersManager';
import { UsersManager } from './components/users/UsersManager';
import { StaffManager } from './components/staff/StaffManager';
import { CashManager } from './components/cash/CashManager';
import { MarketingManager } from './components/marketing/MarketingManager';
import { ReportsManager } from './components/reports/ReportsManager';
import { VehiclesManager } from './components/vehicles/VehiclesManager';
import { OrdersManager } from './components/orders/OrdersManager';
import { InventoryManager } from './components/inventory/InventoryManager';
import { AccountingManager } from './components/accounting/AccountingManager';
import ConfigurationManager from './components/settings/ConfigurationManager';
import { TrialBanner } from './components/shared/TrialBanner';
import { SubscriptionRequired } from './components/subscription/SubscriptionRequired';
import { UserProfile } from './components/profile/UserProfile';

function AppContent() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');

  useEffect(() => {
    // Check for subscription success
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscription_success') === 'true') {
      refreshProfile();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [refreshProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginForm />;
  }

  // Check for subscription blocking
  const company = (profile as any)?.company;
  if (company && company.subscription_status === 'trialing' && company.subscription_end_date) {
    const endDate = new Date(company.subscription_end_date);
    const now = new Date();
    if (now > endDate) {
      return <SubscriptionRequired />;
    }
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'companies':
        return <CompaniesManager />;
      case 'branches':
        return <BranchesManager />;
      case 'services':
        return <ServicesManager />;
      case 'appointments':
        return <AppointmentsManager />;
      case 'customers':
        return <CustomersManager />;
      case 'users':
        return <UsersManager />;
      case 'staff':
        return <StaffManager />;
      case 'cash':
        return <CashManager />;
      case 'accounting':
        return <AccountingManager />;
      case 'marketing':
        return <MarketingManager />;
      case 'reports':
        return <ReportsManager />;
      case 'vehicles':
        return <VehiclesManager />;
      case 'orders':
        return <OrdersManager />;
      case 'inventory':
        return <InventoryManager />;
      case 'configuration':
        return <ConfigurationManager />;
      case 'profile':
        return <UserProfile />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 dark:text-gray-100 flex flex-col h-screen overflow-hidden">
      <TrialBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentView={currentView} onNavigate={setCurrentView} />
        <main className="flex-1 overflow-y-auto lg:ml-0">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
