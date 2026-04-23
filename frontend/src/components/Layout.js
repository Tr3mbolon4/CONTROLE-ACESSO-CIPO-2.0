import React, { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  House,
  Users,
  Car,
  UserCircle,
  Crown,
  ChartBar,
  Gear,
  SignOut,
  List,
  X,
  Truck,
  CalendarCheck
} from '@phosphor-icons/react';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

const Layout = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', icon: House, label: 'Dashboard' },
    { path: '/visitantes', icon: Users, label: 'Visitantes' },
    { path: '/frota', icon: Car, label: 'Frota' },
    { path: '/carregamentos', icon: Truck, label: 'Carregamentos' },
    { path: '/funcionarios', icon: UserCircle, label: 'Funcionários' },
    { path: '/diretoria', icon: Crown, label: 'Diretoria' },
    { path: '/agendamentos', icon: CalendarCheck, label: 'Agendamentos' },
    { path: '/relatorios', icon: ChartBar, label: 'Relatórios' },
  ];

  if (isAdmin) {
    navItems.push({ path: '/configuracoes', icon: Gear, label: 'Configurações' });
  }

  const roleLabels = {
    admin: 'Administrador',
    portaria: 'Portaria',
    gestor: 'Gestor',
    diretoria: 'Diretoria'
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-[#0A0A0A] border-r border-[#262626]
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-[#262626]">
            <img 
              src="https://customer-assets.emergentagent.com/job_portaria-acesso/artifacts/cligmmqg_icone%20cipo.png" 
              alt="CIPOLATTI" 
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <h1 className="text-lg font-semibold text-white font-['Outfit']">CIPOLATTI</h1>
              <p className="text-xs text-gray-500">Controle de Acesso</p>
            </div>
            <button 
              className="lg:hidden ml-auto text-gray-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={24} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase()}`}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium
                  transition-colors duration-200
                  ${isActive 
                    ? 'bg-[#262626] text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-[#141414]'
                  }
                `}
              >
                <item.icon size={20} weight="duotone" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* User section */}
          <div className="px-4 py-4 border-t border-[#262626]">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#141414] transition-colors"
                  data-testid="user-menu-trigger"
                >
                  <div className="w-8 h-8 bg-[#262626] rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                    <p className="text-xs text-gray-500">{roleLabels[user?.role] || user?.role}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-[#141414] border-[#262626]">
                <div className="px-3 py-2">
                  <p className="text-sm text-white">{user?.email}</p>
                </div>
                <DropdownMenuSeparator className="bg-[#262626]" />
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
                  data-testid="logout-button"
                >
                  <SignOut size={18} className="mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-[#0A0A0A] border-b border-[#262626] px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button 
              className="lg:hidden text-gray-400 hover:text-white"
              onClick={() => setSidebarOpen(true)}
              data-testid="mobile-menu-button"
            >
              <List size={24} />
            </button>
            <div className="hidden lg:block" />
            <div className="text-sm text-gray-500">
              {new Date().toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 bg-[#141414]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
