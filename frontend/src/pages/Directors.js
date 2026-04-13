import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { directorsAPI, agendamentosAPI } from '../services/api';
import { printDirectors } from '../utils/printUtils';
import { 
  Plus, 
  MagnifyingGlass, 
  Pencil, 
  Trash, 
  Eye,
  SignOut,
  Printer,
  Coffee,
  ArrowUDownLeft,
  CalendarCheck,
  SignIn
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const Directors = () => {
  const { isAdmin, isPortaria } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [directors, setDirectors] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('presentes');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDirector, setSelectedDirector] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [filters, setFilters] = useState({
    nome: '',
    placa: '',
    data_inicio: '',
    data_fim: ''
  });
  const [formData, setFormData] = useState({
    nome: '',
    placa: '',
    carro: '',
    observacao: ''
  });

  useEffect(() => {
    loadDirectors();
    loadAgendamentos();
    if (searchParams.get('action') === 'new') {
      setDialogOpen(true);
      setSearchParams({});
    }
  }, []);

  const loadDirectors = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.nome) params.nome = filters.nome;
      if (filters.placa) params.placa = filters.placa;
      if (filters.data_inicio) params.data_inicio = filters.data_inicio;
      if (filters.data_fim) params.data_fim = filters.data_fim;
      
      const response = await directorsAPI.list(params);
      setDirectors(response.data.items);
    } catch (error) {
      toast.error('Erro ao carregar diretoria');
    } finally {
      setLoading(false);
    }
  };

  const loadAgendamentos = async () => {
    try {
      const response = await agendamentosAPI.list({ tipo: 'diretoria', status: 'pendente' });
      setAgendamentos(response.data.items);
    } catch (error) {
      console.error('Error loading agendamentos:', error);
    }
  };

  const handleDarEntrada = async (agendamento) => {
    try {
      await agendamentosAPI.darEntrada(agendamento.id);
      toast.success('Entrada registrada com sucesso!');
      loadDirectors();
      loadAgendamentos();
      setActiveTab('presentes');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao dar entrada');
    }
  };

  const toggleSelectItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === directors.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(directors.map(d => d.id));
    }
  };

  const handlePrintSelected = () => {
    const itemsToPrint = directors.filter(d => selectedItems.includes(d.id));
    if (itemsToPrint.length === 0) {
      toast.error('Selecione pelo menos um registro para imprimir');
      return;
    }
    printMultiple(itemsToPrint);
  };

  const printMultiple = (items) => {
    const printContent = `
      <html>
      <head>
        <title>Registro de Diretoria - Cipolatti</title>
        <style>
          @page { margin: 20mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 0; margin: 0; color: #333; }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1a1a1a; padding-bottom: 15px; margin-bottom: 20px; }
          .logo { font-size: 28px; font-weight: bold; color: #1a1a1a; }
          .logo span { color: #e63946; }
          .title { font-size: 18px; color: #666; }
          .record { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; page-break-inside: avoid; }
          .record-header { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px; }
          .record-name { font-size: 16px; font-weight: bold; color: #1a1a1a; }
          .record-date { font-size: 12px; color: #666; }
          .fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .field-label { font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 2px; }
          .field-value { font-size: 13px; color: #333; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
          .badge-present { background: #dcfce7; color: #166534; }
          .badge-lunch { background: #fef3c7; color: #92400e; }
          .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 11px; color: #888; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">CIPO<span>LATTI</span></div>
          <div class="title">Registro de Diretoria</div>
        </div>
        \${items.map(director => \`
          <div class="record">
            <div class="record-header">
              <div class="record-name">\${director.nome}</div>
              <div class="record-date">\${director.data}</div>
            </div>
            <div class="fields">
              <div class="field">
                <div class="field-label">Entrada</div>
                <div class="field-value">\${director.hora_entrada}</div>
              </div>
              <div class="field">
                <div class="field-label">Saída</div>
                <div class="field-value">\${director.hora_saida || '-'}</div>
              </div>
              <div class="field">
                <div class="field-label">Status</div>
                <div class="field-value">\${director.status === 'presente' ? '<span class="badge badge-present">Presente</span>' : director.status === 'almoco' ? '<span class="badge badge-lunch">Almoço</span>' : director.status}</div>
              </div>
              <div class="field">
                <div class="field-label">Placa</div>
                <div class="field-value">\${director.placa || '-'}</div>
              </div>
              <div class="field">
                <div class="field-label">Carro</div>
                <div class="field-value">\${director.carro || '-'}</div>
              </div>
              <div class="field">
                <div class="field-label">Porteiro</div>
                <div class="field-value">\${director.porteiro}</div>
              </div>
            </div>
          </div>
        \`).join('')}
        <div class="footer">
          Documento gerado em \${new Date().toLocaleString('pt-BR')} | Sistema de Controle de Acesso - Cipolatti
        </div>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handlePrint = (director) => {
    printMultiple([director]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedDirector) {
        await directorsAPI.update(selectedDirector.id, formData);
        toast.success('Registro atualizado');
      } else {
        await directorsAPI.create(formData);
        toast.success('Entrada registrada');
      }
      setDialogOpen(false);
      resetForm();
      loadDirectors();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao salvar');
    }
  };

  const handleSaidaAlmoco = async (director) => {
    try {
      const now = new Date();
      await directorsAPI.update(director.id, {
        hora_saida_almoco: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      });
      toast.success('Saída para almoço registrada');
      loadDirectors();
    } catch (error) {
      toast.error('Erro ao registrar saída para almoço');
    }
  };

  const handleRetornoAlmoco = async (director) => {
    try {
      const now = new Date();
      await directorsAPI.update(director.id, {
        hora_retorno_almoco: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      });
      toast.success('Retorno do almoço registrado');
      loadDirectors();
    } catch (error) {
      toast.error('Erro ao registrar retorno do almoço');
    }
  };

  const handleSaidaEmpresa = async (director) => {
    try {
      const now = new Date();
      await directorsAPI.update(director.id, {
        hora_saida: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      });
      toast.success('Saída da empresa registrada');
      loadDirectors();
    } catch (error) {
      toast.error('Erro ao registrar saída');
    }
  };

  const handleDelete = async () => {
    try {
      await directorsAPI.delete(selectedDirector.id);
      toast.success('Registro excluído');
      setDeleteDialogOpen(false);
      setSelectedDirector(null);
      loadDirectors();
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const resetForm = () => {
    setFormData({ nome: '', placa: '', carro: '', observacao: '' });
    setSelectedDirector(null);
  };

  const openEditDialog = (director) => {
    setSelectedDirector(director);
    setFormData({
      nome: director.nome,
      placa: director.placa || '',
      carro: director.carro || '',
      observacao: director.observacao || ''
    });
    setDialogOpen(true);
  };

  const getStatusBadge = (director) => {
    if (director.hora_saida) {
      return <span className="badge-success">Saiu</span>;
    }
    if (director.hora_saida_almoco && !director.hora_retorno_almoco) {
      return <span className="badge-warning">Almoço</span>;
    }
    return <span className="badge-info">Presente</span>;
  };

  const canRegisterAction = (director, action) => {
    if (director.hora_saida) return false; // Já saiu da empresa
    
    switch (action) {
      case 'saida_almoco':
        return !director.hora_saida_almoco;
      case 'retorno_almoco':
        return director.hora_saida_almoco && !director.hora_retorno_almoco;
      case 'saida':
        return !director.hora_saida_almoco || director.hora_retorno_almoco;
      default:
        return false;
    }
  };

  return (
    <div className="space-y-6" data-testid="directors-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white font-['Outfit']">Diretoria</h1>
          <p className="text-gray-500 mt-1">Registro de entrada e saída da diretoria</p>
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
              data-testid="add-director-button"
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
          <TabsTrigger value="presentes" className="data-[state=active]:bg-[#262626]">
            Presentes ({directors.filter(d => !d.hora_saida).length})
          </TabsTrigger>
          <TabsTrigger value="agendados" className="data-[state=active]:bg-[#262626]">
            <CalendarCheck size={16} className="mr-1" />
            Agendados ({agendamentos.length})
          </TabsTrigger>
          <TabsTrigger value="historico" className="data-[state=active]:bg-[#262626]">
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Agendados Tab */}
        <TabsContent value="agendados" className="mt-4">
          <div className="card-dark overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[#262626] hover:bg-transparent">
                  <TableHead className="text-gray-400">Data Prevista</TableHead>
                  <TableHead className="text-gray-400">Hora</TableHead>
                  <TableHead className="text-gray-400">Nome</TableHead>
                  <TableHead className="text-gray-400">Placa</TableHead>
                  <TableHead className="text-gray-400">Criado Por</TableHead>
                  <TableHead className="text-gray-400 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agendamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      Nenhum registro agendado
                    </TableCell>
                  </TableRow>
                ) : (
                  agendamentos.map((ag) => (
                    <TableRow key={ag.id} className="border-[#262626] hover:bg-[#1F1F1F]">
                      <TableCell className="text-white font-medium">{ag.data_prevista}</TableCell>
                      <TableCell className="text-gray-400 font-mono">{ag.hora_prevista || '-'}</TableCell>
                      <TableCell className="text-white">{ag.nome || '-'}</TableCell>
                      <TableCell className="text-white font-mono">{ag.placa || '-'}</TableCell>
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

        {/* Presentes Tab */}
        <TabsContent value="presentes" className="mt-4">

      {/* Filters */}
      <div className="card-dark p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <Label className="text-gray-400 text-xs">Nome</Label>
            <Input
              placeholder="Buscar por nome"
              value={filters.nome}
              onChange={(e) => setFilters({ ...filters, nome: e.target.value })}
              className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
              data-testid="filter-nome"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">Placa</Label>
            <Input
              placeholder="Buscar por placa"
              value={filters.placa}
              onChange={(e) => setFilters({ ...filters, placa: e.target.value })}
              className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
              data-testid="filter-placa"
            />
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
              onClick={loadDirectors}
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
              <TableHead className="text-gray-400">Nome</TableHead>
              <TableHead className="text-gray-400">Data</TableHead>
              <TableHead className="text-gray-400">Entrada</TableHead>
              <TableHead className="text-gray-400">Saída Almoço</TableHead>
              <TableHead className="text-gray-400">Retorno Almoço</TableHead>
              <TableHead className="text-gray-400">Saída</TableHead>
              <TableHead className="text-gray-400">Status</TableHead>
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
            ) : directors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                  Nenhum registro encontrado
                </TableCell>
              </TableRow>
            ) : (
              directors.map((director) => (
                <TableRow key={director.id} className="border-[#262626] hover:bg-[#1F1F1F]">
                  <TableCell className="text-white font-medium">{director.nome}</TableCell>
                  <TableCell className="text-gray-400">{director.data}</TableCell>
                  <TableCell className="text-gray-400 font-mono">{director.hora_entrada}</TableCell>
                  <TableCell className="text-gray-400 font-mono">{director.hora_saida_almoco || '-'}</TableCell>
                  <TableCell className="text-gray-400 font-mono">{director.hora_retorno_almoco || '-'}</TableCell>
                  <TableCell className="text-gray-400 font-mono">{director.hora_saida || '-'}</TableCell>
                  <TableCell>{getStatusBadge(director)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSelectedDirector(director); setViewDialogOpen(true); }}
                        className="text-gray-400 hover:text-white"
                        data-testid={`view-director-${director.id}`}
                      >
                        <Eye size={16} />
                      </Button>
                      
                      {(isAdmin || isPortaria) && !director.hora_saida && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-yellow-400 hover:text-yellow-300"
                              data-testid={`actions-director-${director.id}`}
                            >
                              <SignOut size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-[#141414] border-[#262626]">
                            {canRegisterAction(director, 'saida_almoco') && (
                              <DropdownMenuItem 
                                onClick={() => handleSaidaAlmoco(director)}
                                className="text-white hover:bg-[#262626] cursor-pointer"
                              >
                                <Coffee size={16} className="mr-2" />
                                Saída Almoço
                              </DropdownMenuItem>
                            )}
                            {canRegisterAction(director, 'retorno_almoco') && (
                              <DropdownMenuItem 
                                onClick={() => handleRetornoAlmoco(director)}
                                className="text-white hover:bg-[#262626] cursor-pointer"
                              >
                                <ArrowUDownLeft size={16} className="mr-2" />
                                Retorno Almoço
                              </DropdownMenuItem>
                            )}
                            {canRegisterAction(director, 'saida') && (
                              <DropdownMenuItem 
                                onClick={() => handleSaidaEmpresa(director)}
                                className="text-white hover:bg-[#262626] cursor-pointer"
                              >
                                <SignOut size={16} className="mr-2" />
                                Saída da Empresa
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      
                      {(isAdmin || isPortaria) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(director)}
                          className="text-gray-400 hover:text-white"
                          data-testid={`edit-director-${director.id}`}
                        >
                          <Pencil size={16} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePrint(director)}
                        className="text-gray-400 hover:text-white"
                        data-testid={`print-director-${director.id}`}
                      >
                        <Printer size={16} />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedDirector(director); setDeleteDialogOpen(true); }}
                          className="text-red-400 hover:text-red-300"
                          data-testid={`delete-director-${director.id}`}
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
          <div className="card-dark overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[#262626] hover:bg-transparent">
                  <TableHead className="text-gray-400 w-10">
                    <Checkbox
                      checked={selectedItems.length === directors.length && directors.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-gray-400">Nome</TableHead>
                  <TableHead className="text-gray-400">Data</TableHead>
                  <TableHead className="text-gray-400">Entrada</TableHead>
                  <TableHead className="text-gray-400">Almoço</TableHead>
                  <TableHead className="text-gray-400">Saída</TableHead>
                  <TableHead className="text-gray-400">Placa</TableHead>
                  <TableHead className="text-gray-400 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                      Nenhum registro encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  directors.map((director) => (
                    <TableRow key={director.id} className="border-[#262626] hover:bg-[#1F1F1F]">
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(director.id)}
                          onCheckedChange={() => toggleSelectItem(director.id)}
                        />
                      </TableCell>
                      <TableCell className="text-white font-medium">{director.nome}</TableCell>
                      <TableCell className="text-gray-400">{director.data}</TableCell>
                      <TableCell className="text-gray-400 font-mono">{director.hora_entrada}</TableCell>
                      <TableCell className="text-gray-400 font-mono text-xs">
                        {director.hora_saida_almoco && <span>{director.hora_saida_almoco}</span>}
                        {director.hora_retorno_almoco && <span className="ml-1">/ {director.hora_retorno_almoco}</span>}
                        {!director.hora_saida_almoco && '-'}
                      </TableCell>
                      <TableCell className="text-gray-400 font-mono">{director.hora_saida || '-'}</TableCell>
                      <TableCell className="text-white font-mono">{director.placa || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedDirector(director); setViewDialogOpen(true); }}
                            className="text-gray-400 hover:text-white"
                          >
                            <Eye size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePrint(director)}
                            className="text-gray-400 hover:text-white"
                          >
                            <Printer size={16} />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSelectedDirector(director); setDeleteDialogOpen(true); }}
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
              {selectedDirector ? 'Editar Registro' : 'Registrar Entrada'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-gray-400">Nome *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                required
                data-testid="director-nome-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Placa</Label>
                <Input
                  value={formData.placa}
                  onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1 font-mono"
                  placeholder="ABC-1234"
                  data-testid="director-placa-input"
                />
              </div>
              <div>
                <Label className="text-gray-400">Carro</Label>
                <Input
                  value={formData.carro}
                  onChange={(e) => setFormData({ ...formData, carro: e.target.value })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  placeholder="Modelo"
                  data-testid="director-carro-input"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-400">Observação</Label>
              <Input
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                data-testid="director-observacao-input"
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
              <Button type="submit" className="bg-white text-black hover:bg-gray-200" data-testid="director-submit-button">
                {selectedDirector ? 'Salvar' : 'Registrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="bg-[#141414] border-[#262626] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">Detalhes do Registro</DialogTitle>
          </DialogHeader>
          {selectedDirector && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Nome</p>
                  <p className="text-white font-medium">{selectedDirector.nome}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Data</p>
                  <p className="text-white">{selectedDirector.data}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Entrada</p>
                  <p className="text-white font-mono">{selectedDirector.hora_entrada}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  {getStatusBadge(selectedDirector)}
                </div>
              </div>
              
              <div className="border-t border-[#262626] pt-4">
                <p className="text-sm font-medium text-white mb-3">Movimentações</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Saída Almoço</p>
                    <p className="text-white font-mono">{selectedDirector.hora_saida_almoco || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Retorno Almoço</p>
                    <p className="text-white font-mono">{selectedDirector.hora_retorno_almoco || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Saída Empresa</p>
                    <p className="text-white font-mono">{selectedDirector.hora_saida || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#262626] pt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Placa</p>
                  <p className="text-white font-mono">{selectedDirector.placa || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Carro</p>
                  <p className="text-white">{selectedDirector.carro || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Porteiro</p>
                  <p className="text-white">{selectedDirector.porteiro}</p>
                </div>
              </div>
              
              {selectedDirector.observacao && (
                <div>
                  <p className="text-xs text-gray-500">Observação</p>
                  <p className="text-white">{selectedDirector.observacao}</p>
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
              Tem certeza que deseja excluir o registro de "{selectedDirector?.nome}"? Esta ação não pode ser desfeita.
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

export default Directors;
