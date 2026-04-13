import React, { useState } from 'react';
import { reportsAPI } from '../services/api';
import { 
  FileText,
  FilePdf,
  FileXls,
  MagnifyingGlass,
  Printer,
  Camera,
  Image as ImageIcon
} from '@phosphor-icons/react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const API = process.env.REACT_APP_BACKEND_URL;

// Logo CIPOLATTI em base64 para o PDF (placeholder - usar logo real)
const LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('visitors');
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalKm, setTotalKm] = useState(0);
  
  const [filters, setFilters] = useState({
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: new Date().toISOString().split('T')[0],
    nome: '',
    placa: '',
    setor: '',
    motorista: '',
    destino: '',
    porteiro: ''
  });

  const loadReport = async () => {
    if (!filters.data_inicio || !filters.data_fim) {
      toast.error('Selecione o período');
      return;
    }
    
    setLoading(true);
    try {
      let response;
      const params = {
        data_inicio: filters.data_inicio,
        data_fim: filters.data_fim
      };
      
      if (filters.nome) params.nome = filters.nome;
      if (filters.placa) params.placa = filters.placa;
      if (filters.porteiro) params.porteiro = filters.porteiro;
      
      switch (activeTab) {
        case 'visitors':
          response = await reportsAPI.visitors(params);
          break;
        case 'fleet':
          if (filters.motorista) params.motorista = filters.motorista;
          if (filters.destino) params.destino = filters.destino;
          response = await reportsAPI.fleet(params);
          setTotalKm(response.data.total_km || 0);
          break;
        case 'employees':
          if (filters.setor) params.setor = filters.setor;
          response = await reportsAPI.employees(params);
          break;
        case 'directors':
          response = await reportsAPI.directors(params);
          break;
        case 'carregamentos':
          if (filters.motorista) params.motorista = filters.motorista;
          if (filters.destino) params.destino = filters.destino;
          response = await reportsAPI.carregamentos(params);
          break;
        default:
          return;
      }
      
      setData(response.data.items || response.data);
      setTotal(response.data.total || response.data.length);
    } catch (error) {
      toast.error('Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  };

  const getColumns = () => {
    switch (activeTab) {
      case 'visitors':
        return ['Nome', 'Data', 'Entrada', 'Saída', 'Placa', 'Veículo', 'Porteiro'];
      case 'fleet':
        return ['Placa', 'Carro', 'Motorista', 'Destino', 'Saída', 'Retorno', 'KM', 'Porteiro', 'Fotos'];
      case 'employees':
        return ['Nome', 'Setor', 'Data', 'Entrada', 'Saída', 'Autorizado', 'Placa', 'Porteiro'];
      case 'directors':
        return ['Nome', 'Data', 'Entrada', 'Saída', 'Placa', 'Carro', 'Porteiro'];
      case 'carregamentos':
        return ['Carreta', 'Cavalo', 'Motorista', 'Empresa', 'Destino', 'Data', 'Entrada', 'Saída', 'Fotos'];
      default:
        return [];
    }
  };

  const getRowData = (item) => {
    switch (activeTab) {
      case 'visitors':
        return [item.nome, item.data, item.hora_entrada, item.hora_saida || '-', item.placa || '-', item.veiculo || '-', item.porteiro];
      case 'fleet':
        const fotosFleet = (item.fotos_saida?.length || 0) + (item.fotos_retorno?.length || 0);
        return [item.placa, item.carro, item.motorista, item.destino, `${item.data_saida} ${item.hora_saida}`, item.data_retorno ? `${item.data_retorno} ${item.hora_retorno}` : '-', item.km_rodado ? `${item.km_rodado}` : '-', item.porteiro_saida, fotosFleet > 0 ? `${fotosFleet} foto(s)` : '-'];
      case 'employees':
        return [item.nome, item.setor, item.data, item.hora_entrada, item.hora_saida || '-', item.autorizado ? 'Sim' : 'Não', item.placa || '-', item.porteiro];
      case 'directors':
        return [item.nome, item.data, item.hora_entrada, item.hora_saida || '-', item.placa || '-', item.carro || '-', item.porteiro];
      case 'carregamentos':
        const fotosCarreg = item.fotos?.length || 0;
        return [item.placa_carreta, item.placa_cavalo, item.motorista, item.empresa_terceirizada, item.destino, item.data, item.hora_entrada, item.hora_saida || '-', fotosCarreg > 0 ? `${fotosCarreg} foto(s)` : '-'];
      default:
        return [];
    }
  };

  const getTitle = () => {
    const titles = {
      visitors: 'Visitantes',
      fleet: 'Frota',
      employees: 'Funcionários',
      directors: 'Diretoria',
      carregamentos: 'Carregamentos'
    };
    return titles[activeTab];
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for more space
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header with corporate style
    doc.setFillColor(26, 26, 26);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    // Logo placeholder and company name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('CIPOLATTI', 14, 18);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Controle de Acesso', 14, 25);
    
    // Report title
    doc.setFontSize(14);
    doc.text(`Relatório de ${getTitle()}`, pageWidth - 14, 18, { align: 'right' });
    
    doc.setFontSize(9);
    doc.text(`Período: ${formatDate(filters.data_inicio)} a ${formatDate(filters.data_fim)}`, pageWidth - 14, 25, { align: 'right' });
    
    // Stats bar
    doc.setFillColor(38, 38, 38);
    doc.rect(0, 35, pageWidth, 12, 'F');
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(10);
    doc.text(`Total de registros: ${total}`, 14, 43);
    if (activeTab === 'fleet' && totalKm > 0) {
      doc.text(`Total KM rodado: ${totalKm} km`, 100, 43);
    }
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth - 14, 43, { align: 'right' });
    
    // Table
    const columns = getColumns();
    const rows = data.map(item => getRowData(item));
    
    doc.autoTable({
      head: [columns],
      body: rows,
      startY: 52,
      styles: { 
        fontSize: 8,
        cellPadding: 3,
        lineColor: [50, 50, 50],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [26, 26, 26],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: {
        0: { fontStyle: 'bold' }
      },
      didDrawPage: (data) => {
        // Footer
        doc.setFillColor(26, 26, 26);
        doc.rect(0, doc.internal.pageSize.getHeight() - 12, pageWidth, 12, 'F');
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(8);
        doc.text('CIPOLATTI - Sistema de Controle de Acesso', 14, doc.internal.pageSize.getHeight() - 5);
        doc.text(`Página ${data.pageNumber}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 5, { align: 'right' });
      }
    });
    
    doc.save(`CIPOLATTI_Relatorio_${getTitle()}_${filters.data_inicio}_${filters.data_fim}.pdf`);
    toast.success('PDF gerado com sucesso');
  };

  const exportExcel = () => {
    const columns = getColumns();
    const rows = data.map(item => {
      const rowData = getRowData(item);
      const obj = {};
      columns.forEach((col, idx) => {
        obj[col] = rowData[idx];
      });
      return obj;
    });
    
    // Add header info
    const headerRows = [
      { [columns[0]]: 'CIPOLATTI - Controle de Acesso' },
      { [columns[0]]: `Relatório de ${getTitle()}` },
      { [columns[0]]: `Período: ${formatDate(filters.data_inicio)} a ${formatDate(filters.data_fim)}` },
      { [columns[0]]: `Total: ${total} registros` },
      { [columns[0]]: '' }
    ];
    
    const ws = XLSX.utils.json_to_sheet([...headerRows, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, getTitle());
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(dataBlob, `CIPOLATTI_Relatorio_${getTitle()}_${filters.data_inicio}_${filters.data_fim}.xlsx`);
    toast.success('Excel gerado com sucesso');
  };

  const handlePrint = () => {
    const columns = getColumns();
    const rows = data.map(item => getRowData(item));
    
    // Check for photos in items
    const hasPhotos = activeTab === 'fleet' || activeTab === 'carregamentos';
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>CIPOLATTI - Relatório de ${getTitle()}</title>
        <style>
          @page { 
            size: landscape; 
            margin: 10mm; 
          }
          * { 
            box-sizing: border-box; 
            margin: 0; 
            padding: 0; 
          }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            color: #333;
            font-size: 11px;
          }
          
          /* Header */
          .header {
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            color: white;
            padding: 20px 25px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0;
          }
          .logo-section {
            display: flex;
            align-items: center;
            gap: 15px;
          }
          .logo {
            width: 50px;
            height: 50px;
            background: #333;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 18px;
            color: #fff;
            border: 2px solid #444;
          }
          .company-name {
            font-size: 28px;
            font-weight: bold;
            letter-spacing: 2px;
          }
          .company-name span {
            color: #e63946;
          }
          .company-subtitle {
            font-size: 11px;
            color: #aaa;
            margin-top: 2px;
          }
          .report-info {
            text-align: right;
          }
          .report-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 5px;
          }
          .report-period {
            font-size: 11px;
            color: #aaa;
          }
          
          /* Stats Bar */
          .stats-bar {
            background: #f5f5f5;
            padding: 12px 25px;
            display: flex;
            gap: 40px;
            border-bottom: 2px solid #1a1a1a;
          }
          .stat-item {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .stat-label {
            color: #666;
            font-size: 10px;
            text-transform: uppercase;
          }
          .stat-value {
            font-weight: bold;
            font-size: 14px;
            color: #1a1a1a;
          }
          
          /* Table */
          .table-container {
            padding: 15px 25px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse;
            font-size: 10px;
          }
          th { 
            background: #1a1a1a; 
            color: white; 
            padding: 10px 8px; 
            text-align: left;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.5px;
          }
          td { 
            border-bottom: 1px solid #e0e0e0; 
            padding: 8px;
            vertical-align: middle;
          }
          tr:nth-child(even) {
            background: #fafafa;
          }
          tr:hover { 
            background: #f0f0f0; 
          }
          td:first-child {
            font-weight: 600;
            color: #1a1a1a;
          }
          .photo-indicator {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: #e8f5e9;
            color: #2e7d32;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 9px;
            font-weight: 500;
          }
          .no-photo {
            color: #999;
          }
          
          /* Footer */
          .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #1a1a1a;
            color: #aaa;
            padding: 8px 25px;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
          }
          
          /* Photos Section */
          .photos-section {
            page-break-before: always;
            padding: 25px;
          }
          .photos-section h2 {
            font-size: 16px;
            color: #1a1a1a;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #1a1a1a;
          }
          .photo-group {
            margin-bottom: 25px;
            page-break-inside: avoid;
          }
          .photo-group-title {
            font-size: 12px;
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
            padding: 8px 12px;
            background: #f5f5f5;
            border-left: 3px solid #1a1a1a;
          }
          .photo-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
          }
          .photo-item {
            border: 1px solid #ddd;
            border-radius: 4px;
            overflow: hidden;
          }
          .photo-item img {
            width: 100%;
            height: 120px;
            object-fit: cover;
          }
          .photo-caption {
            font-size: 8px;
            padding: 4px;
            background: #f5f5f5;
            text-align: center;
            color: #666;
          }
          
          @media print {
            .footer {
              position: fixed;
              bottom: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-section">
            <div class="logo">C</div>
            <div>
              <div class="company-name">CIPO<span>LATTI</span></div>
              <div class="company-subtitle">Controle de Acesso</div>
            </div>
          </div>
          <div class="report-info">
            <div class="report-title">Relatório de ${getTitle()}</div>
            <div class="report-period">Período: ${formatDate(filters.data_inicio)} a ${formatDate(filters.data_fim)}</div>
          </div>
        </div>
        
        <div class="stats-bar">
          <div class="stat-item">
            <span class="stat-label">Total de Registros</span>
            <span class="stat-value">${total}</span>
          </div>
          ${activeTab === 'fleet' && totalKm > 0 ? `
          <div class="stat-item">
            <span class="stat-label">Total KM Rodado</span>
            <span class="stat-value">${totalKm} km</span>
          </div>
          ` : ''}
          <div class="stat-item">
            <span class="stat-label">Gerado em</span>
            <span class="stat-value">${new Date().toLocaleString('pt-BR')}</span>
          </div>
        </div>
        
        <div class="table-container">
          <table>
            <thead>
              <tr>${columns.map(col => `<th>${col}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.map((row, idx) => `
                <tr>
                  ${row.map((cell, cellIdx) => {
                    // Check if this is a photo column
                    const isPhotoCol = columns[cellIdx] === 'Fotos';
                    if (isPhotoCol && cell !== '-') {
                      return `<td><span class="photo-indicator">📷 ${cell}</span></td>`;
                    } else if (isPhotoCol) {
                      return `<td class="no-photo">-</td>`;
                    }
                    return `<td>${cell}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        ${hasPhotos ? `
        <div class="photos-section">
          <h2>Anexo: Registro Fotográfico</h2>
          ${data.filter(item => (item.fotos?.length > 0) || (item.fotos_saida?.length > 0) || (item.fotos_retorno?.length > 0)).map(item => {
            const identifier = activeTab === 'carregamentos' 
              ? `${item.placa_carreta} / ${item.placa_cavalo} - ${item.motorista}`
              : `${item.placa} - ${item.motorista}`;
            
            const photos = activeTab === 'carregamentos' 
              ? (item.fotos || [])
              : [...(item.fotos_saida || []), ...(item.fotos_retorno || [])];
            
            if (photos.length === 0) return '';
            
            const photoEndpoint = activeTab === 'carregamentos' ? 'carregamentos' : 'fleet';
            
            return `
              <div class="photo-group">
                <div class="photo-group-title">${identifier} - ${item.data || item.data_saida}</div>
                <div class="photo-grid">
                  ${photos.map(photo => `
                    <div class="photo-item">
                      <img src="${API}/api/${photoEndpoint}/${item.id}/photos/${photo.id}" alt="${photo.categoria || photo.category || 'Foto'}" onerror="this.style.display='none'" />
                      <div class="photo-caption">${photo.categoria || photo.category || 'Geral'} - ${photo.moment || ''}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        ` : ''}
        
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
      // Wait for images to load before printing
      setTimeout(() => {
        printWindow.print();
      }, 1500);
    }
  };

  return (
    <div className="space-y-6" data-testid="reports-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white font-['Outfit']">Relatórios</h1>
        <p className="text-gray-500 mt-1">Gere relatórios detalhados por período</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setData([]); setTotal(0); }}>
        <TabsList className="bg-[#0A0A0A] border border-[#262626]">
          <TabsTrigger value="visitors" className="data-[state=active]:bg-[#262626]" data-testid="tab-visitors">
            Visitantes
          </TabsTrigger>
          <TabsTrigger value="fleet" className="data-[state=active]:bg-[#262626]" data-testid="tab-fleet">
            Frota
          </TabsTrigger>
          <TabsTrigger value="employees" className="data-[state=active]:bg-[#262626]" data-testid="tab-employees">
            Funcionários
          </TabsTrigger>
          <TabsTrigger value="directors" className="data-[state=active]:bg-[#262626]" data-testid="tab-directors">
            Diretoria
          </TabsTrigger>
          <TabsTrigger value="carregamentos" className="data-[state=active]:bg-[#262626]" data-testid="tab-carregamentos">
            Carregamentos
          </TabsTrigger>
        </TabsList>

        {/* Filters */}
        <div className="card-dark p-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-gray-400 text-xs">Data Início *</Label>
              <Input
                type="date"
                value={filters.data_inicio}
                onChange={(e) => setFilters({ ...filters, data_inicio: e.target.value })}
                className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                data-testid="report-data-inicio"
              />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Data Fim *</Label>
              <Input
                type="date"
                value={filters.data_fim}
                onChange={(e) => setFilters({ ...filters, data_fim: e.target.value })}
                className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                data-testid="report-data-fim"
              />
            </div>
            
            {activeTab === 'visitors' && (
              <>
                <div>
                  <Label className="text-gray-400 text-xs">Nome</Label>
                  <Input
                    value={filters.nome}
                    onChange={(e) => setFilters({ ...filters, nome: e.target.value })}
                    placeholder="Filtrar por nome"
                    className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">Placa</Label>
                  <Input
                    value={filters.placa}
                    onChange={(e) => setFilters({ ...filters, placa: e.target.value })}
                    placeholder="Filtrar por placa"
                    className="bg-[#0A0A0A] border-[#262626] text-white mt-1 font-mono"
                  />
                </div>
              </>
            )}
            
            {(activeTab === 'fleet' || activeTab === 'carregamentos') && (
              <>
                <div>
                  <Label className="text-gray-400 text-xs">Motorista</Label>
                  <Input
                    value={filters.motorista}
                    onChange={(e) => setFilters({ ...filters, motorista: e.target.value })}
                    placeholder="Filtrar por motorista"
                    className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">Destino</Label>
                  <Input
                    value={filters.destino}
                    onChange={(e) => setFilters({ ...filters, destino: e.target.value })}
                    placeholder="Filtrar por destino"
                    className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  />
                </div>
              </>
            )}
            
            {activeTab === 'employees' && (
              <>
                <div>
                  <Label className="text-gray-400 text-xs">Nome</Label>
                  <Input
                    value={filters.nome}
                    onChange={(e) => setFilters({ ...filters, nome: e.target.value })}
                    placeholder="Filtrar por nome"
                    className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">Setor</Label>
                  <Input
                    value={filters.setor}
                    onChange={(e) => setFilters({ ...filters, setor: e.target.value })}
                    placeholder="Filtrar por setor"
                    className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  />
                </div>
              </>
            )}
            
            {activeTab === 'directors' && (
              <>
                <div>
                  <Label className="text-gray-400 text-xs">Nome</Label>
                  <Input
                    value={filters.nome}
                    onChange={(e) => setFilters({ ...filters, nome: e.target.value })}
                    placeholder="Filtrar por nome"
                    className="bg-[#0A0A0A] border-[#262626] text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">Placa</Label>
                  <Input
                    value={filters.placa}
                    onChange={(e) => setFilters({ ...filters, placa: e.target.value })}
                    placeholder="Filtrar por placa"
                    className="bg-[#0A0A0A] border-[#262626] text-white mt-1 font-mono"
                  />
                </div>
              </>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#262626]">
            <Button 
              onClick={loadReport}
              disabled={loading}
              className="bg-white text-black hover:bg-gray-200"
              data-testid="report-generate-button"
            >
              <MagnifyingGlass size={18} className="mr-2" />
              {loading ? 'Gerando...' : 'Gerar Relatório'}
            </Button>
            
            {data.length > 0 && (
              <>
                <Button 
                  onClick={exportPDF}
                  className="bg-red-600 text-white hover:bg-red-700"
                  data-testid="report-export-pdf"
                >
                  <FilePdf size={18} className="mr-2" />
                  Exportar PDF
                </Button>
                <Button 
                  onClick={exportExcel}
                  className="bg-green-600 text-white hover:bg-green-700"
                  data-testid="report-export-excel"
                >
                  <FileXls size={18} className="mr-2" />
                  Exportar Excel
                </Button>
                <Button 
                  onClick={handlePrint}
                  variant="outline"
                  className="border-[#262626] text-white hover:bg-[#262626]"
                  data-testid="report-print"
                >
                  <Printer size={18} className="mr-2" />
                  Imprimir
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Results */}
        {data.length > 0 && (
          <div className="card-dark mt-4">
            <div className="p-4 border-b border-[#262626] flex items-center justify-between">
              <div>
                <span className="text-white font-medium">{total}</span>
                <span className="text-gray-500 ml-1">registros encontrados</span>
              </div>
              {activeTab === 'fleet' && totalKm > 0 && (
                <div>
                  <span className="text-gray-500">Total KM: </span>
                  <span className="text-white font-mono font-medium">{totalKm} km</span>
                </div>
              )}
              {(activeTab === 'fleet' || activeTab === 'carregamentos') && (
                <div className="flex items-center gap-2 text-sm">
                  <Camera size={16} className="text-green-500" />
                  <span className="text-gray-400">
                    {data.filter(item => 
                      (item.fotos?.length > 0) || 
                      (item.fotos_saida?.length > 0) || 
                      (item.fotos_retorno?.length > 0)
                    ).length} registros com fotos
                  </span>
                </div>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#262626] hover:bg-transparent">
                    {getColumns().map((col) => (
                      <TableHead key={col} className="text-gray-400">{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.id} className="border-[#262626] hover:bg-[#1F1F1F]">
                      {getRowData(item).map((cell, cellIdx) => {
                        const isPhotoCol = getColumns()[cellIdx] === 'Fotos';
                        return (
                          <TableCell 
                            key={`${item.id}-${cellIdx}`} 
                            className={`${cellIdx === 0 ? 'text-white font-medium' : 'text-gray-400'} ${
                              (activeTab === 'fleet' && cellIdx === 0) || 
                              (activeTab === 'carregamentos' && cellIdx <= 1) ||
                              getColumns()[cellIdx] === 'Placa'
                                ? 'font-mono' : ''
                            }`}
                          >
                            {isPhotoCol && cell !== '-' ? (
                              <span className="inline-flex items-center gap-1 bg-green-900/30 text-green-400 px-2 py-1 rounded text-xs">
                                <ImageIcon size={14} />
                                {cell}
                              </span>
                            ) : cell}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="card-dark p-12 mt-4 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-400">Carregando relatório...</p>
          </div>
        )}

        {data.length === 0 && !loading && (
          <div className="card-dark p-12 mt-4 text-center">
            <FileText size={48} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-500">Selecione o período e clique em "Gerar Relatório"</p>
          </div>
        )}
      </Tabs>
    </div>
  );
};

export default Reports;
