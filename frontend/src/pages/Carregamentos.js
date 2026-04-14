import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { carregamentosAPI, agendamentosAPI } from '../services/api';
import { formatApiError, cleanFormData } from '../utils/errorUtils';
import { 
  Plus, 
  MagnifyingGlass, 
  Pencil, 
  Trash, 
  Eye,
  SignOut,
  Printer,
  CalendarCheck,
  SignIn,
  Camera,
  Image as ImageIcon,
  X,
  CaretLeft,
  CaretRight
} from '@phosphor-icons/react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
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

const API = process.env.REACT_APP_BACKEND_URL;

const PHOTO_CATEGORIES = [
  { value: 'geral', label: 'Geral' },
  { value: 'placa', label: 'Placa' },
  { value: 'motorista', label: 'Motorista' },
  { value: 'carga', label: 'Carga' },
];

const Carregamentos = () => {
  const { isAdmin, isPortaria } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [carregamentos, setCarregamentos] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('em_andamento');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedCarregamento, setSelectedCarregamento] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [photoCategory, setPhotoCategory] = useState('geral');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  
  const [filters, setFilters] = useState({
    placa_carreta: '',
    motorista: '',
    empresa: '',
    destino: '',
    status: '',
    data_inicio: '',
    data_fim: ''
  });
  
  const [formData, setFormData] = useState({
    placa_carreta: '',
    placa_cavalo: '',
    cubagem: '',
    motorista: '',
    empresa_terceirizada: '',
    destino: '',
    observacao: '',
    agendamento_id: null
  });

  useEffect(() => {
    loadCarregamentos();
    loadAgendamentos();
    if (searchParams.get('action') === 'new') {
      setDialogOpen(true);
      setSearchParams({});
    }
  }, []);

  const loadCarregamentos = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.placa_carreta) params.placa_carreta = filters.placa_carreta;
      if (filters.motorista) params.motorista = filters.motorista;
      if (filters.empresa) params.empresa = filters.empresa;
      if (filters.destino) params.destino = filters.destino;
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      if (filters.data_inicio) params.data_inicio = filters.data_inicio;
      if (filters.data_fim) params.data_fim = filters.data_fim;
      
      const response = await carregamentosAPI.list(params);
      setCarregamentos(response.data.items);
    } catch (error) {
      toast.error('Erro ao carregar carregamentos');
    } finally {
      setLoading(false);
    }
  };

  const loadAgendamentos = async () => {
    try {
      const response = await agendamentosAPI.list({ tipo: 'carregamento', status: 'pendente' });
      setAgendamentos(response.data.items);
    } catch (error) {
      console.error('Error loading agendamentos:', error);
    }
  };

  const handleDarEntrada = async (agendamento) => {
    try {
      await agendamentosAPI.darEntrada(agendamento.id);
      toast.success('Entrada registrada com sucesso!');
      loadCarregamentos();
      loadAgendamentos();
      setActiveTab('em_andamento');
    } catch (error) {
      toast.error(formatApiError(error.response?.data?.detail, 'Erro ao dar entrada'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await carregamentosAPI.create(cleanFormData(formData));
      toast.success('Carregamento registrado');
      setDialogOpen(false);
      resetForm();
      loadCarregamentos();
      loadAgendamentos();
    } catch (error) {
      toast.error(formatApiError(error.response?.data?.detail, 'Erro ao registrar'));
    }
  };

  const handleRegisterExit = async (carregamento) => {
    try {
      const now = new Date();
      await carregamentosAPI.update(carregamento.id, {
        hora_saida: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      });
      toast.success('Saída registrada');
      loadCarregamentos();
    } catch (error) {
      toast.error('Erro ao registrar saída');
    }
  };

  const handleDelete = async () => {
    try {
      await carregamentosAPI.delete(selectedCarregamento.id);
      toast.success('Carregamento excluído');
      setDeleteDialogOpen(false);
      setSelectedCarregamento(null);
      loadCarregamentos();
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const handlePhotoUpload = async (file) => {
    if (!file || !selectedCarregamento) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      await carregamentosAPI.uploadPhoto(selectedCarregamento.id, formData, {
        categoria: photoCategory
      });
      
      toast.success('Foto enviada');
      
      // Reload carregamento data
      const response = await carregamentosAPI.get(selectedCarregamento.id);
      setSelectedCarregamento(response.data);
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
      placa_carreta: '',
      placa_cavalo: '',
      cubagem: '',
      motorista: '',
      empresa_terceirizada: '',
      destino: '',
      observacao: '',
      agendamento_id: null
    });
  };

  const toggleSelectItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === carregamentos.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(carregamentos.map(c => c.id));
    }
  };

  const openPhotoDialog = (item) => {
    setSelectedCarregamento(item);
    setPhotoCategory('geral');
    setPhotoDialogOpen(true);
  };

  const openGallery = async (item) => {
    try {
      const response = await carregamentosAPI.get(item.id);
      setSelectedCarregamento(response.data);
      setCurrentPhotoIndex(0);
      setGalleryOpen(true);
    } catch (error) {
      toast.error('Erro ao carregar fotos');
    }
  };

  const getPhotoUrl = (photo) => {
    return `${API}/api/carregamentos/${selectedCarregamento.id}/photos/${photo.id}`;
  };

  const handlePrintSelected = () => {
    const itemsToPrint = carregamentos.filter(c => selectedItems.includes(c.id));
    if (itemsToPrint.length === 0) {
      toast.error('Selecione pelo menos um registro para imprimir');
      return;
    }
    printMultiple(itemsToPrint);
  };

  const printMultiple = (items) => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Registro de Carregamentos - CIPOLATTI</title>
        <style>
          @page { margin: 12mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; font-size: 11px; }
          
          /* Header Corporativo */
          .header {
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            color: white;
            padding: 20px 25px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }
          .logo-section { display: flex; align-items: center; gap: 15px; }
          .logo-icon {
            width: 45px; height: 45px;
            background: #333;
            border-radius: 8px;
            display: flex; align-items: center; justify-content: center;
            font-weight: bold; font-size: 20px; color: #fff;
            border: 2px solid #444;
          }
          .company-name { font-size: 26px; font-weight: bold; letter-spacing: 2px; }
          .company-name span { color: #e63946; }
          .company-subtitle { font-size: 10px; color: #aaa; margin-top: 2px; }
          .header-info { text-align: right; }
          .header-title { font-size: 14px; font-weight: 600; }
          .header-date { font-size: 10px; color: #aaa; margin-top: 4px; }
          
          /* Record Cards */
          .record {
            border: 1px solid #ddd;
            border-radius: 8px;
            margin-bottom: 20px;
            page-break-inside: avoid;
            overflow: hidden;
          }
          .record-header {
            background: #f8f8f8;
            padding: 12px 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #eee;
          }
          .record-plates {
            font-size: 16px;
            font-weight: bold;
            color: #1a1a1a;
            font-family: 'Courier New', monospace;
            letter-spacing: 1px;
          }
          .record-status {
            padding: 4px 14px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
          }
          .status-loading { background: #fef3c7; color: #92400e; }
          .status-done { background: #dcfce7; color: #166534; }
          
          .record-body { padding: 15px; }
          .fields {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
          }
          .field { }
          .field-full { grid-column: span 2; }
          .field-label {
            font-size: 9px;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 3px;
          }
          .field-value {
            font-size: 12px;
            color: #333;
            font-weight: 500;
          }
          .field-value.mono {
            font-family: 'Courier New', monospace;
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
            display: inline-block;
          }
          
          /* Photos Section */
          .photos-section {
            border-top: 1px solid #eee;
            padding: 15px;
            background: #fafafa;
          }
          .photos-title {
            font-size: 11px;
            font-weight: 600;
            color: #666;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .photos-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
          }
          .photo-item {
            border: 1px solid #ddd;
            border-radius: 6px;
            overflow: hidden;
            background: white;
          }
          .photo-item img {
            width: 100%;
            height: 100px;
            object-fit: cover;
            display: block;
          }
          .photo-caption {
            font-size: 8px;
            padding: 4px 6px;
            background: #f0f0f0;
            text-align: center;
            color: #666;
            text-transform: uppercase;
          }
          
          /* Footer */
          .footer {
            margin-top: 30px;
            padding: 15px 25px;
            background: #1a1a1a;
            color: #888;
            font-size: 10px;
            display: flex;
            justify-content: space-between;
          }
          
          @media print {
            .record { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-section">
            <div class="logo-icon">C</div>
            <div>
              <div class="company-name">CIPO<span>LATTI</span></div>
              <div class="company-subtitle">Controle de Acesso</div>
            </div>
          </div>
          <div class="header-info">
            <div class="header-title">Registro de Carregamentos</div>
            <div class="header-date">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
          </div>
        </div>
        
        ${items.map(item => `
          <div class="record">
            <div class="record-header">
              <div class="record-plates">${item.placa_carreta} / ${item.placa_cavalo}</div>
              <div class="record-status ${item.status === 'em_carregamento' ? 'status-loading' : 'status-done'}">
                ${item.status === 'em_carregamento' ? 'Em Carregamento' : 'Finalizado'}
              </div>
            </div>
            <div class="record-body">
              <div class="fields">
                <div class="field">
                  <div class="field-label">Motorista</div>
                  <div class="field-value">${item.motorista}</div>
                </div>
                <div class="field">
                  <div class="field-label">Empresa</div>
                  <div class="field-value">${item.empresa_terceirizada}</div>
                </div>
                <div class="field">
                  <div class="field-label">Destino</div>
                  <div class="field-value">${item.destino}</div>
                </div>
                <div class="field">
                  <div class="field-label">Cubagem</div>
                  <div class="field-value">${item.cubagem || '-'}</div>
                </div>
                <div class="field">
                  <div class="field-label">Data</div>
                  <div class="field-value">${item.data}</div>
                </div>
                <div class="field">
                  <div class="field-label">Entrada</div>
                  <div class="field-value mono">${item.hora_entrada}</div>
                </div>
                <div class="field">
                  <div class="field-label">Saída</div>
                  <div class="field-value mono">${item.hora_saida || '-'}</div>
                </div>
                <div class="field">
                  <div class="field-label">Porteiro</div>
                  <div class="field-value">${item.porteiro_entrada}</div>
                </div>
                ${item.observacao ? `
                  <div class="field field-full">
                    <div class="field-label">Observação</div>
                    <div class="field-value">${item.observacao}</div>
                  </div>
                ` : ''}
              </div>
            </div>
            ${item.fotos?.length > 0 ? `
              <div class="photos-section">
                <div class="photos-title">📷 Registro Fotográfico (${item.fotos.length} fotos)</div>
                <div class="photos-grid">
                  ${item.fotos.map(photo => `
                    <div class="photo-item">
                      <img src="${API}/api/carregamentos/${item.id}/photos/${photo.id}" alt="${photo.categoria}" onerror="this.parentElement.style.display='none'" />
                      <div class="photo-caption">${photo.categoria || 'Geral'}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `).join('')}
        
        <div class="footer">
          <div>CIPOLATTI - Sistema de Controle de Acesso Corporativo</div>
          <div>Documento confidencial - Uso interno</div>
        </div>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      // Aguarda carregamento das imagens antes de imprimir
      setTimeout(() => {
        printWindow.print();
      }, 1500);
    }
  };

  const handlePrint = (item) => {
    printMultiple([item]);
  };

  return (
    <div className="space-y-6" data-testid="carregamentos-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white font-['Outfit']">Carregamentos</h1>
          <p className="text-gray-500 mt-1">Controle de entrada e saída de carregamentos</p>
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
              data-testid="add-carregamento-button"
            >
              <Plus size={18} className="mr-2" />
              Novo Carregamento
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#0A0A0A] border border-[#262626]">
          <TabsTrigger value="em_andamento" className="data-[state=active]:bg-[#262626]">
            Em Andamento ({carregamentos.filter(c => c.status === 'em_carregamento').length})
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
                  <TableHead className="text-gray-400">Motorista</TableHead>
                  <TableHead className="text-gray-400">Empresa</TableHead>
                  <TableHead className="text-gray-400">Destino</TableHead>
                  <TableHead className="text-gray-400">Placas</TableHead>
                  <TableHead className="text-gray-400 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agendamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      Nenhum carregamento agendado
                    </TableCell>
                  </TableRow>
                ) : (
                  agendamentos.map((ag) => (
                    <TableRow key={ag.id} className="border-[#262626] hover:bg-[#1F1F1F]">
                      <TableCell className="text-white font-medium">{ag.data_prevista}</TableCell>
                      <TableCell className="text-gray-400 font-mono">{ag.hora_prevista || '-'}</TableCell>
                      <TableCell className="text-white">{ag.motorista || '-'}</TableCell>
                      <TableCell className="text-gray-400">{ag.empresa_terceirizada || '-'}</TableCell>
                      <TableCell className="text-gray-400">{ag.destino || '-'}</TableCell>
                      <TableCell className="text-white font-mono text-xs">
                        {ag.placa_carreta && <span className="mr-2">{ag.placa_carreta}</span>}
                        {ag.placa_cavalo && <span className="text-gray-400">{ag.placa_cavalo}</span>}
                      </TableCell>
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

        {/* Em Andamento Tab */}
        <TabsContent value="em_andamento" className="mt-4 space-y-4">
          <div className="card-dark overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[#262626] hover:bg-transparent">
                  <TableHead className="text-gray-400 w-10">
                    <Checkbox
                      checked={selectedItems.length === carregamentos.filter(c => c.status === 'em_carregamento').length && carregamentos.filter(c => c.status === 'em_carregamento').length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-gray-400">Carreta</TableHead>
                  <TableHead className="text-gray-400">Cavalo</TableHead>
                  <TableHead className="text-gray-400">Motorista</TableHead>
                  <TableHead className="text-gray-400">Empresa</TableHead>
                  <TableHead className="text-gray-400">Destino</TableHead>
                  <TableHead className="text-gray-400">Entrada</TableHead>
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
                ) : carregamentos.filter(c => c.status === 'em_carregamento').length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                      Nenhum carregamento em andamento
                    </TableCell>
                  </TableRow>
                ) : (
                  carregamentos.filter(c => c.status === 'em_carregamento').map((item) => (
                    <TableRow key={item.id} className="border-[#262626] hover:bg-[#1F1F1F]">
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={() => toggleSelectItem(item.id)}
                        />
                      </TableCell>
                      <TableCell className="text-white font-mono font-medium">{item.placa_carreta}</TableCell>
                      <TableCell className="text-white font-mono">{item.placa_cavalo}</TableCell>
                      <TableCell className="text-white">{item.motorista}</TableCell>
                      <TableCell className="text-gray-400">{item.empresa_terceirizada}</TableCell>
                      <TableCell className="text-gray-400">{item.destino}</TableCell>
                      <TableCell className="text-gray-400 font-mono">{item.hora_entrada}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedCarregamento(item); setViewDialogOpen(true); }}
                            className="text-gray-400 hover:text-white"
                          >
                            <Eye size={16} />
                          </Button>
                          {(isAdmin || isPortaria) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPhotoDialog(item)}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              <Camera size={16} />
                            </Button>
                          )}
                          {item.fotos?.length > 0 && (
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
                              onClick={() => handleRegisterExit(item)}
                              className="text-green-400 hover:text-green-300"
                            >
                              <SignOut size={16} />
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
                              onClick={() => { setSelectedCarregamento(item); setDeleteDialogOpen(true); }}
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
                <Label className="text-gray-400 text-xs">Placa Carreta</Label>
                <Input
                  placeholder="Buscar placa"
                  value={filters.placa_carreta}
                  onChange={(e) => setFilters({ ...filters, placa_carreta: e.target.value.toUpperCase() })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1 font-mono"
                  data-testid="filter-placa"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Motorista</Label>
                <Input
                  placeholder="Buscar motorista"
                  value={filters.motorista}
                  onChange={(e) => setFilters({ ...filters, motorista: e.target.value.toUpperCase() })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  data-testid="filter-motorista"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Empresa</Label>
                <Input
                  placeholder="Buscar empresa"
                  value={filters.empresa}
                  onChange={(e) => setFilters({ ...filters, empresa: e.target.value.toUpperCase() })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  data-testid="filter-empresa"
                />
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
              <div className="flex items-end">
                <Button 
                  onClick={loadCarregamentos}
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
                      checked={selectedItems.length === carregamentos.length && carregamentos.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-gray-400">Carreta</TableHead>
                  <TableHead className="text-gray-400">Cavalo</TableHead>
                  <TableHead className="text-gray-400">Motorista</TableHead>
                  <TableHead className="text-gray-400">Empresa</TableHead>
                  <TableHead className="text-gray-400">Destino</TableHead>
                  <TableHead className="text-gray-400">Entrada</TableHead>
                  <TableHead className="text-gray-400">Saída</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-gray-500 py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : carregamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-gray-500 py-8">
                      Nenhum carregamento encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  carregamentos.map((item) => (
                    <TableRow key={item.id} className="border-[#262626] hover:bg-[#1F1F1F]">
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={() => toggleSelectItem(item.id)}
                        />
                      </TableCell>
                      <TableCell className="text-white font-mono font-medium">{item.placa_carreta}</TableCell>
                      <TableCell className="text-white font-mono">{item.placa_cavalo}</TableCell>
                      <TableCell className="text-white">{item.motorista}</TableCell>
                      <TableCell className="text-gray-400">{item.empresa_terceirizada}</TableCell>
                      <TableCell className="text-gray-400">{item.destino}</TableCell>
                      <TableCell className="text-gray-400 font-mono">{item.hora_entrada}</TableCell>
                      <TableCell className="text-gray-400 font-mono">{item.hora_saida || '-'}</TableCell>
                      <TableCell>
                        {item.status === 'em_carregamento' ? (
                          <span className="badge-warning">Em Carregamento</span>
                        ) : (
                          <span className="badge-success">Finalizado</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedCarregamento(item); setViewDialogOpen(true); }}
                            className="text-gray-400 hover:text-white"
                          >
                            <Eye size={16} />
                          </Button>
                          {item.fotos?.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openGallery(item)}
                              className="text-purple-400 hover:text-purple-300"
                            >
                              <ImageIcon size={16} />
                            </Button>
                          )}
                          {item.status === 'em_carregamento' && (isAdmin || isPortaria) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRegisterExit(item)}
                              className="text-green-400 hover:text-green-300"
                            >
                              <SignOut size={16} />
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
                              onClick={() => { setSelectedCarregamento(item); setDeleteDialogOpen(true); }}
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

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#141414] border-[#262626] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">Novo Carregamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Placa Carreta *</Label>
                <Input
                  value={formData.placa_carreta}
                  onChange={(e) => setFormData({ ...formData, placa_carreta: e.target.value.toUpperCase() })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1 font-mono"
                  placeholder="ABC1234"
                  required
                  data-testid="carregamento-placa-carreta"
                />
              </div>
              <div>
                <Label className="text-gray-400">Placa Cavalo *</Label>
                <Input
                  value={formData.placa_cavalo}
                  onChange={(e) => setFormData({ ...formData, placa_cavalo: e.target.value.toUpperCase() })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1 font-mono"
                  placeholder="XYZ5678"
                  required
                  data-testid="carregamento-placa-cavalo"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Motorista *</Label>
                <Input
                  value={formData.motorista}
                  onChange={(e) => setFormData({ ...formData, motorista: e.target.value.toUpperCase() })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  required
                  data-testid="carregamento-motorista"
                />
              </div>
              <div>
                <Label className="text-gray-400">Cubagem</Label>
                <Input
                  value={formData.cubagem}
                  onChange={(e) => setFormData({ ...formData, cubagem: e.target.value })}
                  className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  placeholder="Ex: 50m³"
                  data-testid="carregamento-cubagem"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-400">Empresa Terceirizada *</Label>
              <Input
                value={formData.empresa_terceirizada}
                onChange={(e) => setFormData({ ...formData, empresa_terceirizada: e.target.value.toUpperCase() })}
                className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                required
                data-testid="carregamento-empresa"
              />
            </div>
            <div>
              <Label className="text-gray-400">Destino (Shopping) *</Label>
              <Input
                value={formData.destino}
                onChange={(e) => setFormData({ ...formData, destino: e.target.value.toUpperCase() })}
                className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                placeholder="Shopping onde será realizada a entrega"
                required
                data-testid="carregamento-destino"
              />
            </div>
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
              <Button type="submit" className="bg-white text-black hover:bg-gray-200" data-testid="carregamento-submit">
                Registrar Entrada
              </Button>
            </div>
          </form>
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
          {selectedCarregamento && selectedCarregamento.fotos?.length > 0 && (
            <div className="relative">
              <div className="aspect-video bg-black flex items-center justify-center">
                <img 
                  src={getPhotoUrl(selectedCarregamento.fotos[currentPhotoIndex])}
                  alt="Foto"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              
              {/* Controls */}
              <div className="absolute top-4 right-4 flex gap-2">
                <button 
                  onClick={() => setGalleryOpen(false)}
                  className="p-2 bg-black/50 rounded-md hover:bg-black/70 transition-colors"
                >
                  <X size={20} className="text-white" />
                </button>
              </div>
              
              {/* Navigation */}
              {selectedCarregamento.fotos.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentPhotoIndex(prev => prev > 0 ? prev - 1 : selectedCarregamento.fotos.length - 1)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-md hover:bg-black/70 transition-colors"
                  >
                    <CaretLeft size={24} className="text-white" />
                  </button>
                  <button
                    onClick={() => setCurrentPhotoIndex(prev => prev < selectedCarregamento.fotos.length - 1 ? prev + 1 : 0)}
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
                    <span className="text-white font-medium capitalize">{selectedCarregamento.fotos[currentPhotoIndex].categoria}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {currentPhotoIndex + 1} / {selectedCarregamento.fotos.length}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Por {selectedCarregamento.fotos[currentPhotoIndex].uploaded_by} em {new Date(selectedCarregamento.fotos[currentPhotoIndex].uploaded_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="bg-[#141414] border-[#262626] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">Detalhes do Carregamento</DialogTitle>
          </DialogHeader>
          {selectedCarregamento && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Placa Carreta</p>
                  <p className="text-white font-mono font-medium">{selectedCarregamento.placa_carreta}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Placa Cavalo</p>
                  <p className="text-white font-mono">{selectedCarregamento.placa_cavalo}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Motorista</p>
                  <p className="text-white">{selectedCarregamento.motorista}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Cubagem</p>
                  <p className="text-white">{selectedCarregamento.cubagem || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Empresa</p>
                  <p className="text-white">{selectedCarregamento.empresa_terceirizada}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Destino</p>
                  <p className="text-white">{selectedCarregamento.destino}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Data</p>
                  <p className="text-white">{selectedCarregamento.data}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Entrada</p>
                  <p className="text-white font-mono">{selectedCarregamento.hora_entrada}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Saída</p>
                  <p className="text-white font-mono">{selectedCarregamento.hora_saida || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Porteiro Entrada</p>
                  <p className="text-white">{selectedCarregamento.porteiro_entrada}</p>
                </div>
              </div>
              {selectedCarregamento.fotos?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Fotos ({selectedCarregamento.fotos.length})</p>
                  <Button
                    onClick={() => { setViewDialogOpen(false); openGallery(selectedCarregamento); }}
                    variant="outline"
                    className="border-[#262626] text-white hover:bg-[#262626]"
                    size="sm"
                  >
                    <ImageIcon size={16} className="mr-2" />
                    Ver Fotos
                  </Button>
                </div>
              )}
              {selectedCarregamento.observacao && (
                <div>
                  <p className="text-xs text-gray-500">Observação</p>
                  <p className="text-white">{selectedCarregamento.observacao}</p>
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
              Tem certeza que deseja excluir este carregamento? Esta ação não pode ser desfeita.
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

export default Carregamentos;
