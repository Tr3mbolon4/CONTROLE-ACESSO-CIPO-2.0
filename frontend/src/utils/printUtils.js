// Utilitário de impressão que não trava a interface
export const printDocument = (htmlContent, onComplete = null) => {
  // Criar iframe oculto para impressão
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  
  document.body.appendChild(iframe);
  
  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(htmlContent);
  iframeDoc.close();
  
  // Aguardar carregamento e imprimir
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error('Erro na impressão:', e);
      }
      
      // Remover iframe após impressão
      setTimeout(() => {
        document.body.removeChild(iframe);
        if (onComplete) onComplete();
      }, 1000);
    }, 250);
  };
};

// Template base de impressão profissional Cipolatti
export const getPrintHeader = (title) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${title} - Cipolatti</title>
  <style>
    @page { 
      margin: 15mm; 
      size: A4;
    }
    * {
      box-sizing: border-box;
    }
    body { 
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', Arial, sans-serif; 
      padding: 0; 
      margin: 0; 
      color: #1a1a1a;
      font-size: 12px;
      line-height: 1.4;
      background: #fff;
    }
    .print-container {
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 20px;
      margin-bottom: 25px;
      border-bottom: 3px solid #1a1a1a;
    }
    .logo-area {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .logo-icon {
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, #2d5a27 0%, #4a8c3f 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 20px;
    }
    .company-info {
      display: flex;
      flex-direction: column;
    }
    .company-name {
      font-size: 24px;
      font-weight: 700;
      color: #1a1a1a;
      letter-spacing: 2px;
    }
    .company-name span {
      color: #e63946;
    }
    .company-tagline {
      font-size: 10px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 2px;
    }
    .document-info {
      text-align: right;
    }
    .document-title {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 5px;
    }
    .document-date {
      font-size: 11px;
      color: #666;
    }
    .record {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 15px 18px;
      margin-bottom: 15px;
      page-break-inside: avoid;
      background: #fafafa;
    }
    .record-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      margin-bottom: 12px;
      border-bottom: 1px solid #e0e0e0;
    }
    .record-main-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .record-name {
      font-size: 15px;
      font-weight: 600;
      color: #1a1a1a;
    }
    .record-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-present {
      background: #dcfce7;
      color: #166534;
    }
    .badge-exit {
      background: #f3f4f6;
      color: #374151;
    }
    .badge-loading {
      background: #fef3c7;
      color: #92400e;
    }
    .badge-done {
      background: #dbeafe;
      color: #1e40af;
    }
    .badge-authorized {
      background: #dcfce7;
      color: #166534;
    }
    .badge-unauthorized {
      background: #fee2e2;
      color: #991b1b;
    }
    .record-date {
      font-size: 11px;
      color: #666;
    }
    .fields-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .fields-grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .field {
      min-width: 0;
    }
    .field-full {
      grid-column: span 2;
    }
    .field-label {
      font-size: 9px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
      font-weight: 500;
    }
    .field-value {
      font-size: 12px;
      color: #1a1a1a;
      word-break: break-word;
    }
    .field-value.mono {
      font-family: 'Consolas', 'Monaco', monospace;
      letter-spacing: 1px;
    }
    .field-value.highlight {
      font-weight: 600;
    }
    .photo-indicator {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px dashed #ddd;
      font-size: 11px;
      color: #666;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 2px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-info {
      font-size: 10px;
      color: #888;
    }
    .footer-system {
      font-size: 9px;
      color: #aaa;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .summary-box {
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 12px 15px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-around;
      align-items: center;
    }
    .summary-item {
      text-align: center;
    }
    .summary-value {
      font-size: 20px;
      font-weight: 700;
      color: #1a1a1a;
    }
    .summary-label {
      font-size: 9px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
<div class="print-container">
  <div class="header">
    <div class="logo-area">
      <div class="logo-icon">C</div>
      <div class="company-info">
        <div class="company-name">CIPO<span>LATTI</span></div>
        <div class="company-tagline">Sistema de Controle de Acesso</div>
      </div>
    </div>
    <div class="document-info">
      <div class="document-title">${title}</div>
      <div class="document-date">${new Date().toLocaleDateString('pt-BR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</div>
    </div>
  </div>
`;

export const getPrintFooter = () => `
  <div class="footer">
    <div class="footer-info">
      Documento gerado automaticamente pelo sistema
    </div>
    <div class="footer-system">
      Cipolatti - Controle de Acesso v1.0
    </div>
  </div>
</div>
</body>
</html>
`;

// Funções específicas para cada módulo

export const printVisitors = (visitors) => {
  const content = `
    ${getPrintHeader('Registro de Visitantes')}
    <div class="summary-box">
      <div class="summary-item">
        <div class="summary-value">${visitors.length}</div>
        <div class="summary-label">Total de Registros</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${visitors.filter(v => !v.hora_saida).length}</div>
        <div class="summary-label">Presentes</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${visitors.filter(v => v.hora_saida).length}</div>
        <div class="summary-label">Saíram</div>
      </div>
    </div>
    ${visitors.map(visitor => `
      <div class="record">
        <div class="record-header">
          <div class="record-main-info">
            <div class="record-name">${visitor.nome || '-'}</div>
            <span class="record-badge ${visitor.hora_saida ? 'badge-exit' : 'badge-present'}">
              ${visitor.hora_saida ? 'SAIU' : 'PRESENTE'}
            </span>
          </div>
          <div class="record-date">${visitor.data || '-'}</div>
        </div>
        <div class="fields-grid">
          <div class="field">
            <div class="field-label">Entrada</div>
            <div class="field-value mono">${visitor.hora_entrada || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Saída</div>
            <div class="field-value mono">${visitor.hora_saida || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Placa</div>
            <div class="field-value mono">${visitor.placa || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Veículo</div>
            <div class="field-value">${visitor.veiculo || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Porteiro</div>
            <div class="field-value">${visitor.porteiro || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Observação</div>
            <div class="field-value">${visitor.observacao || '-'}</div>
          </div>
        </div>
      </div>
    `).join('')}
    ${getPrintFooter()}
  `;
  printDocument(content);
};

export const printEmployees = (employees) => {
  const content = `
    ${getPrintHeader('Registro de Funcionários')}
    <div class="summary-box">
      <div class="summary-item">
        <div class="summary-value">${employees.length}</div>
        <div class="summary-label">Total de Registros</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${employees.filter(e => e.autorizado).length}</div>
        <div class="summary-label">Autorizados</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${employees.filter(e => !e.hora_saida).length}</div>
        <div class="summary-label">Presentes</div>
      </div>
    </div>
    ${employees.map(employee => `
      <div class="record">
        <div class="record-header">
          <div class="record-main-info">
            <div class="record-name">${employee.nome || '-'}</div>
            <span class="record-badge ${employee.autorizado ? 'badge-authorized' : 'badge-unauthorized'}">
              ${employee.autorizado ? '✓ AUTORIZADO' : '✗ NÃO AUTORIZADO'}
            </span>
          </div>
          <div class="record-date">${employee.data || '-'}</div>
        </div>
        <div class="fields-grid">
          <div class="field">
            <div class="field-label">Setor</div>
            <div class="field-value highlight">${employee.setor || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Entrada</div>
            <div class="field-value mono">${employee.hora_entrada || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Saída</div>
            <div class="field-value mono">${employee.hora_saida || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Responsável</div>
            <div class="field-value">${employee.responsavel || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Placa</div>
            <div class="field-value mono">${employee.placa || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Porteiro</div>
            <div class="field-value">${employee.porteiro || '-'}</div>
          </div>
          ${employee.observacao ? `
            <div class="field field-full">
              <div class="field-label">Observação</div>
              <div class="field-value">${employee.observacao}</div>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('')}
    ${getPrintFooter()}
  `;
  printDocument(content);
};

export const printDirectors = (directors) => {
  const content = `
    ${getPrintHeader('Registro de Diretoria')}
    <div class="summary-box">
      <div class="summary-item">
        <div class="summary-value">${directors.length}</div>
        <div class="summary-label">Total de Registros</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${directors.filter(d => !d.hora_saida).length}</div>
        <div class="summary-label">Presentes</div>
      </div>
    </div>
    ${directors.map(director => `
      <div class="record">
        <div class="record-header">
          <div class="record-main-info">
            <div class="record-name">${director.nome || '-'}</div>
            <span class="record-badge ${director.hora_saida ? 'badge-exit' : director.hora_saida_almoco && !director.hora_retorno_almoco ? 'badge-loading' : 'badge-present'}">
              ${director.hora_saida ? 'SAIU' : director.hora_saida_almoco && !director.hora_retorno_almoco ? 'ALMOÇO' : 'PRESENTE'}
            </span>
          </div>
          <div class="record-date">${director.data || '-'}</div>
        </div>
        <div class="fields-grid">
          <div class="field">
            <div class="field-label">Entrada</div>
            <div class="field-value mono">${director.hora_entrada || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Saída Almoço</div>
            <div class="field-value mono">${director.hora_saida_almoco || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Retorno Almoço</div>
            <div class="field-value mono">${director.hora_retorno_almoco || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Saída</div>
            <div class="field-value mono">${director.hora_saida || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Placa</div>
            <div class="field-value mono">${director.placa || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Carro</div>
            <div class="field-value">${director.carro || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Porteiro</div>
            <div class="field-value">${director.porteiro || '-'}</div>
          </div>
          ${director.observacao ? `
            <div class="field field-full">
              <div class="field-label">Observação</div>
              <div class="field-value">${director.observacao}</div>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('')}
    ${getPrintFooter()}
  `;
  printDocument(content);
};

export const printFleet = (fleet) => {
  const content = `
    ${getPrintHeader('Registro de Frota')}
    <div class="summary-box">
      <div class="summary-item">
        <div class="summary-value">${fleet.length}</div>
        <div class="summary-label">Total de Registros</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${fleet.filter(f => f.status === 'em_uso').length}</div>
        <div class="summary-label">Em Uso</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${fleet.filter(f => f.status === 'retornado').length}</div>
        <div class="summary-label">Retornados</div>
      </div>
    </div>
    ${fleet.map(item => `
      <div class="record">
        <div class="record-header">
          <div class="record-main-info">
            <div class="record-name">${item.placa || '-'} - ${item.carro || '-'}</div>
            <span class="record-badge ${item.status === 'em_uso' ? 'badge-loading' : 'badge-done'}">
              ${item.status === 'em_uso' ? 'EM USO' : 'RETORNADO'}
            </span>
          </div>
          <div class="record-date">${item.data_saida || '-'}</div>
        </div>
        <div class="fields-grid-4">
          <div class="field">
            <div class="field-label">Motorista</div>
            <div class="field-value highlight">${item.motorista || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Destino</div>
            <div class="field-value">${item.destino || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Saída</div>
            <div class="field-value mono">${item.hora_saida || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Retorno</div>
            <div class="field-value mono">${item.hora_retorno || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">KM Saída</div>
            <div class="field-value mono">${item.km_saida ? item.km_saida.toLocaleString() : '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">KM Retorno</div>
            <div class="field-value mono">${item.km_retorno ? item.km_retorno.toLocaleString() : '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">KM Rodado</div>
            <div class="field-value mono highlight">${item.km_rodado ? item.km_rodado.toLocaleString() + ' km' : '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Porteiro</div>
            <div class="field-value">${item.porteiro_saida || '-'}</div>
          </div>
          ${item.observacao ? `
            <div class="field" style="grid-column: span 4;">
              <div class="field-label">Observação</div>
              <div class="field-value">${item.observacao}</div>
            </div>
          ` : ''}
        </div>
        ${(item.fotos_saida?.length > 0 || item.fotos_retorno?.length > 0) ? `
          <div class="photo-indicator">
            📷 ${(item.fotos_saida?.length || 0) + (item.fotos_retorno?.length || 0)} foto(s) vinculada(s)
          </div>
        ` : ''}
      </div>
    `).join('')}
    ${getPrintFooter()}
  `;
  printDocument(content);
};

export const printCarregamentos = (carregamentos) => {
  const content = `
    ${getPrintHeader('Registro de Carregamentos')}
    <div class="summary-box">
      <div class="summary-item">
        <div class="summary-value">${carregamentos.length}</div>
        <div class="summary-label">Total de Registros</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${carregamentos.filter(c => c.status === 'em_carregamento').length}</div>
        <div class="summary-label">Em Carregamento</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${carregamentos.filter(c => c.status === 'finalizado').length}</div>
        <div class="summary-label">Finalizados</div>
      </div>
    </div>
    ${carregamentos.map(item => `
      <div class="record">
        <div class="record-header">
          <div class="record-main-info">
            <div class="record-name">${item.placa_carreta || '-'} / ${item.placa_cavalo || '-'}</div>
            <span class="record-badge ${item.status === 'em_carregamento' ? 'badge-loading' : 'badge-done'}">
              ${item.status === 'em_carregamento' ? 'EM CARREGAMENTO' : 'FINALIZADO'}
            </span>
          </div>
          <div class="record-date">${item.data || '-'}</div>
        </div>
        <div class="fields-grid-4">
          <div class="field">
            <div class="field-label">Motorista</div>
            <div class="field-value highlight">${item.motorista || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Empresa</div>
            <div class="field-value">${item.empresa_terceirizada || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Destino</div>
            <div class="field-value">${item.destino || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Cubagem</div>
            <div class="field-value">${item.cubagem || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Entrada</div>
            <div class="field-value mono">${item.hora_entrada || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Saída</div>
            <div class="field-value mono">${item.hora_saida || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Porteiro Entrada</div>
            <div class="field-value">${item.porteiro_entrada || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Porteiro Saída</div>
            <div class="field-value">${item.porteiro_saida || '-'}</div>
          </div>
          ${item.observacao ? `
            <div class="field" style="grid-column: span 4;">
              <div class="field-label">Observação</div>
              <div class="field-value">${item.observacao}</div>
            </div>
          ` : ''}
        </div>
        ${item.fotos?.length > 0 ? `
          <div class="photo-indicator">
            📷 ${item.fotos.length} foto(s) vinculada(s)
          </div>
        ` : ''}
      </div>
    `).join('')}
    ${getPrintFooter()}
  `;
  printDocument(content);
};

export default printDocument;
