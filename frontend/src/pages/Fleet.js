import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fleetAPI, agendamentosAPI } from '../services/api';
import { formatApiError } from '../utils/errorUtils';
import { 
  Plus, 
  MagnifyingGlass, 
  Eye,
  ArrowUDownLeft,
  Printer,
  Trash,
  Camera,
  Image as ImageIcon,
  X,
  Download,
  CaretLeft,
  CaretRight,
  CalendarCheck,
  SignIn
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const PHOTO_CATEGORIES = [
  { value: 'placa', label: 'Placa' },
  { value: 'motorista', label: 'Motorista' },
  { value: 'interior', label: 'Interior' },
  { value: 'frente', label: 'Frente' },
  { value: 'traseira', label: 'Traseira' },
  { value: 'lateral', label: 'Lateral' },
  { value: 'avaria', label: 'Avaria' },
];

const Fleet = () => {
  const { isAdmin, isPortaria } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [fleet, setFleet] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('em_uso');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFleet, setSelectedFleet] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [photoMoment, setPhotoMoment] = useState('saida');
  const [photoCategory, setPhotoCategory] = useState('placa');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [filters, setFilters] = useState({
    placa: '',
    motorista: '',
    destino: '',
    status: searchParams.get('status') || '',
    data_inicio: '',
    data_fim: ''
  });

  const [formData, setFormData] = useState({
    carro: '',
    placa: '',
    motorista: '',
    destino: '',
    km_saida: '',
    observacao: ''
  });

  const [returnData, setReturnData] = useState({
    km_retorno: '',
    observacao: ''
  });

  useEffect(() => {
    loadFleet();
    loadAgendamentos();
    if (searchParams.get('action') === 'new') {
      setDialogOpen(true);
      setSearchParams({});
    }
  }, []);

  const loadFleet = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.placa) params.placa = filters.placa;
      if (filters.motorista) params.motorista = filters.motorista;
      if (filters.destino) params.destino = filters.destino;
      if (filters.status) params.status = filters.status;
      if (filters.data_inicio) params.data_inicio = filters.data_inicio;
      if (filters.data_fim) params.data_fim = filters.data_fim;
      
      const response = await fleetAPI.list(params);
      setFleet(response.data.items);
    } catch (error) {
      toast.error('Erro ao carregar frota');
    } finally {
      setLoading(false);
    }
  };

  const loadAgendamentos = async () => {
    try {
      const response = await agendamentosAPI.list({ tipo: 'frota', status: 'pendente' });
      setAgendamentos(response.data.items);
    } catch (error) {
      console.error('Error loading agendamentos:', error);
    }
  };

  const handleDarEntrada = async (agendamento) => {
    try {
      await agendamentosAPI.darEntrada(agendamento.id);
      toast.success('Saída registrada com sucesso!');
      loadFleet();
      loadAgendamentos();
      setActiveTab('em_uso');
    } catch (error) {
      toast.error(formatApiError(error.response?.data?.detail, 'Erro ao registrar saída'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        km_saida: parseFloat(formData.km_saida)
      };
      await fleetAPI.create(data);
      toast.success('Saída de veículo registrada');
      setDialogOpen(false);
      resetForm();
      loadFleet();
    } catch (error) {
      toast.error(formatApiError(error.response?.data?.detail, 'Erro ao registrar saída'));
    }
  };

  const handleReturn = async (e) => {
    e.preventDefault();
    try {
      await fleetAPI.return(selectedFleet.id, {
        km_retorno: parseFloat(returnData.km_retorno),
        observacao: returnData.observacao
      });
      toast.success('Retorno registrado');
      setReturnDialogOpen(false);
      setReturnData({ km_retorno: '', observacao: '' });
      setSelectedFleet(null);
      loadFleet();
    } catch (error) {
      toast.error(formatApiError(error.response?.data?.detail, 'Erro ao registrar retorno'));
    }
  };

  const handleDelete = async () => {
    try {
      await fleetAPI.delete(selectedFleet.id);
      toast.success('Registro excluído');
      setDeleteDialogOpen(false);
      setSelectedFleet(null);
      loadFleet();
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const handlePhotoUpload = async (file) => {
    if (!file || !selectedFleet) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      await fleetAPI.uploadPhoto(selectedFleet.id, formData, {
        category: photoCategory,
        moment: photoMoment
      });
      
      toast.success('Foto enviada');
      
      // Reload fleet data
      const response = await fleetAPI.get(selectedFleet.id);
      setSelectedFleet(response.data);
    } catch (error) {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePhotoUpload(file);
    }
  };

  const resetForm = () => {
    setFormData({
      carro: '',
      placa: '',
      motorista: '',
      destino: '',
      km_saida: '',
      observacao: ''
    });
  };

  const openReturnDialog = (item) => {
    setSelectedFleet(item);
    setReturnData({ km_retorno: '', observacao: '' });
    setReturnDialogOpen(true);
  };

  const openPhotoDialog = (item, moment) => {
    setSelectedFleet(item);
    setPhotoMoment(moment);
    setPhotoCategory('placa');
    setPhotoDialogOpen(true);
  };

  const openGallery = (item) => {
    setSelectedFleet(item);
    setCurrentPhotoIndex(0);
    setGalleryOpen(true);
  };

  const getAllPhotos = () => {
    if (!selectedFleet) return [];
    return [
      ...(selectedFleet.fotos_saida || []).map(p => ({ ...p, moment: 'saida' })),
      ...(selectedFleet.fotos_retorno || []).map(p => ({ ...p, moment: 'retorno' }))
    ];
  };

  const handlePrint = (item) => {
    const printContent = `
      <html>
      <head>
        <title>Registro de Frota</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 18px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .section { margin: 15px 0; }
          .section-title { font-weight: bold; font-size: 14px; margin-bottom: 5px; }
          .field { margin: 5px 0; }
          .label { font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>REGISTRO DE FROTA</h1>
        <div class="section">
          <div class="section-title">VEÍCULO</div>
          <div class="field"><span class="label">Carro:</span> ${item.carro}</div>
          <div class="field"><span class="label">Placa:</span> ${item.placa}</div>
          <div class="field"><span class="label">Motorista:</span> ${item.motorista}</div>
          <div class="field"><span class="label">Destino:</span> ${item.destino}</div>
        </div>
        <div class="section">
          <div class="section-title">SAÍDA</div>
          <div class="field"><span class="label">Data:</span> ${item.data_saida}</div>
          <div class="field"><span class="label">Hora:</span> ${item.hora_saida}</div>
          <div class="field"><span class="label">KM:</span> ${item.km_saida}</div>
          <div class="field"><span class="label">Porteiro:</span> ${item.porteiro_saida}</div>
        </div>
        ${item.status === 'retornado' ? `
        <div class="section">
          <div class="section-title">RETORNO</div>
          <div class="field"><span class="label">Data:</span> ${item.data_retorno}</div>
          <div class="field"><span class="label">Hora:</span> ${item.hora_retorno}</div>
          <div class="field"><span class="label">KM:</span> ${item.km_retorno}</div>
          <div class="field"><span class="label">KM Rodado:</span> ${item.km_rodado}</div>
          <div class="field"><span class="label">Porteiro:</span> ${item.porteiro_retorno}</div>
        </div>
        ` : ''}
        ${(item.fotos_saida?.length > 0 || item.fotos_retorno?.length > 0) ? '<p><em>* Possui fotos vinculadas</em></p>' : ''}
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

  const getPhotoUrl = (photo) => {
    return `${API}/api/fleet/${selectedFleet.id}/photos/${photo.id}`;
  };

  return (
    <div className="space-y-6" data-testid="fleet-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white font-['Outfit']">Frota</h1>
          <p className="text-gray-500 mt-1">Controle de veículos da empresa</p>
        </div>
        {(isAdmin || isPortaria) && (
          <Button 
            onClick={() => { resetForm(); setDialogOpen(true); }}
            className="bg-white text-black hover:bg-gray-200"
            data-testid="add-fleet-button"
          >
            <Plus size={18} className="mr-2" />
            Registrar Saída
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#0A0A0A] border border-[#262626]">
          <TabsTrigger value="em_uso" className="data-[state=active]:bg-[#262626]">
            Em Uso ({fleet.filter(f => f.status === 'em_uso').length})
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
                  <TableHead className="text-gray-400">Carro</TableHead>
                  <TableHead className="text-gray-400">Placa</TableHead>
                  <TableHead className="text-gray-400">Motorista</TableHead>
                  <TableHead className="text-gray-400">Destino</TableHead>
                  <TableHead className="text-gray-400 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agendamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      Nenhum veículo agendado
                    </TableCell>
                  </TableRow>
                ) : (
                  agendamentos.map((ag) => (
                    <TableRow key={ag.id} className="border-[#262626] hover:bg-[#1F1F1F]">
                      <TableCell className="text-white font-medium">{ag.data_prevista}</TableCell>
                      <TableCell className="text-gray-400 font-mono">{ag.hora_prevista || '-'}</TableCell>
                      <TableCell className="text-gray-400">{ag.carro || '-'}</TableCell>
                      <TableCell className="text-white font-mono">{ag.placa || '-'}</TableCell>
                      <TableCell className="text-white">{ag.motorista || ag.nome || '-'}</TableCell>
                      <TableCell className="text-gray-400">{ag.destino || '-'}</TableCell>
                      <TableCell className="text-right">
                        {(isAdmin || isPortaria) && (
                          <Button
                            onClick={() => handleDarEntrada(ag)}
                            className="bg-green-600 text-white hover:bg-green-700"
                            size="sm"
                            data-testid={`dar-entrada-${ag.id}`}
                          >
                            <SignIn size={16} className="mr-1" />
                            Registrar Saída
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

        {/* Em Uso Tab */}
        <TabsContent value="em_uso" className="mt-4 space-y-4">
          {/* Table Em Uso */}
          <div className="card-dark overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[#262626] hover:bg-transparent">
                  <TableHead className="text-gray-400">Placa</TableHead>
                  <TableHead className="text-gray-400">Carro</TableHead>
                  <TableHead className="text-gray-400">Motorista</TableHead>
                  <TableHead className="text-gray-400">Destino</TableHead>
                  <TableHead className="text-gray-400">Saída</TableHead>
                  <TableHead className="text-gray-400 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : fleet.filter(f => f.status === 'em_uso').length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      Nenhum veículo em uso
                    </TableCell>
                  </TableRow>
                ) : (
                  fleet.filter(f => f.status === 'em_uso').map((item) => (
                    <TableRow key={item.id} className="border-[#262626] hover:bg-[#1F1F1F]">
                      <TableCell className="text-white font-mono font-medium">{item.placa}</TableCell>
                      <TableCell className="text-gray-400">{item.carro}</TableCell>
                      <TableCell className="text-white">{item.motorista}</TableCell>
                      <TableCell className="text-gray-400">{item.destino}</TableCell>
                      <TableCell className="text-gray-400">
                        <span className="font-mono">{item.hora_saida}</span>
                        <span className="text-gray-600 ml-1 text-xs">{item.data_saida}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedFleet(item); setViewDialogOpen(true); }}
                            className="text-gray-400 hover:text-white"
                          >
                            <Eye size={16} />
                          </Button>
                          {(isAdmin || isPortaria) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPhotoDialog(item, 'saida')}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              <Camera size={16} />
                            </Button>
                          )}
                          {(item.fotos_saida?.length > 0 || item.fotos_retorno?.length > 0) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openGallery(item)}
                              className="text-purple-400 hover:text-purple-300"
                            >
                              <ImageIcon size={16} />
                            </Button>
                          )}
                          {(isAdmin || isPortaria) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openReturnDialog(item)}
                              className="text-green-400 hover:text-green-300"
                            >
                              <ArrowUDownLeft size={16} />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePrint(item)}
                            className="text-gray-400 hover:text-white"
                          >
                            <Printer size={16} />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSelectedFleet(item); setDeleteDialogOpen(true); }}
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

        {/* Histórico Tab */}
        <TabsContent value="historico" className="mt-4 space-y-4">
      {/* Filters */}
      <div className="card-dark p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <Label className="text-gray-400 text-xs">Placa</Label>
            <Input
              placeholder="Buscar por placa"
              value={filters.placa}
              onChange={(e) => setFilters({ ...filters, placa: e.target.value })}
              className="bg-[#0A0A0A] border-[#262626] text-white mt-1 font-mono"
              data-testid="filter-placa"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">Motorista</Label>
            <Input
              placeholder="Buscar por motorista"
              value={filters.motorista}
              onChange={(e) => setFilters({ ...filters, motorista: e.target.value })}
              className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
              data-testid="filter-motorista"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">Status</Label>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger className="bg-[#0A0A0A] border-[#262626] text-white mt-1">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-[#141414] border-[#262626]">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="em_uso">Em Uso</SelectItem>
                <SelectItem value="retornado">Retornado</SelectItem>
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
              onClick={() => { if (filters.status === 'all') setFilters({...filters, status: ''}); loadFleet(); }}
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
              <TableHead className="text-gray-400">Placa</TableHead>
              <TableHead className="text-gray-400">Carro</TableHead>
              <TableHead className="text-gray-400">Motorista</TableHead>
              <TableHead className="text-gray-400">Destino</TableHead>
              <TableHead className="text-gray-400">Saída</TableHead>
              <TableHead className="text-gray-400">Retorno</TableHead>
              <TableHead className="text-gray-400">KM</TableHead>
              <TableHead className="text-gray-400">Status</TableHead>
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
            ) : fleet.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                  Nenhum registro encontrado
                </TableCell>
              </TableRow>
            ) : (
              fleet.map((item) => (
                <TableRow key={item.id} className="border-[#262626] hover:bg-[#1F1F1F]">
                  <TableCell className="text-white font-mono font-medium">{item.placa}</TableCell>
                  <TableCell className="text-gray-400">{item.carro}</TableCell>
                  <TableCell className="text-white">{item.motorista}</TableCell>
                  <TableCell className="text-gray-400">{item.destino}</TableCell>
                  <TableCell className="text-gray-400">
                    <span className="font-mono">{item.hora_saida}</span>
                    <span className="text-gray-600 ml-1 text-xs">{item.data_saida}</span>
                  </TableCell>
                  <TableCell className="text-gray-400">
                    {item.hora_retorno ? (
                      <>
                        <span className="font-mono">{item.hora_retorno}</span>
                        <span className="text-gray-600 ml-1 text-xs">{item.data_retorno}</span>
                      </>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-white font-mono">
                    {item.km_rodado ? `${item.km_rodado} km` : '-'}
                  </TableCell>
                  <TableCell>
                    {item.status === 'em_uso' ? (
                      <span className="badge-warning">Em Uso</span>
                    ) : (
                      <span className="badge-success">Retornado</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSelectedFleet(item); setViewDialogOpen(true); }}
                        className="text-gray-400 hover:text-white"
                        data-testid={`view-fleet-${item.id}`}
                      >
                        <Eye size={16} />
                      </Button>
                      {(isAdmin || isPortaria) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openPhotoDialog(item, item.status === 'em_uso' ? 'saida' : 'retorno')}
                          className="text-blue-400 hover:text-blue-300"
                          data-testid={`photo-fleet-${item.id}`}
                        >
                          <Camera size={16} />
                        </Button>
                      )}
                      {(item.fotos_saida?.length > 0 || item.fotos_retorno?.length > 0) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openGallery(item)}
                          className="text-purple-400 hover:text-purple-300"
                          data-testid={`gallery-fleet-${item.id}`}
                        >
                          <ImageIcon size={16} />
                        </Button>
                      )}
                      {item.status === 'em_uso' && (isAdmin || isPortaria) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openReturnDialog(item)}
                          className="text-green-400 hover:text-green-300"
                          data-testid={`return-fleet-${item.id}`}
                        >
                          <ArrowUDownLeft size={16} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePrint(item)}
                        className="text-gray-400 hover:text-white"
                        data-testid={`print-fleet-${item.id}`}
                      >
                        <Printer size={16} />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedFleet(item); setDeleteDialogOpen(true); }}
                          className="text-red-400 hover:text-red-300"
                          data-testid={`delete-fleet-${item.id}`}
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

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#141414] border-[#262626] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">Registrar Saída de Veículo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Carro *</Label>
                <Input
                  value={formData.carro}
                  onChange={(e) => setFormData({ ...formData, carro: e.target.value })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  placeholder="Ex: Fiat Strada"
                  required
                  data-testid="fleet-carro-input"
                />
              </div>
              <div>
                <Label className="text-gray-400">Placa *</Label>
                <Input
                  value={formData.placa}
                  onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1 font-mono"
                  placeholder="ABC-1234"
                  required
                  data-testid="fleet-placa-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Motorista *</Label>
                <Input
                  value={formData.motorista}
                  onChange={(e) => setFormData({ ...formData, motorista: e.target.value })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  required
                  data-testid="fleet-motorista-input"
                />
              </div>
              <div>
                <Label className="text-gray-400">KM Saída *</Label>
                <Input
                  type="number"
                  value={formData.km_saida}
                  onChange={(e) => setFormData({ ...formData, km_saida: e.target.value })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1 font-mono"
                  required
                  data-testid="fleet-km-input"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-400">Destino *</Label>
              <Input
                value={formData.destino}
                onChange={(e) => setFormData({ ...formData, destino: e.target.value })}
                className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                required
                data-testid="fleet-destino-input"
              />
            </div>
            <div>
              <Label className="text-gray-400">Observação</Label>
              <Textarea
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                rows={2}
                data-testid="fleet-observacao-input"
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
              <Button type="submit" className="bg-white text-black hover:bg-gray-200" data-testid="fleet-submit-button">
                Registrar Saída
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="bg-[#141414] border-[#262626] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">Registrar Retorno</DialogTitle>
          </DialogHeader>
          {selectedFleet && (
            <form onSubmit={handleReturn} className="space-y-4">
              <div className="p-4 bg-[#0A0A0A] rounded-md">
                <p className="text-sm text-gray-500">Veículo</p>
                <p className="text-white font-medium">{selectedFleet.carro} - <span className="font-mono">{selectedFleet.placa}</span></p>
                <p className="text-sm text-gray-500 mt-2">Motorista</p>
                <p className="text-white">{selectedFleet.motorista}</p>
                <p className="text-sm text-gray-500 mt-2">KM Saída</p>
                <p className="text-white font-mono">{selectedFleet.km_saida}</p>
              </div>
              <div>
                <Label className="text-gray-400">KM Retorno *</Label>
                <Input
                  type="number"
                  value={returnData.km_retorno}
                  onChange={(e) => setReturnData({ ...returnData, km_retorno: e.target.value })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1 font-mono"
                  required
                  min={selectedFleet.km_saida}
                  data-testid="return-km-input"
                />
              </div>
              <div>
                <Label className="text-gray-400">Observação</Label>
                <Textarea
                  value={returnData.observacao}
                  onChange={(e) => setReturnData({ ...returnData, observacao: e.target.value })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  rows={2}
                  data-testid="return-observacao-input"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setReturnDialogOpen(false)}
                  className="border-[#262626] text-white hover:bg-[#262626]"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="bg-green-500 text-white hover:bg-green-600" data-testid="return-submit-button">
                  Registrar Retorno
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="bg-[#141414] border-[#262626] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">Detalhes do Registro</DialogTitle>
          </DialogHeader>
          {selectedFleet && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="bg-[#0A0A0A] border border-[#262626]">
                <TabsTrigger value="info" className="data-[state=active]:bg-[#262626]">Informações</TabsTrigger>
                <TabsTrigger value="photos" className="data-[state=active]:bg-[#262626]">
                  Fotos ({(selectedFleet.fotos_saida?.length || 0) + (selectedFleet.fotos_retorno?.length || 0)})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Carro</p>
                    <p className="text-white font-medium">{selectedFleet.carro}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Placa</p>
                    <p className="text-white font-mono">{selectedFleet.placa}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Motorista</p>
                    <p className="text-white">{selectedFleet.motorista}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Destino</p>
                    <p className="text-white">{selectedFleet.destino}</p>
                  </div>
                </div>
                
                <div className="border-t border-[#262626] pt-4">
                  <h4 className="text-sm font-medium text-white mb-3">Saída</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Data</p>
                      <p className="text-white">{selectedFleet.data_saida}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Hora</p>
                      <p className="text-white font-mono">{selectedFleet.hora_saida}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">KM</p>
                      <p className="text-white font-mono">{selectedFleet.km_saida}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">Porteiro</p>
                    <p className="text-white">{selectedFleet.porteiro_saida}</p>
                  </div>
                </div>
                
                {selectedFleet.status === 'retornado' && (
                  <div className="border-t border-[#262626] pt-4">
                    <h4 className="text-sm font-medium text-white mb-3">Retorno</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Data</p>
                        <p className="text-white">{selectedFleet.data_retorno}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Hora</p>
                        <p className="text-white font-mono">{selectedFleet.hora_retorno}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">KM</p>
                        <p className="text-white font-mono">{selectedFleet.km_retorno}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">KM Rodado</p>
                        <p className="text-white font-mono font-medium">{selectedFleet.km_rodado} km</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">Porteiro</p>
                      <p className="text-white">{selectedFleet.porteiro_retorno}</p>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="photos" className="mt-4">
                {selectedFleet.fotos_saida?.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-white mb-3">Fotos da Saída</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {selectedFleet.fotos_saida.map((photo, idx) => (
                        <div 
                          key={photo.id} 
                          className="relative aspect-square bg-[#0A0A0A] rounded-md overflow-hidden cursor-pointer group"
                          onClick={() => { setCurrentPhotoIndex(idx); setGalleryOpen(true); }}
                        >
                          <img 
                            src={getPhotoUrl(photo)}
                            alt={photo.category}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Eye size={24} className="text-white" />
                          </div>
                          <span className="absolute bottom-1 left-1 text-xs bg-black/70 px-1.5 py-0.5 rounded text-white">
                            {photo.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {selectedFleet.fotos_retorno?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-white mb-3">Fotos do Retorno</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {selectedFleet.fotos_retorno.map((photo, idx) => (
                        <div 
                          key={photo.id} 
                          className="relative aspect-square bg-[#0A0A0A] rounded-md overflow-hidden cursor-pointer group"
                          onClick={() => { setCurrentPhotoIndex((selectedFleet.fotos_saida?.length || 0) + idx); setGalleryOpen(true); }}
                        >
                          <img 
                            src={getPhotoUrl(photo)}
                            alt={photo.category}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Eye size={24} className="text-white" />
                          </div>
                          <span className="absolute bottom-1 left-1 text-xs bg-black/70 px-1.5 py-0.5 rounded text-white">
                            {photo.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {!selectedFleet.fotos_saida?.length && !selectedFleet.fotos_retorno?.length && (
                  <p className="text-gray-500 text-center py-8">Nenhuma foto registrada</p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Photo Upload Dialog */}
      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="bg-[#141414] border-[#262626] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">Adicionar Foto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-400">Momento</Label>
              <Select value={photoMoment} onValueChange={setPhotoMoment}>
                <SelectTrigger className="bg-[#0A0A0A] border-[#262626] text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-[#262626]">
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="retorno">Retorno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400">Categoria</Label>
              <Select value={photoCategory} onValueChange={setPhotoCategory}>
                <SelectTrigger className="bg-[#0A0A0A] border-[#262626] text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-[#262626]">
                  {PHOTO_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                type="file"
                ref={cameraInputRef}
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              
              <Button
                type="button"
                variant="outline"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
                className="border-[#262626] text-white hover:bg-[#262626] h-20 flex-col"
                data-testid="photo-camera-button"
              >
                <Camera size={24} className="mb-1" />
                Câmera
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="border-[#262626] text-white hover:bg-[#262626] h-20 flex-col"
                data-testid="photo-upload-button"
              >
                <ImageIcon size={24} className="mb-1" />
                Galeria
              </Button>
            </div>
            
            {uploading && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                <span className="ml-2 text-gray-400">Enviando...</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Gallery Dialog */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="bg-[#0A0A0A] border-[#262626] text-white max-w-4xl p-0">
          {selectedFleet && getAllPhotos().length > 0 && (
            <div className="relative">
              <div className="aspect-video bg-black flex items-center justify-center">
                <img 
                  src={getPhotoUrl(getAllPhotos()[currentPhotoIndex])}
                  alt="Foto"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              
              {/* Controls */}
              <div className="absolute top-4 right-4 flex gap-2">
                <a 
                  href={getPhotoUrl(getAllPhotos()[currentPhotoIndex])}
                  download
                  className="p-2 bg-black/50 rounded-md hover:bg-black/70 transition-colors"
                >
                  <Download size={20} className="text-white" />
                </a>
                <button 
                  onClick={() => setGalleryOpen(false)}
                  className="p-2 bg-black/50 rounded-md hover:bg-black/70 transition-colors"
                >
                  <X size={20} className="text-white" />
                </button>
              </div>
              
              {/* Navigation */}
              {getAllPhotos().length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentPhotoIndex(prev => prev > 0 ? prev - 1 : getAllPhotos().length - 1)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-md hover:bg-black/70 transition-colors"
                  >
                    <CaretLeft size={24} className="text-white" />
                  </button>
                  <button
                    onClick={() => setCurrentPhotoIndex(prev => prev < getAllPhotos().length - 1 ? prev + 1 : 0)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-md hover:bg-black/70 transition-colors"
                  >
                    <CaretRight size={24} className="text-white" />
                  </button>
                </>
              )}
              
              {/* Info */}
              <div className="p-4 bg-[#141414] border-t border-[#262626]">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="badge-info mr-2">{getAllPhotos()[currentPhotoIndex].moment === 'saida' ? 'Saída' : 'Retorno'}</span>
                    <span className="text-white font-medium capitalize">{getAllPhotos()[currentPhotoIndex].category}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {currentPhotoIndex + 1} / {getAllPhotos().length}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Por {getAllPhotos()[currentPhotoIndex].uploaded_by} em {new Date(getAllPhotos()[currentPhotoIndex].uploaded_at).toLocaleString('pt-BR')}
                </p>
              </div>
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
              Tem certeza que deseja excluir o registro do veículo "{selectedFleet?.placa}"? Esta ação não pode ser desfeita.
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

export default Fleet;
