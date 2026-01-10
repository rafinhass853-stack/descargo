// Abastecimento.jsx - VERSÃO AJUSTADA PARA SUA ESTRUTURA DO FIREBASE
import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, query, onSnapshot, doc, updateDoc, where, 
  getDocs, addDoc, serverTimestamp, orderBy, deleteDoc 
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { 
  Fuel, Filter, Plus, Search, Trash2, Edit, Eye, 
  Truck, User, MapPin, Calendar, DollarSign, Droplets, 
  ChevronDown, ChevronUp, RefreshCw, FileText 
} from 'lucide-react';

const Abastecimento = () => {
  const [abastecimentos, setAbastecimentos] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    motorista: 'TODOS',
    combustivel: 'TODOS',
    dataInicio: '',
    dataFim: '',
    posto: ''
  });
  const [modalAberto, setModalAberto] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(null);
  const [modalEditar, setModalEditar] = useState(null);
  const [busca, setBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState({ campo: 'data', direcao: 'desc' });
  const [totalLitros, setTotalLitros] = useState(0);
  const [totalValor, setTotalValor] = useState(0);
  const [mediaPrecoLitro, setMediaPrecoLitro] = useState(0);
  
  const [form, setForm] = useState({
    motoristaId: '',
    motoristaNome: '',
    combustivel: 'DIESEL',
    arla: false,
    litros: '',
    valorTotal: '',
    precoLitro: '',
    hodometro: '',
    posto: '',
    cidade: '',
    estado: 'SP',
    observacoes: '',
    data: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    carregarMotoristas();
    carregarAbastecimentos();
  }, []);

  const carregarMotoristas = async () => {
    try {
      const q = query(collection(db, "cadastro_motoristas"));
      const snapshot = await getDocs(q);
      const lista = [];
      snapshot.forEach(doc => {
        lista.push({ id: doc.id, ...doc.data() });
      });
      setMotoristas(lista);
    } catch (error) {
      console.error("Erro ao carregar motoristas:", error);
    }
  };

  const carregarAbastecimentos = () => {
    setLoading(true);
    try {
      // Ajuste: Use o campo que você tem no Firestore para ordenação
      // Se tiver 'timestamp', use ele. Se não, use 'criadoEm' ou outro campo de data
      const q = query(collection(db, "abastecimentos"), orderBy("timestamp", "desc"));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const lista = [];
        let totalL = 0;
        let totalV = 0;
        let count = 0;
        
        snapshot.forEach(doc => {
          const data = doc.data();
          
          // MAPEAMENTO DOS CAMPOS DO SEU FIREBASE
          const abastecimentoMapeado = {
            id: doc.id,
            
            // Campos da sua estrutura atual do Firebase (pela imagem)
            motoristaId: data.motoristaid || '',
            motoristaNome: data.motoristaiome || data.motoristaNome || 'Não informado',
            motoristaPlaca: data.placa || data.motoristaPlaca || 'Não informada',
            posto: data.posto || '',
            status: data.status || '',
            observacoes: data.observacoes || '',
            localizacao: data.localizacao || {},
            
            // Campos que seu código espera mas podem não existir ainda
            combustivel: data.combustivel || 'DIESEL',
            arla: data.arla || false,
            litros: parseFloat(data.litros) || 0,
            valorTotal: parseFloat(data.valorTotal) || 0,
            precoLitro: parseFloat(data.precoLitro) || 0,
            hodometro: data.hodometro || null,
            cidade: data.cidade || '',
            estado: data.estado || 'SP',
            
            // Tratamento da data/timestamp
            data: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp)) : 
                  data.data ? (data.data.toDate ? data.data.toDate() : new Date(data.data)) : new Date(),
            
            // Campos de sistema
            criadoPor: data.criadoPor || auth.currentUser?.email || 'Sistema',
            criadoEm: data.criadoEm || new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
          };
          
          lista.push(abastecimentoMapeado);
          
          if (abastecimentoMapeado.litros) {
            totalL += parseFloat(abastecimentoMapeado.litros);
          }
          if (abastecimentoMapeado.valorTotal) {
            totalV += parseFloat(abastecimentoMapeado.valorTotal);
          }
          if (abastecimentoMapeado.litros && abastecimentoMapeado.valorTotal) {
            count++;
          }
        });
        
        setAbastecimentos(lista);
        setTotalLitros(totalL);
        setTotalValor(totalV);
        setMediaPrecoLitro(count > 0 ? totalV / totalL : 0);
        setLoading(false);
      });
      
      return unsubscribe;
    } catch (error) {
      console.error("Erro ao carregar abastecimentos:", error);
      setLoading(false);
    }
  };

  const calcularPrecoLitro = () => {
    if (form.litros && form.valorTotal) {
      const litros = parseFloat(form.litros.replace(',', '.'));
      const valor = parseFloat(form.valorTotal.replace(',', '.'));
      if (litros > 0) {
        const preco = valor / litros;
        setForm({ ...form, precoLitro: preco.toFixed(3).replace('.', ',') });
      }
    }
  };

  const salvarAbastecimento = async (e) => {
    if (e) e.preventDefault();
    
    if (!form.motoristaId) {
      alert("Selecione um motorista");
      return;
    }
    if (!form.litros || parseFloat(form.litros.replace(',', '.')) <= 0) {
      alert("Informe a quantidade de litros");
      return;
    }
    if (!form.valorTotal || parseFloat(form.valorTotal.replace(',', '.')) <= 0) {
      alert("Informe o valor total");
      return;
    }
    if (!form.posto) {
      alert("Informe o nome do posto");
      return;
    }
    if (!form.cidade) {
      alert("Informe a cidade");
      return;
    }

    try {
      const motorista = motoristas.find(m => m.id === form.motoristaId);
      
      // ESTRUTURA DE DADOS PARA SALVAR NO SEU FIREBASE
      const abastecimentoData = {
        // Campos principais do seu sistema
        motoristaid: form.motoristaId,
        motoristaiome: motorista?.nome || form.motoristaNome || 'Não informado',
        motoristaNome: motorista?.nome || form.motoristaNome || 'Não informado', // Duplicado para compatibilidade
        placa: motorista?.placa || 'Não informada',
        motoristaPlaca: motorista?.placa || 'Não informada', // Duplicado para compatibilidade
        motoristaTelefone: motorista?.telefone || '',
        
        // Informações do abastecimento
        combustivel: form.combustivel,
        arla: form.combustivel === 'DIESEL' ? form.arla : false,
        litros: parseFloat(form.litros.replace(',', '.')),
        valorTotal: parseFloat(form.valorTotal.replace(',', '.')),
        precoLitro: parseFloat(form.precoLitro.replace(',', '.')),
        hodometro: form.hodometro ? parseInt(form.hodometro) : null,
        posto: form.posto,
        cidade: form.cidade,
        estado: form.estado || 'SP',
        observacoes: form.observacoes,
        status: 'REGISTRADO', // Status padrão da sua estrutura
        
        // Localização (pode ser preenchida posteriormente)
        localizacao: {
          latitude: null,
          longitude: null
        },
        
        // Datas
        data: new Date(form.data + 'T12:00:00'),
        timestamp: serverTimestamp(), // Usando serverTimestamp do Firebase
        
        // Informações de sistema
        criadoPor: auth.currentUser?.email || 'Sistema',
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      };

      if (modalEditar) {
        await updateDoc(doc(db, "abastecimentos", modalEditar.id), abastecimentoData);
        alert("✅ Abastecimento atualizado com sucesso!");
        setModalEditar(null);
      } else {
        await addDoc(collection(db, "abastecimentos"), abastecimentoData);
        alert("✅ Abastecimento registrado com sucesso!");
      }

      limparFormulario();
      setModalAberto(false);
    } catch (error) {
      console.error("Erro ao salvar abastecimento:", error);
      alert("❌ Erro ao salvar abastecimento: " + error.message);
    }
  };

  const editarAbastecimento = (abastecimento) => {
    setForm({
      motoristaId: abastecimento.motoristaId,
      motoristaNome: abastecimento.motoristaNome,
      combustivel: abastecimento.combustivel,
      arla: abastecimento.arla || false,
      litros: abastecimento.litros?.toString() || '',
      valorTotal: abastecimento.valorTotal?.toString() || '',
      precoLitro: abastecimento.precoLitro?.toString() || '',
      hodometro: abastecimento.hodometro?.toString() || '',
      posto: abastecimento.posto,
      cidade: abastecimento.cidade,
      estado: abastecimento.estado || 'SP',
      observacoes: abastecimento.observacoes || '',
      data: abastecimento.data?.toDate ? 
            abastecimento.data.toDate().toISOString().split('T')[0] : 
            new Date(abastecimento.data).toISOString().split('T')[0]
    });
    setModalEditar(abastecimento);
    setModalAberto(true);
  };

  const excluirAbastecimento = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este abastecimento?")) return;
    
    try {
      await deleteDoc(doc(db, "abastecimentos", id));
      alert("✅ Abastecimento excluído com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir abastecimento:", error);
      alert("❌ Erro ao excluir abastecimento");
    }
  };

  const limparFormulario = () => {
    setForm({
      motoristaId: '',
      motoristaNome: '',
      combustivel: 'DIESEL',
      arla: false,
      litros: '',
      valorTotal: '',
      precoLitro: '',
      hodometro: '',
      posto: '',
      cidade: '',
      estado: 'SP',
      observacoes: '',
      data: new Date().toISOString().split('T')[0]
    });
    setModalEditar(null);
  };

  const limparFiltros = () => {
    setFiltros({
      motorista: 'TODOS',
      combustivel: 'TODOS',
      dataInicio: '',
      dataFim: '',
      posto: ''
    });
    setBusca('');
  };

  const formatarData = (data) => {
    if (!data) return '--/--/--';
    try {
      const date = data.toDate ? data.toDate() : new Date(data);
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth()+1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    } catch {
      return '--/--/--';
    }
  };

  const formatarValor = (valor) => {
    return parseFloat(valor || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const abastecimentosFiltrados = useMemo(() => {
    let filtrados = [...abastecimentos];

    if (filtros.motorista !== 'TODOS') {
      filtrados = filtrados.filter(item => item.motoristaId === filtros.motorista);
    }

    if (filtros.combustivel !== 'TODOS') {
      filtrados = filtrados.filter(item => item.combustivel === filtros.combustivel);
    }

    if (filtros.dataInicio) {
      const dataInicio = new Date(filtros.dataInicio);
      filtrados = filtrados.filter(item => {
        const itemData = item.data?.toDate ? item.data.toDate() : new Date(item.data);
        return itemData >= dataInicio;
      });
    }

    if (filtros.dataFim) {
      const dataFim = new Date(filtros.dataFim);
      dataFim.setHours(23, 59, 59, 999);
      filtrados = filtrados.filter(item => {
        const itemData = item.data?.toDate ? item.data.toDate() : new Date(item.data);
        return itemData <= dataFim;
      });
    }

    if (filtros.posto) {
      filtrados = filtrados.filter(item => 
        item.posto.toLowerCase().includes(filtros.posto.toLowerCase())
      );
    }

    if (busca) {
      filtrados = filtrados.filter(item => 
        item.motoristaNome.toLowerCase().includes(busca.toLowerCase()) ||
        item.posto.toLowerCase().includes(busca.toLowerCase()) ||
        item.cidade.toLowerCase().includes(busca.toLowerCase()) ||
        item.observacoes?.toLowerCase().includes(busca.toLowerCase())
      );
    }

    filtrados.sort((a, b) => {
      let valorA, valorB;
      
      if (ordenacao.campo === 'data') {
        valorA = a.data?.toDate ? a.data.toDate() : new Date(a.data);
        valorB = b.data?.toDate ? b.data.toDate() : new Date(b.data);
      } else if (ordenacao.campo === 'valorTotal') {
        valorA = parseFloat(a.valorTotal || 0);
        valorB = parseFloat(b.valorTotal || 0);
      } else if (ordenacao.campo === 'litros') {
        valorA = parseFloat(a.litros || 0);
        valorB = parseFloat(b.litros || 0);
      } else if (ordenacao.campo === 'precoLitro') {
        valorA = parseFloat(a.precoLitro || 0);
        valorB = parseFloat(b.precoLitro || 0);
      } else {
        valorA = a[ordenacao.campo] || '';
        valorB = b[ordenacao.campo] || '';
      }
      
      if (ordenacao.direcao === 'asc') {
        return valorA > valorB ? 1 : -1;
      } else {
        return valorA < valorB ? 1 : -1;
      }
    });

    return filtrados;
  }, [abastecimentos, filtros, busca, ordenacao]);

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <Fuel size={24} color="#FFD700" />
          <h1 style={styles.titulo}>Controle de Abastecimentos</h1>
        </div>
        
        <div style={styles.acoes}>
          <button 
            onClick={() => setModalAberto(true)}
            style={styles.btnNovo}
          >
            <Plus size={16} /> Novo Abastecimento
          </button>
          
          <button 
            onClick={carregarAbastecimentos}
            style={styles.btnRecarregar}
            title="Recarregar dados"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* RESUMO */}
      <div style={styles.resumo}>
        <div style={styles.resumoItem}>
          <div style={styles.resumoIcon}>
            <Droplets size={20} />
          </div>
          <div>
            <div style={styles.resumoLabel}>Total Litros</div>
            <div style={styles.resumoValor}>{totalLitros.toFixed(1)} L</div>
          </div>
        </div>
        
        <div style={styles.resumoItem}>
          <div style={styles.resumoIcon}>
            <DollarSign size={20} />
          </div>
          <div>
            <div style={styles.resumoLabel}>Total Gasto</div>
            <div style={styles.resumoValor}>{formatarValor(totalValor)}</div>
          </div>
        </div>
        
        <div style={styles.resumoItem}>
          <div style={styles.resumoIcon}>
            <Fuel size={20} />
          </div>
          <div>
            <div style={styles.resumoLabel}>Média Preço/Litro</div>
            <div style={styles.resumoValor}>{formatarValor(mediaPrecoLitro)}</div>
          </div>
        </div>
        
        <div style={styles.resumoItem}>
          <div style={styles.resumoIcon}>
            <FileText size={20} />
          </div>
          <div>
            <div style={styles.resumoLabel}>Registros</div>
            <div style={styles.resumoValor}>{abastecimentos.length}</div>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div style={styles.filtrosContainer}>
        <div style={styles.filtrosLeft}>
          <div style={styles.buscaContainer}>
            <Search size={16} style={styles.buscaIcon} />
            <input
              type="text"
              placeholder="Buscar por motorista, posto, cidade..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={styles.buscaInput}
            />
          </div>
          
          <div style={styles.filtrosRapidos}>
            <select
              value={filtros.motorista}
              onChange={(e) => setFiltros({...filtros, motorista: e.target.value})}
              style={styles.selectFiltro}
            >
              <option value="TODOS">Todos os Motoristas</option>
              {motoristas.map(motorista => (
                <option key={motorista.id} value={motorista.id}>
                  {motorista.nome || motorista.motoristaiome || 'Sem nome'} 
                  {motorista.placa ? ` (${motorista.placa})` : ''}
                </option>
              ))}
            </select>
            
            <select
              value={filtros.combustivel}
              onChange={(e) => setFiltros({...filtros, combustivel: e.target.value})}
              style={styles.selectFiltro}
            >
              <option value="TODOS">Todos os Combustíveis</option>
              <option value="DIESEL">Diesel</option>
              <option value="GASOLINA">Gasolina</option>
              <option value="ETANOL">Etanol</option>
              <option value="ARLA">ARLA</option>
            </select>
            
            <input
              type="date"
              placeholder="Data inicial"
              value={filtros.dataInicio}
              onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})}
              style={styles.inputData}
            />
            
            <input
              type="date"
              placeholder="Data final"
              value={filtros.dataFim}
              onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})}
              style={styles.inputData}
            />
            
            <input
              type="text"
              placeholder="Filtrar por posto"
              value={filtros.posto}
              onChange={(e) => setFiltros({...filtros, posto: e.target.value})}
              style={styles.inputPosto}
            />
          </div>
        </div>
        
        <div style={styles.filtrosRight}>
          <button 
            onClick={limparFiltros}
            style={styles.btnLimpar}
            title="Limpar todos os filtros"
          >
            <Filter size={16} /> Limpar Filtros
          </button>
        </div>
      </div>

      {/* TABELA */}
      <div style={styles.tabelaContainer}>
        {loading ? (
          <div style={styles.loading}>
            <div style={{color: '#666'}}>Carregando abastecimentos...</div>
          </div>
        ) : abastecimentosFiltrados.length === 0 ? (
          <div style={styles.vazio}>
            <Fuel size={50} style={{color: '#333'}} />
            <div style={{marginTop: '20px', color: '#666', fontSize: '16px'}}>
              Nenhum abastecimento encontrado
            </div>
            <button 
              onClick={() => setModalAberto(true)}
              style={{...styles.btnNovo, marginTop: '20px'}}
            >
              <Plus size={16} /> Cadastrar Primeiro Abastecimento
            </button>
          </div>
        ) : (
          <table style={styles.tabela}>
            <thead>
              <tr>
                <th style={styles.th}>
                  <div style={styles.thContent}>
                    Data
                    <button 
                      onClick={() => setOrdenacao({campo: 'data', direcao: ordenacao.direcao === 'asc' ? 'desc' : 'asc'})}
                      style={styles.btnOrdenar}
                    >
                      {ordenacao.campo === 'data' && ordenacao.direcao === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </th>
                <th style={styles.th}>Motorista</th>
                <th style={styles.th}>Combustível</th>
                <th style={styles.th}>
                  <div style={styles.thContent}>
                    Litros
                    <button 
                      onClick={() => setOrdenacao({campo: 'litros', direcao: ordenacao.direcao === 'asc' ? 'desc' : 'asc'})}
                      style={styles.btnOrdenar}
                    >
                      {ordenacao.campo === 'litros' && ordenacao.direcao === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </th>
                <th style={styles.th}>
                  <div style={styles.thContent}>
                    Valor Total
                    <button 
                      onClick={() => setOrdenacao({campo: 'valorTotal', direcao: ordenacao.direcao === 'asc' ? 'desc' : 'asc'})}
                      style={styles.btnOrdenar}
                    >
                      {ordenacao.campo === 'valorTotal' && ordenacao.direcao === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </th>
                <th style={styles.th}>Local</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {abastecimentosFiltrados.map(item => (
                <tr key={item.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.dataCell}>
                      <Calendar size={12} style={{marginRight: '5px', color: '#666'}} />
                      {formatarData(item.data)}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.motoristaCell}>
                      <User size={12} style={{marginRight: '5px', color: '#666'}} />
                      <div>
                        <div style={{fontWeight: '500'}}>{item.motoristaNome}</div>
                        <div style={{fontSize: '11px', color: '#888'}}>
                          {item.motoristaPlaca || 'Sem placa'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      backgroundColor: item.combustivel === 'DIESEL' ? 'rgba(255, 215, 0, 0.2)' : 'rgba(52, 152, 219, 0.2)',
                      color: item.combustivel === 'DIESEL' ? '#FFD700' : '#3498db',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {item.combustivel}
                      {item.arla && ' + ARLA'}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{fontWeight: 'bold', color: '#FFD700'}}>
                      {parseFloat(item.litros || 0).toFixed(1)} L
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{fontWeight: 'bold'}}>
                      {formatarValor(item.valorTotal)}
                    </div>
                    <div style={{fontSize: '11px', color: '#888'}}>
                      {formatarValor(item.precoLitro)}/L
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.localCell}>
                      <MapPin size={12} style={{marginRight: '5px', color: '#666'}} />
                      <div>
                        <div>{item.posto}</div>
                        <div style={{fontSize: '11px', color: '#888'}}>
                          {item.cidade}
                          {item.estado ? `/${item.estado}` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      backgroundColor: item.status === 'REGISTRADO' ? 'rgba(46, 204, 113, 0.2)' : 'rgba(155, 89, 182, 0.2)',
                      color: item.status === 'REGISTRADO' ? '#2ecc71' : '#9b59b6',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}>
                      {item.status || 'PENDENTE'}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.acoesCell}>
                      <button 
                        onClick={() => setModalDetalhes(item)}
                        style={styles.btnAcao}
                        title="Ver detalhes"
                      >
                        <Eye size={14} />
                      </button>
                      
                      <button 
                        onClick={() => editarAbastecimento(item)}
                        style={styles.btnAcao}
                        title="Editar"
                      >
                        <Edit size={14} />
                      </button>
                      
                      <button 
                        onClick={() => excluirAbastecimento(item.id)}
                        style={{...styles.btnAcao, color: '#e74c3c'}}
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        
        {!loading && abastecimentosFiltrados.length > 0 && (
          <div style={styles.tabelaFooter}>
            <div style={{color: '#888', fontSize: '12px'}}>
              Mostrando {abastecimentosFiltrados.length} de {abastecimentos.length} registros
            </div>
            <div style={{color: '#FFD700', fontSize: '12px', fontWeight: 'bold'}}>
              Total filtrado: {formatarValor(abastecimentosFiltrados.reduce((acc, item) => acc + parseFloat(item.valorTotal || 0), 0))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL NOVO/EDITAR */}
      {modalAberto && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalGrande}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {modalEditar ? 'Editar Abastecimento' : 'Novo Abastecimento'}
              </h3>
              <button onClick={() => { setModalAberto(false); limparFormulario(); }} style={styles.btnFechar}>×</button>
            </div>
            
            <form onSubmit={salvarAbastecimento}>
              <div style={styles.modalBody}>
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Motorista *</label>
                    <select
                      value={form.motoristaId}
                      onChange={(e) => {
                        const motorista = motoristas.find(m => m.id === e.target.value);
                        setForm({
                          ...form, 
                          motoristaId: e.target.value,
                          motoristaNome: motorista?.nome || motorista?.motoristaiome || ''
                        });
                      }}
                      style={styles.formSelect}
                      required
                    >
                      <option value="">Selecione um motorista</option>
                      {motoristas.map(motorista => (
                        <option key={motorista.id} value={motorista.id}>
                          {motorista.nome || motorista.motoristaiome || 'Sem nome'} 
                          {motorista.placa ? ` (${motorista.placa})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Data *</label>
                    <input
                      type="date"
                      value={form.data}
                      onChange={(e) => setForm({...form, data: e.target.value})}
                      style={styles.formInput}
                      required
                    />
                  </div>
                  
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Combustível *</label>
                    <select
                      value={form.combustivel}
                      onChange={(e) => setForm({...form, combustivel: e.target.value})}
                      style={styles.formSelect}
                    >
                      <option value="DIESEL">Diesel</option>
                      <option value="GASOLINA">Gasolina</option>
                      <option value="ETANOL">Etanol</option>
                      <option value="GNV">GNV</option>
                    </select>
                    
                    {form.combustivel === 'DIESEL' && (
                      <div style={{marginTop: '10px'}}>
                        <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                          <input
                            type="checkbox"
                            checked={form.arla}
                            onChange={(e) => setForm({...form, arla: e.target.checked})}
                            style={{marginRight: '8px'}}
                          />
                          <span style={{color: '#AAA', fontSize: '14px'}}>Adicionou ARLA 32?</span>
                        </label>
                      </div>
                    )}
                  </div>
                  
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Litros *</label>
                    <input
                      type="text"
                      placeholder="Ex: 100,50"
                      value={form.litros}
                      onChange={(e) => {
                        setForm({...form, litros: e.target.value});
                        setTimeout(calcularPrecoLitro, 100);
                      }}
                      style={styles.formInput}
                      required
                    />
                  </div>
                  
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Valor Total (R$) *</label>
                    <input
                      type="text"
                      placeholder="Ex: 550,75"
                      value={form.valorTotal}
                      onChange={(e) => {
                        setForm({...form, valorTotal: e.target.value});
                        setTimeout(calcularPrecoLitro, 100);
                      }}
                      style={styles.formInput}
                      required
                    />
                  </div>
                  
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Preço por Litro</label>
                    <input
                      type="text"
                      value={form.precoLitro}
                      readOnly
                      style={{...styles.formInput, backgroundColor: '#222', color: '#888'}}
                      placeholder="Calculado automaticamente"
                    />
                  </div>
                  
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Posto/Fornecedor *</label>
                    <input
                      type="text"
                      placeholder="Nome do posto"
                      value={form.posto}
                      onChange={(e) => setForm({...form, posto: e.target.value})}
                      style={styles.formInput}
                      required
                    />
                  </div>
                  
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Cidade *</label>
                    <input
                      type="text"
                      placeholder="Cidade"
                      value={form.cidade}
                      onChange={(e) => setForm({...form, cidade: e.target.value})}
                      style={styles.formInput}
                      required
                    />
                  </div>
                  
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>UF</label>
                    <input
                      type="text"
                      placeholder="SP"
                      value={form.estado}
                      onChange={(e) => setForm({...form, estado: e.target.value.toUpperCase()})}
                      style={styles.formInput}
                      maxLength={2}
                    />
                  </div>
                  
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Hodômetro (KM)</label>
                    <input
                      type="number"
                      placeholder="KM atual"
                      value={form.hodometro}
                      onChange={(e) => setForm({...form, hodometro: e.target.value})}
                      style={styles.formInput}
                    />
                  </div>
                </div>
                
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Observações</label>
                  <textarea
                    placeholder="Observações adicionais"
                    value={form.observacoes}
                    onChange={(e) => setForm({...form, observacoes: e.target.value})}
                    style={{...styles.formInput, minHeight: '80px', resize: 'vertical'}}
                    rows={3}
                  />
                </div>
              </div>
              
              <div style={styles.modalFooter}>
                <button 
                  type="button"
                  onClick={() => { setModalAberto(false); limparFormulario(); }}
                  style={styles.btnSecundario}
                >
                  Cancelar
                </button>
                
                <button 
                  type="submit"
                  style={styles.btnPrimario}
                >
                  {modalEditar ? 'Atualizar' : 'Salvar'} Abastecimento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALHES */}
      {modalDetalhes && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Detalhes do Abastecimento</h3>
              <button onClick={() => setModalDetalhes(null)} style={styles.btnFechar}>×</button>
            </div>
            
            <div style={styles.detalhesGrid}>
              <div style={styles.detalhesCol}>
                <h4 style={styles.detalhesSubtitle}>Motorista</h4>
                <div style={styles.detalhesItem}>
                  <span style={styles.detalhesLabel}>Nome:</span>
                  <span style={styles.detalhesValor}>{modalDetalhes.motoristaNome}</span>
                </div>
                <div style={styles.detalhesItem}>
                  <span style={styles.detalhesLabel}>Placa:</span>
                  <span style={styles.detalhesValor}>{modalDetalhes.motoristaPlaca || 'Não informada'}</span>
                </div>
                <div style={styles.detalhesItem}>
                  <span style={styles.detalhesLabel}>ID:</span>
                  <span style={styles.detalhesValor}>{modalDetalhes.motoristaId}</span>
                </div>
              </div>
              
              <div style={styles.detalhesCol}>
                <h4 style={styles.detalhesSubtitle}>Abastecimento</h4>
                <div style={styles.detalhesItem}>
                  <span style={styles.detalhesLabel}>Combustível:</span>
                  <span style={styles.detalhesValor}>
                    {modalDetalhes.combustivel}
                    {modalDetalhes.arla && ' + ARLA 32'}
                  </span>
                </div>
                <div style={styles.detalhesItem}>
                  <span style={styles.detalhesLabel}>Litros:</span>
                  <span style={styles.detalhesValor}>{parseFloat(modalDetalhes.litros || 0).toFixed(1)} L</span>
                </div>
                <div style={styles.detalhesItem}>
                  <span style={styles.detalhesLabel}>Valor:</span>
                  <span style={styles.detalhesValor}>{formatarValor(modalDetalhes.valorTotal)}</span>
                </div>
                <div style={styles.detalhesItem}>
                  <span style={styles.detalhesLabel}>Preço/L:</span>
                  <span style={styles.detalhesValor}>{formatarValor(modalDetalhes.precoLitro)}</span>
                </div>
              </div>
              
              <div style={styles.detalhesCol}>
                <h4 style={styles.detalhesSubtitle}>Localização</h4>
                <div style={styles.detalhesItem}>
                  <span style={styles.detalhesLabel}>Posto:</span>
                  <span style={styles.detalhesValor}>{modalDetalhes.posto}</span>
                </div>
                <div style={styles.detalhesItem}>
                  <span style={styles.detalhesLabel}>Cidade/UF:</span>
                  <span style={styles.detalhesValor}>
                    {modalDetalhes.cidade}
                    {modalDetalhes.estado ? `/${modalDetalhes.estado}` : ''}
                  </span>
                </div>
                <div style={styles.detalhesItem}>
                  <span style={styles.detalhesLabel}>Data:</span>
                  <span style={styles.detalhesValor}>{formatarData(modalDetalhes.data)}</span>
                </div>
                <div style={styles.detalhesItem}>
                  <span style={styles.detalhesLabel}>Status:</span>
                  <span style={styles.detalhesValor}>{modalDetalhes.status || 'PENDENTE'}</span>
                </div>
              </div>
            </div>
            
            {modalDetalhes.localizacao && (modalDetalhes.localizacao.latitude || modalDetalhes.localizacao.longitude) && (
              <div style={{padding: '0 20px', marginBottom: '20px'}}>
                <h4 style={styles.detalhesSubtitle}>Coordenadas GPS</h4>
                <div style={{backgroundColor: '#0A0A0A', padding: '15px', borderRadius: '8px', border: '1px solid #222'}}>
                  <div style={{display: 'flex', gap: '20px', color: '#CCC', fontSize: '14px'}}>
                    <div>
                      <span style={{color: '#888'}}>Latitude: </span>
                      {modalDetalhes.localizacao.latitude || 'Não informada'}
                    </div>
                    <div>
                      <span style={{color: '#888'}}>Longitude: </span>
                      {modalDetalhes.localizacao.longitude || 'Não informada'}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {modalDetalhes.observacoes && (
              <div style={{padding: '0 20px', marginBottom: '20px'}}>
                <h4 style={styles.detalhesSubtitle}>Observações</h4>
                <div style={{backgroundColor: '#0A0A0A', padding: '15px', borderRadius: '8px', border: '1px solid #222', color: '#CCC', fontSize: '14px'}}>
                  {modalDetalhes.observacoes}
                </div>
              </div>
            )}
            
            <div style={styles.modalFooter}>
              <button 
                onClick={() => setModalDetalhes(null)}
                style={styles.btnPrimario}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    color: '#FFF',
    padding: '20px',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '25px'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  titulo: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#FFD700',
    margin: 0
  },
  acoes: {
    display: 'flex',
    gap: '10px'
  },
  btnNovo: {
    backgroundColor: '#FFD700',
    color: '#000',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 'bold',
    fontSize: '14px'
  },
  btnRecarregar: {
    backgroundColor: '#2c3e50',
    color: '#FFF',
    border: 'none',
    padding: '10px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  resumo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
    marginBottom: '25px'
  },
  resumoItem: {
    backgroundColor: '#111',
    padding: '20px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    border: '1px solid #222'
  },
  resumoIcon: {
    backgroundColor: '#FFD700',
    color: '#000',
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  resumoLabel: {
    color: '#888',
    fontSize: '12px',
    marginBottom: '4px'
  },
  resumoValor: {
    color: '#FFF',
    fontSize: '18px',
    fontWeight: 'bold'
  },
  filtrosContainer: {
    backgroundColor: '#0A0A0A',
    padding: '20px',
    borderRadius: '10px',
    marginBottom: '20px',
    border: '1px solid #222'
  },
  filtrosLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  buscaContainer: {
    position: 'relative'
  },
  buscaIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#666'
  },
  buscaInput: {
    width: '100%',
    padding: '12px 12px 12px 40px',
    backgroundColor: '#111',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#FFF',
    fontSize: '14px'
  },
  filtrosRapidos: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  selectFiltro: {
    flex: 1,
    minWidth: '200px',
    padding: '10px',
    backgroundColor: '#111',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#FFF',
    fontSize: '14px'
  },
  inputData: {
    flex: 1,
    minWidth: '150px',
    padding: '10px',
    backgroundColor: '#111',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#FFF',
    fontSize: '14px'
  },
  inputPosto: {
    flex: 2,
    minWidth: '200px',
    padding: '10px',
    backgroundColor: '#111',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#FFF',
    fontSize: '14px'
  },
  filtrosRight: {
    marginTop: '15px',
    display: 'flex',
    justifyContent: 'flex-end'
  },
  btnLimpar: {
    backgroundColor: 'transparent',
    color: '#666',
    border: '1px solid #333',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px'
  },
  tabelaContainer: {
    backgroundColor: '#0A0A0A',
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid #222'
  },
  loading: {
    padding: '60px',
    textAlign: 'center',
    color: '#666'
  },
  vazio: {
    padding: '60px',
    textAlign: 'center',
    color: '#666'
  },
  tabela: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    backgroundColor: '#111',
    padding: '15px',
    textAlign: 'left',
    color: '#AAA',
    fontSize: '13px',
    fontWeight: '600',
    borderBottom: '1px solid #222'
  },
  thContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  btnOrdenar: {
    background: 'none',
    border: 'none',
    color: '#666',
    cursor: 'pointer',
    padding: '0',
    display: 'flex',
    alignItems: 'center'
  },
  tr: {
    borderBottom: '1px solid #222'
  },
  td: {
    padding: '15px',
    color: '#CCC',
    fontSize: '14px',
    verticalAlign: 'top'
  },
  dataCell: {
    display: 'flex',
    alignItems: 'center'
  },
  motoristaCell: {
    display: 'flex',
    alignItems: 'center'
  },
  localCell: {
    display: 'flex',
    alignItems: 'flex-start'
  },
  acoesCell: {
    display: 'flex',
    gap: '8px'
  },
  btnAcao: {
    backgroundColor: 'transparent',
    color: '#666',
    border: '1px solid #333',
    width: '30px',
    height: '30px',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabelaFooter: {
    backgroundColor: '#111',
    padding: '15px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid #222'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  modal: {
    backgroundColor: '#111',
    borderRadius: '10px',
    width: '100%',
    maxWidth: '800px',
    maxHeight: '90vh',
    overflow: 'auto',
    border: '1px solid #333'
  },
  modalGrande: {
    backgroundColor: '#111',
    borderRadius: '10px',
    width: '100%',
    maxWidth: '900px',
    maxHeight: '90vh',
    overflow: 'auto',
    border: '1px solid #333'
  },
  modalHeader: {
    padding: '20px',
    borderBottom: '1px solid #222',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  modalTitle: {
    color: '#FFD700',
    fontSize: '18px',
    fontWeight: 'bold',
    margin: 0
  },
  btnFechar: {
    background: 'none',
    border: 'none',
    color: '#666',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0',
    lineHeight: '1'
  },
  modalBody: {
    padding: '20px'
  },
  modalFooter: {
    padding: '20px',
    borderTop: '1px solid #222',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px'
  },
  btnPrimario: {
    backgroundColor: '#FFD700',
    color: '#000',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px'
  },
  btnSecundario: {
    backgroundColor: 'transparent',
    color: '#AAA',
    border: '1px solid #333',
    padding: '12px 24px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px'
  },
  detalhesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '20px',
    padding: '0 20px'
  },
  detalhesCol: {
    backgroundColor: '#0A0A0A',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #222'
  },
  detalhesSubtitle: {
    color: '#FFD700',
    fontSize: '14px',
    fontWeight: 'bold',
    margin: '0 0 15px 0'
  },
  detalhesItem: {
    marginBottom: '10px',
    display: 'flex',
    justifyContent: 'space-between'
  },
  detalhesLabel: {
    color: '#888',
    fontSize: '13px'
  },
  detalhesValor: {
    color: '#FFF',
    fontSize: '14px',
    fontWeight: '500',
    textAlign: 'right'
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '15px',
    marginBottom: '20px'
  },
  formGroup: {
    marginBottom: '15px'
  },
  formLabel: {
    display: 'block',
    color: '#AAA',
    fontSize: '13px',
    marginBottom: '5px',
    fontWeight: '500'
  },
  formInput: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#111',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#FFF',
    fontSize: '14px'
  },
  formSelect: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#111',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#FFF',
    fontSize: '14px'
  }
};

export default Abastecimento;