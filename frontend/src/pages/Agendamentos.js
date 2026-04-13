import React, { useState, useEffect } from 'react';
import { agendamentosAPI } from '../services/api';
import { 
  Plus, 
  MagnifyingGlass, 
  Pencil, 
  Trash, 
  Eye,
  CheckCircle,
  Clock,
  XCircle
} from '@phosphor-icons/react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const TIPOS = [
  { value: 'carregamento', label: 'Carregamento' },
  { value: 'visitante', label: 'Visitante' },
  { value: 'funcionario', label: 'Funcionário' },
  { value: 'diretoria', label: 'Diretoria' },
  { value: 'frota', label: 'Frota' },
];

const TIPOS_PERMISSAO = [
  { value: 'saida_antecipada', label: 'Saída Antecipada' },
  { value: 'entrada_atrasada', label: 'Entrada Atrasada' },
];

const Agendamentos = () => {
  const { isAdmin, user } = useAuth();
  const canManage = isAdmin || user?.role === 'gestor' || user?.role === 'dsl';
  
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAgendamento, setSelectedAgendamento] = useState(null);
  const [activeTab, setActiveTab] = useState('carregamento');
  
  const [filters, setFilters] = useState({
    status: 'pendente',
    data_inicio: '',
    data_fim: '',
    motorista: '',
    empresa: ''
  });
  
  const [formData, setFormData] = useState({
    tipo: 'carregamento',
    data_prevista: '',
    hora_prevista: '',
    placa_carreta: '',
    placa_cavalo: '',
    cubagem: '',
    motorista: '',
    empresa_terceirizada: '',
    destino: '',
    nome: '',
    placa: '',
    observacao: '',
    // Campos para funcionário - permissão de horário
    setor: '',
    responsavel: '',
    tipo_permissao: '',
    hora_permitida: '',
    // Campos para frota
    carro: '',
    km_saida: ''
  });

  useEffect(() => {
    loadAgendamentos();
  }, [activeTab, filters.status]);

  const loadAgendamentos = async () => {
    try {
      setLoading(true);
      const params = { tipo: activeTab };
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      if (filters.data_inicio) params.data_inicio = filters.data_inicio;
      if (filters.data_fim) params.data_fim = filters.data_fim;
      if (filters.motorista) params.motorista = filters.motorista;
      if (filters.empresa) params.empresa = filters.empresa;
      
      const response = await agendamentosAPI.list(params);
      setAgendamentos(response.data.items);
    } catch (error) {
      toast.error('Erro ao carregar agendamentos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedAgendamento) {
        await agendamentosAPI.update(selectedAgendamento.id, formData);
        toast.success('Agendamento atualizado');
      } else {
        await agendamentosAPI.create(formData);
        toast.success('Agendamento criado');
      }
      setDialogOpen(false);
      resetForm();
      loadAgendamentos();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao salvar');
    }
  };

  const handleCancel = async (agendamento) => {
    try {
      await agendamentosAPI.update(agendamento.id, { status: 'cancelado' });
      toast.success('Agendamento cancelado');
      loadAgendamentos();
    } catch (error) {
      toast.error('Erro ao cancelar');
    }
  };

  const handleDelete = async () => {
    try {
      await agendamentosAPI.delete(selectedAgendamento.id);
      toast.success('Agendamento excluído');
      setDeleteDialogOpen(false);
      setSelectedAgendamento(null);
      loadAgendamentos();
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const resetForm = () => {
    setFormData({
      tipo: activeTab,
      data_prevista: '',
      hora_prevista: '',
      placa_carreta: '',
      placa_cavalo: '',
      cubagem: '',
      motorista: '',
      empresa_terceirizada: '',
      destino: '',
      nome: '',
      placa: '',
      observacao: '',
      setor: '',
      responsavel: '',
      tipo_permissao: '',
      hora_permitida: '',
      carro: '',
      km_saida: ''
    });
    setSelectedAgendamento(null);
  };

  const openEditDialog = (agendamento) => {
    setSelectedAgendamento(agendamento);
    setFormData({
      tipo: agendamento.tipo,
      data_prevista: agendamento.data_prevista,
      hora_prevista: agendamento.hora_prevista || '',
      placa_carreta: agendamento.placa_carreta || '',
      placa_cavalo: agendamento.placa_cavalo || '',
      cubagem: agendamento.cubagem || '',
      motorista: agendamento.motorista || '',
      empresa_terceirizada: agendamento.empresa_terceirizada || '',
      destino: agendamento.destino || '',
      nome: agendamento.nome || '',
      placa: agendamento.placa || '',
      observacao: agendamento.observacao || '',
      setor: agendamento.setor || '',
      responsavel: agendamento.responsavel || '',
      tipo_permissao: agendamento.tipo_permissao || '',
      hora_permitida: agendamento.hora_permitida || '',
      carro: agendamento.carro || '',
      km_saida: agendamento.km_saida || ''
    });
    setDialogOpen(true);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pendente':
        return <span className="badge-warning flex items-center gap-1 w-fit"><Clock size={12} /> Pendente</span>;
      case 'realizado':
        return <span className="badge-success flex items-center gap-1 w-fit"><CheckCircle size={12} /> Realizado</span>;
      case 'cancelado':
        return <span className="badge-error flex items-center gap-1 w-fit"><XCircle size={12} /> Cancelado</span>;
      default:
        return <span className="badge-info">{status}</span>;
    }
  };

  return (
    <div className="space-y-6" data-testid="agendamentos-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white font-['Outfit']">Agendamentos</h1>
          <p className="text-gray-500 mt-1">Pré-cadastro para chegadas programadas</p>
        </div>
        {canManage && (
          <Button 
            onClick={() => { resetForm(); setDialogOpen(true); }}
            className="bg-white text-black hover:bg-gray-200"
            data-testid="add-agendamento-button"
          >
            <Plus size={18} className="mr-2" />
            Novo Agendamento
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#0A0A0A] border border-[#262626]">
          <TabsTrigger value="carregamento" className="data-[state=active]:bg-[#262626]">
            Carregamentos
          </TabsTrigger>
          <TabsTrigger value="visitante" className="data-[state=active]:bg-[#262626]">
            Visitantes
          </TabsTrigger>
          <TabsTrigger value="funcionario" className="data-[state=active]:bg-[#262626]">
            Funcionários
          </TabsTrigger>
          <TabsTrigger value="diretoria" className="data-[state=active]:bg-[#262626]">
            Diretoria
          </TabsTrigger>
          <TabsTrigger value="frota" className="data-[state=active]:bg-[#262626]">
            Frota
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="card-dark p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <Label className="text-gray-400 text-xs">Status</Label>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger className="bg-[#0A0A0A] border-[#262626] text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#141414] border-[#262626]">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="realizado">Realizado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-400 text-xs">Data Início</Label>
            <Input
              type="date"
              value={filters.data_inicio}
              onChange={(e) => setFilters({ ...filters, data_inicio: e.target.value })}
              className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">Data Fim</Label>
            <Input
              type="date"
              value={filters.data_fim}
              onChange={(e) => setFilters({ ...filters, data_fim: e.target.value })}
              className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
            />
          </div>
          {activeTab === 'carregamento' && (
            <div>
              <Label className="text-gray-400 text-xs">Empresa</Label>
              <Input
                placeholder="Buscar empresa"
                value={filters.empresa}
                onChange={(e) => setFilters({ ...filters, empresa: e.target.value })}
                className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
              />
            </div>
          )}
          <div className="flex items-end">
            <Button 
              onClick={loadAgendamentos}
              className="w-full bg-[#262626] text-white hover:bg-[#363636]"
            >
              <MagnifyingGlass size={18} className="mr-2" />
              Buscar
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card-dark overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[#262626] hover:bg-transparent">
              <TableHead className="text-gray-400">Data Prevista</TableHead>
              <TableHead className="text-gray-400">Hora</TableHead>
              {activeTab === 'carregamento' ? (
                <>
                  <TableHead className="text-gray-400">Motorista</TableHead>
                  <TableHead className="text-gray-400">Empresa</TableHead>
                  <TableHead className="text-gray-400">Destino</TableHead>
                </>
              ) : (
                <>
                  <TableHead className="text-gray-400">Nome</TableHead>
                  <TableHead className="text-gray-400">Placa</TableHead>
                </>
              )}
              <TableHead className="text-gray-400">Status</TableHead>
              <TableHead className="text-gray-400">Criado Por</TableHead>
              <TableHead className="text-gray-400 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : agendamentos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                  Nenhum agendamento encontrado
                </TableCell>
              </TableRow>
            ) : (
              agendamentos.map((ag) => (
                <TableRow key={ag.id} className="border-[#262626] hover:bg-[#1F1F1F]">
                  <TableCell className="text-white font-medium">{ag.data_prevista}</TableCell>
                  <TableCell className="text-gray-400 font-mono">{ag.hora_prevista || '-'}</TableCell>
                  {activeTab === 'carregamento' ? (
                    <>
                      <TableCell className="text-white">{ag.motorista || '-'}</TableCell>
                      <TableCell className="text-gray-400">{ag.empresa_terceirizada || '-'}</TableCell>
                      <TableCell className="text-gray-400">{ag.destino || '-'}</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="text-white">{ag.nome || '-'}</TableCell>
                      <TableCell className="text-gray-400 font-mono">{ag.placa || '-'}</TableCell>
                    </>
                  )}
                  <TableCell>{getStatusBadge(ag.status)}</TableCell>
                  <TableCell className="text-gray-400">{ag.criado_por}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSelectedAgendamento(ag); setViewDialogOpen(true); }}
                        className="text-gray-400 hover:text-white"
                      >
                        <Eye size={16} />
                      </Button>
                      {ag.status === 'pendente' && canManage && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(ag)}
                            className="text-gray-400 hover:text-white"
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancel(ag)}
                            className="text-yellow-400 hover:text-yellow-300"
                          >
                            <XCircle size={16} />
                          </Button>
                        </>
                      )}
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedAgendamento(ag); setDeleteDialogOpen(true); }}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash size={16} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#141414] border-[#262626] text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">
              {selectedAgendamento ? 'Editar Agendamento' : 'Novo Agendamento'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Tipo *</Label>
                <Select 
                  value={formData.tipo} 
                  onValueChange={(v) => setFormData({ ...formData, tipo: v })}
                  disabled={!!selectedAgendamento}
                >
                  <SelectTrigger className="bg-[#0A0A0A] border-[#262626] text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-[#262626]">
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-400">Data Prevista *</Label>
                <Input
                  type="date"
                  value={formData.data_prevista}
                  onChange={(e) => setFormData({ ...formData, data_prevista: e.target.value })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  required
                />
              </div>
            </div>
            
            <div>
              <Label className="text-gray-400">Hora Prevista</Label>
              <Input
                type="time"
                value={formData.hora_prevista}
                onChange={(e) => setFormData({ ...formData, hora_prevista: e.target.value })}
                className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
              />
            </div>

            {formData.tipo === 'carregamento' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Placa Carreta</Label>
                    <Input
                      value={formData.placa_carreta}
                      onChange={(e) => setFormData({ ...formData, placa_carreta: e.target.value.toUpperCase() })}
                      className="bg-[#0A0A0A] border-[#262626] text-white mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Placa Cavalo</Label>
                    <Input
                      value={formData.placa_cavalo}
                      onChange={(e) => setFormData({ ...formData, placa_cavalo: e.target.value.toUpperCase() })}
                      className="bg-[#0A0A0A] border-[#262626] text-white mt-1 font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Motorista</Label>
                    <Input
                      value={formData.motorista}
                      onChange={(e) => setFormData({ ...formData, motorista: e.target.value })}
                      className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Cubagem</Label>
                    <Input
                      value={formData.cubagem}
                      onChange={(e) => setFormData({ ...formData, cubagem: e.target.value })}
                      className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400">Empresa Terceirizada</Label>
                  <Input
                    value={formData.empresa_terceirizada}
                    onChange={(e) => setFormData({ ...formData, empresa_terceirizada: e.target.value })}
                    className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">Destino (Shopping)</Label>
                  <Input
                    value={formData.destino}
                    onChange={(e) => setFormData({ ...formData, destino: e.target.value })}
                    className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  />
                </div>
              </>
            )}

            {formData.tipo !== 'carregamento' && formData.tipo !== 'frota' && (
              <>
                <div>
                  <Label className="text-gray-400">Nome</Label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value.toUpperCase() })}
                    className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">Placa</Label>
                  <Input
                    value={formData.placa}
                    onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                    className="bg-[#0A0A0A] border-[#262626] text-white mt-1 font-mono"
                  />
                </div>
              </>
            )}

            {/* Campos específicos para Funcionário - Permissão de Horário */}
            {formData.tipo === 'funcionario' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Setor</Label>
                    <Input
                      value={formData.setor}
                      onChange={(e) => setFormData({ ...formData, setor: e.target.value.toUpperCase() })}
                      className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Responsável</Label>
                    <Input
                      value={formData.responsavel}
                      onChange={(e) => setFormData({ ...formData, responsavel: e.target.value.toUpperCase() })}
                      className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Tipo de Permissão</Label>
                    <Select value={formData.tipo_permissao} onValueChange={(v) => setFormData({ ...formData, tipo_permissao: v })}>
                      <SelectTrigger className="bg-[#0A0A0A] border-[#262626] text-white mt-1">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#141414] border-[#262626]">
                        {TIPOS_PERMISSAO.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-400">Hora Permitida</Label>
                    <Input
                      type="time"
                      value={formData.hora_permitida}
                      onChange={(e) => setFormData({ ...formData, hora_permitida: e.target.value })}
                      className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Campos específicos para Frota */}
            {formData.tipo === 'frota' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Carro</Label>
                    <Input
                      value={formData.carro}
                      onChange={(e) => setFormData({ ...formData, carro: e.target.value.toUpperCase() })}
                      className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                      placeholder="Ex: Fiat Strada"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Placa</Label>
                    <Input
                      value={formData.placa}
                      onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                      className="bg-[#0A0A0A] border-[#262626] text-white mt-1 font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Motorista</Label>
                    <Input
                      value={formData.motorista}
                      onChange={(e) => setFormData({ ...formData, motorista: e.target.value.toUpperCase() })}
                      className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">KM Saída</Label>
                    <Input
                      type="number"
                      value={formData.km_saida}
                      onChange={(e) => setFormData({ ...formData, km_saida: e.target.value })}
                      className="bg-[#0A0A0A] border-[#262626] text-white mt-1 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400">Destino</Label>
                  <Input
                    value={formData.destino}
                    onChange={(e) => setFormData({ ...formData, destino: e.target.value.toUpperCase() })}
                    className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  />
                </div>
              </>
            )}

            <div>
              <Label className="text-gray-400">Observação</Label>
              <Textarea
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setDialogOpen(false)}
                className="border-[#262626] text-white hover:bg-[#262626]"
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-white text-black hover:bg-gray-200">
                {selectedAgendamento ? 'Salvar' : 'Criar Agendamento'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="bg-[#141414] border-[#262626] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">Detalhes do Agendamento</DialogTitle>
          </DialogHeader>
          {selectedAgendamento && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Tipo</p>
                  <p className="text-white capitalize">{selectedAgendamento.tipo}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  {getStatusBadge(selectedAgendamento.status)}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Data Prevista</p>
                  <p className="text-white">{selectedAgendamento.data_prevista}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Hora Prevista</p>
                  <p className="text-white font-mono">{selectedAgendamento.hora_prevista || '-'}</p>
                </div>
              </div>
              
              {selectedAgendamento.tipo === 'carregamento' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Placa Carreta</p>
                    <p className="text-white font-mono">{selectedAgendamento.placa_carreta || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Placa Cavalo</p>
                    <p className="text-white font-mono">{selectedAgendamento.placa_cavalo || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Motorista</p>
                    <p className="text-white">{selectedAgendamento.motorista || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Cubagem</p>
                    <p className="text-white">{selectedAgendamento.cubagem || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Empresa</p>
                    <p className="text-white">{selectedAgendamento.empresa_terceirizada || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Destino</p>
                    <p className="text-white">{selectedAgendamento.destino || '-'}</p>
                  </div>
                </div>
              )}

              {selectedAgendamento.tipo !== 'carregamento' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Nome</p>
                    <p className="text-white">{selectedAgendamento.nome || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Placa</p>
                    <p className="text-white font-mono">{selectedAgendamento.placa || '-'}</p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-500">Criado Por</p>
                <p className="text-white">{selectedAgendamento.criado_por}</p>
              </div>

              {selectedAgendamento.observacao && (
                <div>
                  <p className="text-xs text-gray-500">Observação</p>
                  <p className="text-white">{selectedAgendamento.observacao}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#141414] border-[#262626]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#262626] text-white hover:bg-[#262626]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Agendamentos;
