import React, { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { 
  Users, 
  Car, 
  UserCircle, 
  Crown, 
  ArrowRight,
  Clock,
  CalendarBlank,
  TrendUp
} from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

const StatCard = ({ icon: Icon, label, value, color, link }) => (
  <div className="card-dark p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 mb-1">{label}</p>
        <p className="text-3xl font-semibold text-white font-['Outfit']">{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-md flex items-center justify-center ${color}`}>
        <Icon size={22} weight="duotone" className="text-white" />
      </div>
    </div>
    {link && (
      <Link to={link} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mt-4 transition-colors">
        Ver todos <ArrowRight size={14} />
      </Link>
    )}
  </div>
);

const QuickAction = ({ icon: Icon, label, onClick, testId }) => (
  <button
    onClick={onClick}
    data-testid={testId}
    className="flex items-center gap-3 w-full p-4 bg-[#0A0A0A] border border-[#262626] rounded-md hover:border-[#3B82F6] transition-colors text-left"
  >
    <div className="w-10 h-10 bg-[#141414] rounded-md flex items-center justify-center">
      <Icon size={20} weight="duotone" className="text-white" />
    </div>
    <span className="text-sm font-medium text-white">{label}</span>
  </button>
);

const RecentItem = ({ type, data }) => {
  const getStatusBadge = () => {
    if (type === 'fleet') {
      return data.status === 'em_uso' 
        ? <span className="badge-warning">Em Uso</span>
        : <span className="badge-success">Retornado</span>;
    }
    return data.hora_saida 
      ? <span className="badge-success">Saiu</span>
      : <span className="badge-info">Presente</span>;
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-[#262626] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {type === 'fleet' ? data.motorista : data.nome}
        </p>
        <p className="text-xs text-gray-500 font-mono">
          {type === 'fleet' ? data.placa : (data.placa || data.hora_entrada)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {getStatusBadge()}
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await dashboardAPI.get();
      setData(response.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  const today = data?.today || {};
  const week = data?.week || {};

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white font-['Outfit']">Dashboard</h1>
        <p className="text-gray-500 mt-1">Visão geral do controle de acesso</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          icon={Users} 
          label="Visitantes Hoje" 
          value={today.visitors || 0} 
          color="bg-blue-500/20"
          link="/visitantes"
        />
        <StatCard 
          icon={UserCircle} 
          label="Funcionários Hoje" 
          value={today.employees || 0} 
          color="bg-green-500/20"
          link="/funcionarios"
        />
        <StatCard 
          icon={Crown} 
          label="Diretoria Hoje" 
          value={today.directors || 0} 
          color="bg-purple-500/20"
          link="/diretoria"
        />
        <StatCard 
          icon={Car} 
          label="Veículos em Uso" 
          value={today.fleet_in_use || 0} 
          color="bg-yellow-500/20"
          link="/frota"
        />
        <StatCard 
          icon={TrendUp} 
          label="Retornos Hoje" 
          value={today.fleet_returned || 0} 
          color="bg-emerald-500/20"
          link="/frota"
        />
      </div>

      {/* Quick Actions */}
      <div className="card-dark p-6">
        <h2 className="text-lg font-semibold text-white mb-4 font-['Outfit']">Ações Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/visitantes?action=new">
            <QuickAction icon={Users} label="Registrar Visitante" testId="quick-add-visitor" />
          </Link>
          <Link to="/frota?action=new">
            <QuickAction icon={Car} label="Registrar Saída de Veículo" testId="quick-add-fleet" />
          </Link>
          <Link to="/funcionarios?action=new">
            <QuickAction icon={UserCircle} label="Registrar Funcionário" testId="quick-add-employee" />
          </Link>
          <Link to="/diretoria?action=new">
            <QuickAction icon={Crown} label="Registrar Diretoria" testId="quick-add-director" />
          </Link>
        </div>
      </div>

      {/* Recent Activity & Fleet Out */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Visitors */}
        <div className="card-dark p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white font-['Outfit']">Visitantes Recentes</h2>
            <Link to="/visitantes">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                Ver todos
              </Button>
            </Link>
          </div>
          <div className="space-y-1">
            {data?.recent_visitors?.length > 0 ? (
              data.recent_visitors.map((visitor) => (
                <RecentItem key={visitor.id} type="visitor" data={visitor} />
              ))
            ) : (
              <p className="text-gray-500 text-sm py-4 text-center">Nenhum visitante recente</p>
            )}
          </div>
        </div>

        {/* Fleet Out */}
        <div className="card-dark p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white font-['Outfit']">Veículos em Uso</h2>
            <Link to="/frota?status=em_uso">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                Ver todos
              </Button>
            </Link>
          </div>
          <div className="space-y-1">
            {data?.fleet_out?.length > 0 ? (
              data.fleet_out.slice(0, 5).map((fleet) => (
                <RecentItem key={fleet.id} type="fleet" data={fleet} />
              ))
            ) : (
              <p className="text-gray-500 text-sm py-4 text-center">Nenhum veículo em uso</p>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Summary */}
      <div className="card-dark p-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarBlank size={20} weight="duotone" className="text-gray-400" />
          <h2 className="text-lg font-semibold text-white font-['Outfit']">Resumo Semanal</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex items-center gap-4 p-4 bg-[#0A0A0A] rounded-md">
            <div className="w-12 h-12 bg-blue-500/20 rounded-md flex items-center justify-center">
              <Users size={24} weight="duotone" className="text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{week.visitors || 0}</p>
              <p className="text-sm text-gray-500">Visitantes na semana</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-[#0A0A0A] rounded-md">
            <div className="w-12 h-12 bg-green-500/20 rounded-md flex items-center justify-center">
              <UserCircle size={24} weight="duotone" className="text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{week.employees || 0}</p>
              <p className="text-sm text-gray-500">Funcionários na semana</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
