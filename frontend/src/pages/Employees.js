import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { employeesAPI, agendamentosAPI } from '../services/api';
import { printEmployees } from '../utils/printUtils';
import { 
  Plus, 
  MagnifyingGlass, 
  Pencil, 
  Trash, 
  Eye,
  SignOut,
  Printer,
  CheckCircle,
  XCircle,
  CalendarCheck,
  SignIn,
  Clock
} from '@phosphor-icons/react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
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

const Employees = () => {
  const { isAdmin, isPortaria } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [employees, setEmployees] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ativos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [filters, setFilters] = useState({
    nome: '',
    setor: '',
    placa: '',
    autorizado: '',
    data_inicio: '',
    data_fim: ''
  });
  const [formData, setFormData] = useState({
    nome: '',
    setor: '',
    responsavel: '',
    autorizado: true,
    placa: '',
    observacao: ''
  });

  useEffect(() => {
    loadEmployees();
    loadAgendamentos();
    if (searchParams.get('action') === 'new') {
      setDialogOpen(true);
      setSearchParams({});
    }
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.nome) params.nome = filters.nome;
      if (filters.setor) params.setor = filters.setor;
      if (filters.placa) params.placa = filters.placa;
      if (filters.autorizado === 'true') params.autorizado = true;
      if (filters.autorizado === 'false') params.autorizado = false;
      if (filters.data_inicio) params.data_inicio = filters.data_inicio;
      if (filters.data_fim) params.data_fim = filters.data_fim;
      
      const response = await employeesAPI.list(params);
      setEmployees(response.data.items);
    } catch (error) {
      toast.error('Erro ao carregar funcionários');
    } finally {
      setLoading(false);
    }
  };

  const loadAgendamentos = async () => {
    try {
      const response = await agendamentosAPI.list({ tipo: 'funcionario', status: 'pendente' });
      setAgendamentos(response.data.items);
    } catch (error) {
      console.error('Error loading agendamentos:', error);
    }
  };

  const handleDarEntrada = async (agendamento) => {
    try {
      await agendamentosAPI.darEntrada(agendamento.id);
      toast.success('Entrada registrada com sucesso!');
      loadEmployees();
      loadAgendamentos();
      setActiveTab('ativos');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao dar entrada');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedEmployee) {
        await employeesAPI.update(selectedEmployee.id, formData);
        toast.success('Funcionário atualizado');
      } else {
        await employeesAPI.create(formData);
        toast.success('Entrada registrada');
      }
      setDialogOpen(false);
      resetForm();
      loadEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao salvar');
    }
  };

  const handleRegisterExit = async (employee) => {
    try {
      const now = new Date();
      await employeesAPI.update(employee.id, {
        hora_saida: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      });
      toast.success('Saída registrada');
      loadEmployees();
    } catch (error) {
      toast.error('Erro ao registrar saída');
    }
  };

  const handleDelete = async () => {
    try {
      await employeesAPI.delete(selectedEmployee.id);
      toast.success('Registro excluído');
      setDeleteDialogOpen(false);
      setSelectedEmployee(null);
      loadEmployees();
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      setor: '',
      responsavel: '',
      autorizado: true,
      placa: '',
      observacao: ''
    });
    setSelectedEmployee(null);
  };

  const openEditDialog = (employee) => {
    setSelectedEmployee(employee);
    setFormData({
      nome: employee.nome,
      setor: employee.setor,
      responsavel: employee.responsavel || '',
      autorizado: employee.autorizado,
      placa: employee.placa || '',
      observacao: employee.observacao || ''
    });
    setDialogOpen(true);
  };

  const toggleSelectItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === employees.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(employees.map(e => e.id));
    }
  };

  const handlePrintSelected = () => {
    const itemsToPrint = employees.filter(e => selectedItems.includes(e.id));
    if (itemsToPrint.length === 0) {
      toast.error('Selecione pelo menos um registro para imprimir');
      return;
    }
    printEmployees(itemsToPrint);
  };

  const handlePrint = (employee) => {
    printEmployees([employee]);
  };

  const getTipoPermissaoLabel = (tipo) => {
    switch (tipo) {
      case 'saida_antecipada': return 'Saída Antecipada';
      case 'entrada_atrasada': return 'Entrada Atrasada';
      default: return tipo || '-';
    }
  };

  return (
    <div className="space-y-6" data-testid="employees-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white font-['Outfit']">Funcionários</h1>
          <p className="text-gray-500 mt-1">Registro de entrada e saída de funcionários</p>
        </div>
        <div className="flex gap-2">
          {selectedItems.length > 0 && (
            <Button 
              onClick={handlePrintSelected}
              variant="outline"
              className="border-[#262626] text-white hover:bg-[#262626]"
              data-testid="print-selected-button"
            >
              <Printer size={18} className="mr-2" />
              Imprimir ({selectedItems.length})
            </Button>
          )}
          {(isAdmin || isPortaria) && (
            <Button 
              onClick={() => { resetForm(); setDialogOpen(true); }}
              className="bg-white text-black hover:bg-gray-200"
              data-testid="add-employee-button"
            >
              <Plus size={18} className="mr-2" />
              Registrar Entrada
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#0A0A0A] border border-[#262626]">
          <TabsTrigger value="ativos" className="data-[state=active]:bg-[#262626]">
            Presentes ({employees.filter(e => !e.hora_saida).length})
          </TabsTrigger>
          <TabsTrigger value="agendados" className="data-[state=active]:bg-[#262626]">
            <CalendarCheck size={16} className="mr-1" />
            Permissões ({agendamentos.length})
          </TabsTrigger>
          <TabsTrigger value="historico" className="data-[state=active]:bg-[#262626]">
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Agendados/Permissões Tab */}
        <TabsContent value="agendados" className="mt-4">
          <div className="mb-4 p-4 bg-[#1a1a1a] border border-[#262626] rounded-lg">
            <div className="flex items-center gap-2 text-yellow-400">
              <Clock size={20} />
              <span className="font-medium">Permissões de Horário</span>
            </div>
            <p className="text-gray-500 text-sm mt-1">
              Funcionários com autorização para entrada/saída fora do horário padrão
            </p>
          </div>
          
          <div className="card-dark overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[#262626] hover:bg-transparent">
                  <TableHead className="text-gray-400">Data</TableHead>
                  <TableHead className="text-gray-400">Hora Permitida</TableHead>
                  <TableHead className="text-gray-400">Nome</TableHead>
                  <TableHead className="text-gray-400">Setor</TableHead>
                  <TableHead className="text-gray-400">Tipo Permissão</TableHead>
                  <TableHead className="text-gray-400">Criado Por</TableHead>
                  <TableHead className="text-gray-400 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agendamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      Nenhuma permissão de horário registrada
                    </TableCell>
                  </TableRow>
                ) : (
                  agendamentos.map((ag) => (
                    <TableRow key={ag.id} className="border-[#262626] hover:bg-[#1F1F1F]">
                      <TableCell className="text-white font-medium">{ag.data_prevista}</TableCell>
                      <TableCell className="text-gray-400 font-mono">{ag.hora_permitida || ag.hora_prevista || '-'}</TableCell>
                      <TableCell className="text-white">{ag.nome || '-'}</TableCell>
                      <TableCell className="text-gray-400">{ag.setor || '-'}</TableCell>
                      <TableCell>
                        {ag.tipo_permissao === 'saida_antecipada' ? (
                          <span className="badge-warning flex items-center gap-1 w-fit">
                            <SignOut size={12} /> Saída Antecipada
                          </span>
                        ) : ag.tipo_permissao === 'entrada_atrasada' ? (
                          <span className="badge-info flex items-center gap-1 w-fit">
                            <SignIn size={12} /> Entrada Atrasada
                          </span>
                        ) : (
                          <span className="text-gray-400">{ag.tipo_permissao || '-'}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-400">{ag.criado_por}</TableCell>
                      <TableCell className="text-right">
                        {(isAdmin || isPortaria) && (
                          <Button
                            onClick={() => handleDarEntrada(ag)}
                            className="bg-green-600 text-white hover:bg-green-700"
                            size="sm"
                            data-testid={`dar-entrada-${ag.id}`}
                          >
                            <SignIn size={16} className="mr-1" />
                            Dar Entrada
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Ativos Tab */}
        <TabsContent value="ativos" className="mt-4 space-y-4">
          <div className="card-dark overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[#262626] hover:bg-transparent">
                  <TableHead className="text-gray-400 w-10">
                    <Checkbox
                      checked={selectedItems.length === employees.filter(e => !e.hora_saida).length && employees.filter(e => !e.hora_saida).length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-gray-400">Nome</TableHead>
                  <TableHead className="text-gray-400">Setor</TableHead>
                  <TableHead className="text-gray-400">Data</TableHead>
                  <TableHead className="text-gray-400">Entrada</TableHead>
                  <TableHead className="text-gray-400">Autorizado</TableHead>
                  <TableHead className="text-gray-400">Status Saída</TableHead>
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
                ) : employees.filter(e => !e.hora_saida).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                      Nenhum funcionário presente
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.filter(e => !e.hora_saida).map((employee) => (
                    <TableRow key={employee.id} className="border-[#262626] hover:bg-[#1F1F1F]">
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(employee.id)}
                          onCheckedChange={() => toggleSelectItem(employee.id)}
                        />
                      </TableCell>
                      <TableCell className="text-white font-medium">{employee.nome}</TableCell>
                      <TableCell className="text-gray-400">{employee.setor}</TableCell>
                      <TableCell className="text-gray-400">{employee.data}</TableCell>
                      <TableCell className="text-gray-400 font-mono">{employee.hora_entrada}</TableCell>
                      <TableCell>
                        {employee.autorizado ? (
                          <span className="badge-success flex items-center gap-1 w-fit">
                            <CheckCircle size={14} /> Sim
                          </span>
                        ) : (
                          <span className="badge-error flex items-center gap-1 w-fit">
                            <XCircle size={14} /> Não
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.autorizado ? (
                          <span className="badge-success flex items-center gap-1 w-fit">
                            <CheckCircle size={12} /> Autorizada
                          </span>
                        ) : (
                          <span className="badge-error flex items-center gap-1 w-fit">
                            <XCircle size={12} /> Não Autorizada
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedEmployee(employee); setViewDialogOpen(true); }}
                            className="text-gray-400 hover:text-white"
                            data-testid={`view-employee-${employee.id}`}
                          >
                            <Eye size={16} />
                          </Button>
                          {(isAdmin || isPortaria) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRegisterExit(employee)}
                              className="text-yellow-400 hover:text-yellow-300"
                              data-testid={`exit-employee-${employee.id}`}
                            >
                              <SignOut size={16} />
                            </Button>
                          )}
                          {(isAdmin || isPortaria) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(employee)}
                              className="text-gray-400 hover:text-white"
                              data-testid={`edit-employee-${employee.id}`}
                            >
                              <Pencil size={16} />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePrint(employee)}
                            className="text-gray-400 hover:text-white"
                            data-testid={`print-employee-${employee.id}`}
                          >
                            <Printer size={16} />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSelectedEmployee(employee); setDeleteDialogOpen(true); }}
                              className="text-red-400 hover:text-red-300"
                              data-testid={`delete-employee-${employee.id}`}
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
        </TabsContent>

        {/* Histórico Tab */}
        <TabsContent value="historico" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="card-dark p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              <div>
                <Label className="text-gray-400 text-xs">Nome</Label>
                <Input
                  placeholder="Buscar por nome"
                  value={filters.nome}
                  onChange={(e) => setFilters({ ...filters, nome: e.target.value.toUpperCase() })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  data-testid="filter-nome"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Setor</Label>
                <Input
                  placeholder="Buscar por setor"
                  value={filters.setor}
                  onChange={(e) => setFilters({ ...filters, setor: e.target.value.toUpperCase() })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  data-testid="filter-setor"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Autorizado</Label>
                <Select value={filters.autorizado} onValueChange={(v) => setFilters({ ...filters, autorizado: v })}>
                  <SelectTrigger className="bg-[#0A0A0A] border-[#262626] text-white mt-1">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-[#262626]">
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">Não</SelectItem>
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
                  data-testid="filter-data-inicio"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Data Fim</Label>
                <Input
                  type="date"
                  value={filters.data_fim}
                  onChange={(e) => setFilters({ ...filters, data_fim: e.target.value })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  data-testid="filter-data-fim"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={() => { if (filters.autorizado === 'all') setFilters({...filters, autorizado: ''}); loadEmployees(); }}
                  className="w-full bg-[#262626] text-white hover:bg-[#363636]"
                  data-testid="filter-search-button"
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
                  <TableHead className="text-gray-400 w-10">
                    <Checkbox
                      checked={selectedItems.length === employees.length && employees.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-gray-400">Nome</TableHead>
                  <TableHead className="text-gray-400">Setor</TableHead>
                  <TableHead className="text-gray-400">Data</TableHead>
                  <TableHead className="text-gray-400">Entrada</TableHead>
                  <TableHead className="text-gray-400">Saída</TableHead>
                  <TableHead className="text-gray-400">Autorizado</TableHead>
                  <TableHead className="text-gray-400">Porteiro</TableHead>
                  <TableHead className="text-gray-400 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                      Nenhum funcionário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((employee) => (
                    <TableRow key={employee.id} className="border-[#262626] hover:bg-[#1F1F1F]">
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(employee.id)}
                          onCheckedChange={() => toggleSelectItem(employee.id)}
                        />
                      </TableCell>
                      <TableCell className="text-white font-medium">{employee.nome}</TableCell>
                      <TableCell className="text-gray-400">{employee.setor}</TableCell>
                      <TableCell className="text-gray-400">{employee.data}</TableCell>
                      <TableCell className="text-gray-400 font-mono">{employee.hora_entrada}</TableCell>
                      <TableCell>
                        {employee.hora_saida ? (
                          <span className="text-gray-400 font-mono">{employee.hora_saida}</span>
                        ) : (
                          <span className="badge-info">Presente</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.autorizado ? (
                          <span className="badge-success flex items-center gap-1 w-fit">
                            <CheckCircle size={14} /> Sim
                          </span>
                        ) : (
                          <span className="badge-error flex items-center gap-1 w-fit">
                            <XCircle size={14} /> Não
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-400">{employee.porteiro}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedEmployee(employee); setViewDialogOpen(true); }}
                            className="text-gray-400 hover:text-white"
                          >
                            <Eye size={16} />
                          </Button>
                          {!employee.hora_saida && (isAdmin || isPortaria) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRegisterExit(employee)}
                              className="text-yellow-400 hover:text-yellow-300"
                            >
                              <SignOut size={16} />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePrint(employee)}
                            className="text-gray-400 hover:text-white"
                          >
                            <Printer size={16} />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSelectedEmployee(employee); setDeleteDialogOpen(true); }}
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
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#141414] border-[#262626] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">
              {selectedEmployee ? 'Editar Funcionário' : 'Registrar Entrada'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-gray-400">Nome *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value.toUpperCase() })}
                className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                required
                data-testid="employee-nome-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Setor *</Label>
                <Input
                  value={formData.setor}
                  onChange={(e) => setFormData({ ...formData, setor: e.target.value.toUpperCase() })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  required
                  data-testid="employee-setor-input"
                />
              </div>
              <div>
                <Label className="text-gray-400">Responsável</Label>
                <Input
                  value={formData.responsavel}
                  onChange={(e) => setFormData({ ...formData, responsavel: e.target.value.toUpperCase() })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  data-testid="employee-responsavel-input"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-400">Placa</Label>
              <Input
                value={formData.placa}
                onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                className="bg-[#0A0A0A] border-[#262626] text-white mt-1 font-mono"
                placeholder="ABC1234"
                data-testid="employee-placa-input"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="autorizado"
                checked={formData.autorizado}
                onCheckedChange={(checked) => setFormData({ ...formData, autorizado: checked })}
                data-testid="employee-autorizado-checkbox"
              />
              <Label htmlFor="autorizado" className="text-gray-400 cursor-pointer">
                Autorizado
              </Label>
            </div>
            <div>
              <Label className="text-gray-400">Observação</Label>
              <Input
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                data-testid="employee-observacao-input"
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
              <Button type="submit" className="bg-white text-black hover:bg-gray-200" data-testid="employee-submit-button">
                {selectedEmployee ? 'Salvar' : 'Registrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="bg-[#141414] border-[#262626] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">Detalhes do Funcionário</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Nome</p>
                  <p className="text-white font-medium">{selectedEmployee.nome}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Setor</p>
                  <p className="text-white">{selectedEmployee.setor}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Data</p>
                  <p className="text-white">{selectedEmployee.data}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Responsável</p>
                  <p className="text-white">{selectedEmployee.responsavel || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Entrada</p>
                  <p className="text-white font-mono">{selectedEmployee.hora_entrada}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Saída</p>
                  <p className="text-white font-mono">{selectedEmployee.hora_saida || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Placa</p>
                  <p className="text-white font-mono">{selectedEmployee.placa || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Autorizado</p>
                  {selectedEmployee.autorizado ? (
                    <span className="badge-success">Sim</span>
                  ) : (
                    <span className="badge-error">Não</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Porteiro</p>
                  <p className="text-white">{selectedEmployee.porteiro}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status Saída</p>
                  {selectedEmployee.autorizado ? (
                    <span className="badge-success flex items-center gap-1 w-fit">
                      <CheckCircle size={12} /> Saída Autorizada
                    </span>
                  ) : (
                    <span className="badge-error flex items-center gap-1 w-fit">
                      <XCircle size={12} /> Não Autorizada
                    </span>
                  )}
                </div>
              </div>
              {selectedEmployee.observacao && (
                <div>
                  <p className="text-xs text-gray-500">Observação</p>
                  <p className="text-white">{selectedEmployee.observacao}</p>
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
              Tem certeza que deseja excluir o registro de "{selectedEmployee?.nome}"? Esta ação não pode ser desfeita.
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

export default Employees;
