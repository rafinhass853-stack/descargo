import React, { useState, useEffect, useMemo } from 'react';
import { 
  getFirestore, collection, onSnapshot, query, 
  orderBy, doc, updateDoc, setDoc, where
} from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  Gauge, MapPin, User, Search, CheckCircle2, Timer, Users, Send, TrendingUp,
  Check, X, AlertCircle, Filter, Download, Bell
} from 'lucide-react';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAAANwxEopbLtRmWqF2b9mrOXbOwUf5x8M",
  authDomain: "descargo-4090a.firebaseapp.com",
  projectId: "descargo-4090a",
  storageBucket: "descargo-4090a.firebasestorage.app",
  messagingSenderId: "345718597496",
  appId: "1:345718597496:web:97af37f598666e0a3bca8d",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export default function JornadaHodometro() {
  const [registros, setRegistros] = useState([]);
  const [motoristasCadastrados, setMotoristasCadastrados] = useState([]);
  const [solicitacaoAtiva, setSolicitacaoAtiva] = useState(false);
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroData, setFiltroData] = useState(new Date().toISOString().split('T')[0]);
  
  // NOVO ESTADO PARA SELEÇÃO DE MOTORISTAS
  const [motoristasSelecionados, setMotoristasSelecionados] = useState([]);
  const [mostrarSelecao, setMostrarSelecao] = useState(false);
  const [selecaoEmMassa, setSelecaoEmMassa] = useState(false);
  const [historicoSolicitacoes, setHistoricoSolicitacoes] = useState([]);
  
  const [mesConsolidado, setMesConsolidado] = useState(new Date().getMonth() + 1);
  const [anoConsolidado, setAnoConsolidado] = useState(new Date().getFullYear());

  // --- CARREGAR DADOS ---
  useEffect(() => {
    // Carregar motoristas
    const unsubMot = onSnapshot(collection(db, "cadastro_motoristas"), (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        selecionado: false // Adicionar estado de seleção
      }));
      setMotoristasCadastrados(lista);
    });

    // Carregar status da solicitação atual
    const unsubStatus = onSnapshot(doc(db, "configuracoes", "controle_app"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSolicitacaoAtiva(data.pedirHodometro || false);
        setMotoristasSelecionados(data.motoristasSelecionados || []);
      }
    });

    // Carregar histórico de jornadas
    const qJor = query(collection(db, "historico_jornadas"), orderBy("timestamp", "desc"));
    const unsubJor = onSnapshot(qJor, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRegistros(lista);
    });

    // Carregar histórico de solicitações
    const qHistorico = query(
      collection(db, "historico_solicitacoes_km"), 
      orderBy("timestamp", "desc"),
      where("timestamp", ">", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    );
    const unsubHistorico = onSnapshot(qHistorico, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistoricoSolicitacoes(lista.slice(0, 10)); // Últimas 10 solicitações
    });

    return () => { 
      unsubMot(); 
      unsubStatus(); 
      unsubJor(); 
      unsubHistorico(); 
    };
  }, []);

  // --- FUNÇÕES DE SELEÇÃO ---
  const alternarSelecaoMotorista = (motoristaId) => {
    setMotoristasCadastrados(prev => 
      prev.map(m => 
        m.id === motoristaId 
          ? { ...m, selecionado: !m.selecionado }
          : m
      )
    );
  };

  const selecionarTodos = () => {
    const novoEstado = !selecaoEmMassa;
    setSelecaoEmMassa(novoEstado);
    setMotoristasCadastrados(prev => 
      prev.map(m => ({ ...m, selecionado: novoEstado }))
    );
  };

  const selecionarMotoristasPendentes = () => {
    const motoristasPendentes = listaFinal.filter(m => !m.enviou).map(m => m.id);
    setMotoristasCadastrados(prev => 
      prev.map(m => ({
        ...m, 
        selecionado: motoristasPendentes.includes(m.id)
      }))
    );
  };

  const getMotoristasSelecionados = () => {
    return motoristasCadastrados.filter(m => m.selecionado).map(m => ({
      id: m.id,
      nome: m.nome,
      uid: m.uid
    }));
  };

  // --- SOLICITAR KM PARA MOTORISTAS SELECIONADOS ---
  const solicitarKmSelecionados = async () => {
    const selecionados = getMotoristasSelecionados();
    
    if (selecionados.length === 0) {
      alert("Selecione pelo menos um motorista!");
      return;
    }

    try {
      // Salvar solicitação no histórico
      await setDoc(doc(collection(db, "historico_solicitacoes_km")), {
        motoristas: selecionados,
        quantidade: selecionados.length,
        timestamp: new Date(),
        tipo: 'MANUAL_SELECAO',
        status: 'SOLICITADO'
      });

      // Atualizar configuração principal
      await setDoc(doc(db, "configuracoes", "controle_app"), { 
        pedirHodometro: true,
        timestampSolicitacao: new Date(),
        origem: "MANUAL_SELECAO",
        motoristasSelecionados: selecionados,
        totalMotoristas: selecionados.length
      }, { merge: true });

      // Enviar notificação individual para cada motorista
      for (const motorista of selecionados) {
        await setDoc(doc(db, "notificacoes_motoristas", motorista.id), {
          motoristaId: motorista.id,
          tipo: "SOLICITACAO_KM",
          mensagem: "Solicitação de leitura do hodômetro",
          timestamp: new Date(),
          lida: false,
          origem: "GESTOR"
        }, { merge: true });
      }

      alert(`✅ KM solicitado para ${selecionados.length} motorista(s) selecionado(s)!`);
      setMostrarSelecao(false);
      
    } catch (error) {
      console.error("Erro ao solicitar KM:", error);
      alert("❌ Erro ao enviar solicitação.");
    }
  };

  // --- SOLICITAR KM PARA TODOS ---
  const solicitarKmTodos = async () => {
    try {
      const todosMotoristas = motoristasCadastrados.map(m => ({
        id: m.id,
        nome: m.nome,
        uid: m.uid
      }));

      // Salvar no histórico
      await setDoc(doc(collection(db, "historico_solicitacoes_km")), {
        motoristas: todosMotoristas,
        quantidade: todosMotoristas.length,
        timestamp: new Date(),
        tipo: 'MANUAL_TODOS',
        status: 'SOLICITADO'
      });

      // Atualizar configuração
      await setDoc(doc(db, "configuracoes", "controle_app"), { 
        pedirHodometro: true,
        timestampSolicitacao: new Date(),
        origem: "MANUAL_TODOS",
        motoristasSelecionados: todosMotoristas,
        totalMotoristas: todosMotoristas.length
      }, { merge: true });

      alert(`✅ KM solicitado para todos os ${todosMotoristas.length} motoristas!`);
      
    } catch (error) {
      console.error("Erro ao solicitar KM:", error);
      alert("❌ Erro ao enviar solicitação.");
    }
  };

  // --- CANCELAR SOLICITAÇÃO ---
  const cancelarSolicitacao = async () => {
    try {
      await setDoc(doc(db, "configuracoes", "controle_app"), { 
        pedirHodometro: false,
        timestampCancelamento: new Date(),
        origem: "CANCELAMENTO_MANUAL"
      }, { merge: true });

      alert("✅ Solicitação cancelada!");
      
    } catch (error) {
      console.error("Erro ao cancelar:", error);
      alert("❌ Erro ao cancelar solicitação.");
    }
  };

  // --- AUTOMATIZAÇÃO (ROBOT) ---
  useEffect(() => {
    const verificarHorario = async () => {
      const agora = new Date();
      const hora = agora.getHours();
      const minuto = agora.getMinutes();

      // Dispara às 08:00 AM ou 18:00 PM (apenas no minuto zero)
      if ((hora === 8 || hora === 18) && minuto === 0) {
        if (!solicitacaoAtiva) {
          console.log("Disparando solicitação automática de KM...");
          
          const todosMotoristas = motoristasCadastrados.map(m => ({
            id: m.id,
            nome: m.nome,
            uid: m.uid
          }));

          await setDoc(doc(db, "configuracoes", "controle_app"), { 
            pedirHodometro: true,
            timestampSolicitacao: new Date(),
            origem: "AUTOMATICO",
            motoristasSelecionados: todosMotoristas,
            totalMotoristas: todosMotoristas.length
          }, { merge: true });
        }
      }
    };

    const interval = setInterval(verificarHorario, 60000); // Checa a cada 1 minuto
    return () => clearInterval(interval);
  }, [solicitacaoAtiva, motoristasCadastrados]);

  // --- CÁLCULOS DO CONSOLIDADO ---
  const consolidado = useMemo(() => {
    const dadosMotoristas = {};
    let kmTotalPeriodo = 0;

    registros.forEach(reg => {
      if (!reg.timestamp) return;
      const data = new Date(reg.timestamp.seconds * 1000);
      if ((data.getMonth() + 1) === Number(mesConsolidado) && data.getFullYear() === Number(anoConsolidado)) {
        const mId = reg.motoristaId;
        if (!dadosMotoristas[mId]) dadosMotoristas[mId] = [];
        dadosMotoristas[mId].push(Number(reg.km) || 0);
      }
    });

    const ranking = motoristasCadastrados.map(mot => {
      const kms = dadosMotoristas[mot.id] || dadosMotoristas[mot.uid] || [];
      const kmRodado = kms.length > 1 ? Math.max(...kms) - Math.min(...kms) : 0;
      kmTotalPeriodo += kmRodado;
      return { 
        nome: mot.nome, 
        km: kmRodado,
        selecionado: mot.selecionado || false
      };
    }).sort((a, b) => b.km - a.km);

    return { ranking, kmTotalPeriodo };
  }, [registros, motoristasCadastrados, mesConsolidado, anoConsolidado]);

  // --- DASHBOARD DIÁRIO ---
  const { listaFinal, stats } = useMemo(() => {
    let kmTotalGeral = 0;
    const motoristasQueEnviaramIds = new Set();
    const enviosDeHoje = registros.filter(reg => 
      reg.timestamp && new Date(reg.timestamp.seconds * 1000).toISOString().split('T')[0] === filtroData
    );

    const grupos = {};
    enviosDeHoje.forEach(reg => {
      const mId = reg.motoristaId;
      if (!grupos[mId]) grupos[mId] = [];
      grupos[mId].push(reg);
      motoristasQueEnviaramIds.add(mId);
    });

    Object.values(grupos).forEach(logs => {
      const kms = logs.map(l => Number(l.km) || 0);
      if (kms.length > 1) kmTotalGeral += (Math.max(...kms) - Math.min(...kms));
    });

    const listaCompleta = motoristasCadastrados.map(mot => {
      const logs = grupos[mot.id] || grupos[mot.uid] || [];
      return { 
        ...mot, 
        logs, 
        enviou: logs.length > 0,
        selecionado: mot.selecionado || false
      };
    });

    return {
      listaFinal: listaCompleta,
      stats: {
        total: motoristasCadastrados.length,
        enviaram: motoristasQueEnviaramIds.size,
        pendentes: motoristasCadastrados.length - motoristasQueEnviaramIds.size,
        kmTotal: kmTotalGeral,
        selecionados: listaCompleta.filter(m => m.selecionado).length
      }
    };
  }, [registros, motoristasCadastrados, filtroData]);

  return (
    <div style={styles.container}>
      {/* MODAL DE SELEÇÃO DE MOTORISTAS */}
      {mostrarSelecao && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Filter size={24} color="#FFD700" />
                <h2 style={{ margin: 0 }}>Selecionar Motoristas para Solicitar KM</h2>
              </div>
              <button onClick={() => setMostrarSelecao(false)} style={styles.btnClose}>
                <X size={20} />
              </button>
            </div>
            
            <div style={styles.modalActions}>
              <button onClick={selecionarTodos} style={styles.btnAcaoModal}>
                {selecaoEmMassa ? <X size={16} /> : <Check size={16} />}
                {selecaoEmMassa ? 'DESMARCAR TODOS' : 'MARCAR TODOS'}
              </button>
              <button onClick={selecionarMotoristasPendentes} style={styles.btnAcaoModal}>
                <AlertCircle size={16} />
                SELECIONAR PENDENTES
              </button>
              <div style={{ flex: 1 }} />
              <div style={styles.contadorSelecao}>
                <Users size={16} />
                <span>{getMotoristasSelecionados().length} selecionado(s)</span>
              </div>
            </div>
            
            <div style={styles.listaSelecao}>
              {motoristasCadastrados.map(mot => {
                const enviou = listaFinal.find(m => m.id === mot.id)?.enviou || false;
                return (
                  <div 
                    key={mot.id} 
                    style={{
                      ...styles.itemSelecao,
                      background: mot.selecionado ? 'rgba(255, 215, 0, 0.1)' : '#111',
                      borderColor: mot.selecionado ? '#FFD700' : '#222',
                      borderLeft: `4px solid ${enviou ? '#2ecc71' : '#ff4d4d'}`
                    }}
                    onClick={() => alternarSelecaoMotorista(mot.id)}
                  >
                    <div style={styles.checkboxSelecao}>
                      {mot.selecionado ? (
                        <div style={styles.checkboxAtivo}>
                          <Check size={12} color="#000" />
                        </div>
                      ) : (
                        <div style={styles.checkboxInativo} />
                      )}
                    </div>
                    <div style={styles.infoMotoristaSelecao}>
                      <div style={styles.nomeMotoristaSelecao}>{mot.nome}</div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: enviou ? '#2ecc71' : '#ff4d4d',
                        fontWeight: 'bold'
                      }}>
                        {enviou ? '✓ ENVIOU HOJE' : '⏱️ PENDENTE'}
                      </div>
                    </div>
                    <div style={styles.statusEnvioSelecao}>
                      {enviou ? (
                        <CheckCircle2 size={16} color="#2ecc71" />
                      ) : (
                        <Timer size={16} color="#ff4d4d" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div style={styles.modalFooter}>
              <button onClick={() => setMostrarSelecao(false)} style={styles.btnCancelarModal}>
                CANCELAR
              </button>
              <button onClick={solicitarKmSelecionados} style={styles.btnConfirmarModal}>
                <Send size={18} />
                SOLICITAR KM PARA SELECIONADOS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. CONSOLIDADO */}
      <div style={styles.consolidadoWrapper}>
        <div style={styles.consolidadoHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp color="#FFD700" size={24} />
            <h2 style={{ margin: 0 }}>Consolidado do Período</h2>
          </div>
          <div style={styles.filterRow}>
            <select style={styles.dateInput} value={mesConsolidado} onChange={(e) => setMesConsolidado(e.target.value)}>
              {Array.from({length: 12}, (_, i) => (
                <option key={i+1} value={i+1}>
                  {new Date(0, i).toLocaleString('pt-BR', {month: 'long'}).toUpperCase()}
                </option>
              ))}
            </select>
            <select style={styles.dateInput} value={anoConsolidado} onChange={(e) => setAnoConsolidado(e.target.value)}>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>
        </div>
        <div style={styles.consolidadoGrid}>
          <div style={styles.totalDestaque}>
            <span style={styles.statLabel}>KM TOTAL NO MÊS</span>
            <div style={{ fontSize: '32px', fontWeight: '900', color: '#FFD700' }}>
              {consolidado.kmTotalPeriodo.toLocaleString()} KM
            </div>
          </div>
          <div style={styles.rankingLista}>
            {consolidado.ranking.slice(0, 5).map((item, idx) => (
              <div key={idx} style={styles.rankingItem}>
                <span style={{ color: '#666', width: '20px' }}>{idx + 1}º</span>
                <span style={{ flex: 1, fontWeight: 'bold', fontSize: '13px' }}>{item.nome}</span>
                <span style={{ color: '#FFD700', fontWeight: 'bold' }}>{item.km} KM</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. DASHBOARD DIÁRIO COM BOTÕES DE SELEÇÃO */}
      <div style={styles.statsBar}>
        <div style={styles.statCard}>
          <Users size={20} color="#FFD700" />
          <div>
            <span style={styles.statLabel}>TOTAL</span>
            <div style={styles.statValue}>{stats.total}</div>
          </div>
        </div>
        
        <div style={styles.statCard}>
          <CheckCircle2 size={20} color="#2ecc71" />
          <div>
            <span style={styles.statLabel}>ENVIARAM</span>
            <div style={styles.statValue}>{stats.enviaram}</div>
          </div>
        </div>
        
        <div style={styles.statCard}>
          <Timer size={20} color={stats.pendentes > 0 ? "#ff4d4d" : "#2ecc71"} />
          <div>
            <span style={styles.statLabel}>PENDENTES</span>
            <div style={styles.statValue}>{stats.pendentes}</div>
          </div>
        </div>
        
        <div style={styles.statCard}>
          <Gauge size={20} color="#FFD700" />
          <div>
            <span style={styles.statLabel}>KM HOJE</span>
            <div style={styles.statValue}>{stats.kmTotal} KM</div>
          </div>
        </div>
        
        <div style={styles.statCard}>
          <Filter size={20} color={stats.selecionados > 0 ? "#FFD700" : "#666"} />
          <div>
            <span style={styles.statLabel}>SELECIONADOS</span>
            <div style={styles.statValue}>{stats.selecionados}</div>
          </div>
        </div>
      </div>

      {/* 3. BOTÕES DE AÇÃO */}
      <div style={styles.acoesContainer}>
        <button 
          onClick={() => setMostrarSelecao(true)}
          style={styles.btnSelecionar}
        >
          <Filter size={18} />
          <span>SELECIONAR MOTORISTAS</span>
        </button>
        
        <button 
          onClick={solicitarKmTodos}
          style={{
            ...styles.btnSolicitar, 
            backgroundColor: '#FFD700',
            cursor: 'pointer'
          }}
          disabled={solicitacaoAtiva}
        >
          <Send size={18} color="#000" />
          <span style={{ color: "#000" }}>SOLICITAR KM PARA TODOS</span>
        </button>
        
        <button 
          onClick={solicitarKmSelecionados}
          style={{
            ...styles.btnSolicitar, 
            backgroundColor: '#3498db',
            cursor: stats.selecionados > 0 ? 'pointer' : 'not-allowed',
            opacity: stats.selecionados > 0 ? 1 : 0.5
          }}
          disabled={stats.selecionados === 0 || solicitacaoAtiva}
        >
          <Send size={18} color="#FFF" />
          <span style={{ color: "#FFF" }}>
            SOLICITAR KM SELECIONADOS ({stats.selecionados})
          </span>
        </button>
        
        {solicitacaoAtiva && (
          <button 
            onClick={cancelarSolicitacao}
            style={{
              ...styles.btnCancelar,
              backgroundColor: '#ff4d4d',
              cursor: 'pointer'
            }}
          >
            <X size={18} color="#FFF" />
            <span style={{ color: "#FFF" }}>CANCELAR SOLICITAÇÃO</span>
          </button>
        )}
      </div>

      {/* 4. HISTÓRICO DE SOLICITAÇÕES (OPCIONAL) */}
      <div style={styles.historicoContainer}>
        <div style={styles.historicoHeader}>
          <Bell size={20} color="#FFD700" />
          <h3 style={{ margin: 0, marginLeft: '10px' }}>Últimas Solicitações</h3>
        </div>
        <div style={styles.historicoLista}>
          {historicoSolicitacoes.slice(0, 5).map((sol, idx) => (
            <div key={sol.id} style={styles.itemHistorico}>
              <div style={styles.historicoInfo}>
                <span style={styles.historicoTipo}>{sol.tipo || 'MANUAL'}</span>
                <span style={styles.historicoData}>
                  {sol.timestamp?.seconds 
                    ? new Date(sol.timestamp.seconds * 1000).toLocaleString('pt-BR')
                    : 'Data não disponível'}
                </span>
              </div>
              <div style={styles.historicoDetalhes}>
                <span style={styles.historicoQuantidade}>{sol.quantidade || 0} motorista(s)</span>
                <span style={{
                  ...styles.historicoStatus,
                  color: sol.status === 'SOLICITADO' ? '#2ecc71' : '#ff4d4d'
                }}>
                  {sol.status || 'PENDENTE'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. LISTAGEM DE MOTORISTAS */}
      <div style={styles.headerArea}>
        <h2 style={styles.titulo}>Status do Dia (08:00h e 18:00h Auto)</h2>
        <div style={styles.filterRow}>
          <input 
            type="date" 
            style={styles.dateInput} 
            value={filtroData} 
            onChange={(e) => setFiltroData(e.target.value)} 
          />
          <div style={styles.searchBox}>
            <Search size={18} color="#555" />
            <input 
              style={styles.inputBusca} 
              placeholder="Buscar motorista..." 
              value={filtroNome} 
              onChange={(e) => setFiltroNome(e.target.value)} 
            />
          </div>
        </div>
      </div>

      <div style={styles.grid}>
        {listaFinal
          .filter(m => (m.nome || '').toLowerCase().includes(filtroNome.toLowerCase()))
          .map((mot) => {
            const kms = mot.logs.map(l => Number(l.km) || 0);
            const kmRodado = kms.length > 1 ? Math.max(...kms) - Math.min(...kms) : 0;
            const estaSelecionado = mot.selecionado;
            
            return (
              <div 
                key={mot.id} 
                style={{
                  ...styles.cardMotorista, 
                  borderColor: !mot.enviou && solicitacaoAtiva ? '#ff4d4d' : '#1a1a1a',
                  borderLeft: `5px solid ${estaSelecionado ? '#FFD700' : (mot.enviou ? '#2ecc71' : '#333')}`
                }}
                onClick={() => alternarSelecaoMotorista(mot.id)}
              >
                <div style={styles.cardHeader}>
                  <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
                    <div style={{
                      ...styles.avatar, 
                      backgroundColor: mot.enviou ? '#2ecc71' : (estaSelecionado ? '#FFD700' : '#333'),
                      position: 'relative'
                    }}>
                      <User size={20} color={mot.enviou || estaSelecionado ? "#000" : "#666"} />
                      {estaSelecionado && (
                        <div style={styles.badgeSelecionado}>
                          <Check size={10} color="#000" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={styles.nomeLabel}>{mot.nome?.toUpperCase()}</div>
                      <span style={{
                        color: mot.enviou ? '#2ecc71' : '#ff4d4d', 
                        fontSize:'11px', 
                        fontWeight:'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {estaSelecionado && <Filter size={10} />}
                        {mot.enviou ? '✓ CONCLUÍDO' : '⏱️ PENDENTE'}
                      </span>
                    </div>
                  </div>
                  {mot.enviou && (
                    <div style={{textAlign:'right'}}>
                      <div style={styles.resumoLabel}>KM HOJE</div>
                      <div style={styles.resumoValue}>{kmRodado}</div>
                    </div>
                  )}
                </div>
                <div style={styles.timeline}>
                  {mot.logs.length > 0 ? mot.logs.map(log => (
                    <div key={log.id} style={styles.contentLog}>
                      <div style={styles.logHeader}>
                        <span style={styles.badge}>{log.tipo || 'REGISTRO'}</span>
                        <span style={styles.horaLabel}>
                          {log.timestamp?.seconds 
                            ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString()
                            : '--:--'}
                        </span>
                      </div>
                      <div style={styles.dataRow}>
                        <div style={styles.kmDisplay}>
                          <Gauge size={14} color="#FFD700" />
                          <span style={styles.kmValue}>{log.km} KM</span>
                        </div>
                        <div style={styles.locInfo}>
                          <MapPin size={14} color="#555" />
                          <span style={styles.locText}>{log.cidade || 'S/L'}</span>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div style={styles.emptyState}>
                      {solicitacaoAtiva ? '🔄 Aguardando envio...' : 'Sem registro hoje'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// --- ESTILOS ATUALIZADOS ---
const styles = {
  container: { 
    padding: '30px', 
    backgroundColor: '#000', 
    minHeight: '100vh', 
    color: '#fff', 
    fontFamily: 'sans-serif' 
  },
  
  // MODAL
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.95)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  
  modalContent: {
    background: '#111',
    borderRadius: '20px',
    padding: '30px',
    width: '800px',
    maxWidth: '90vw',
    maxHeight: '90vh',
    overflowY: 'auto',
    border: '1px solid #333',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
  },
  
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '1px solid #333'
  },
  
  btnClose: {
    background: '#222',
    border: 'none',
    color: '#fff',
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  
  modalActions: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    flexWrap: 'wrap'
  },
  
  btnAcaoModal: {
    background: 'rgba(255, 215, 0, 0.1)',
    color: '#FFD700',
    border: '1px solid rgba(255, 215, 0, 0.3)',
    padding: '10px 15px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.3s ease'
  },
  
  contadorSelecao: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255, 215, 0, 0.1)',
    padding: '10px 15px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 215, 0, 0.3)',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  
  listaSelecao: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '20px',
    maxHeight: '400px',
    overflowY: 'auto',
    paddingRight: '10px'
  },
  
  itemSelecao: {
    display: 'flex',
    alignItems: 'center',
    padding: '15px',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    gap: '15px',
    border: '1px solid'
  },
  
  checkboxSelecao: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  
  checkboxAtivo: {
    width: '20px',
    height: '20px',
    background: '#FFD700',
    borderRadius: '5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  
  checkboxInativo: {
    width: '20px',
    height: '20px',
    border: '2px solid #444',
    borderRadius: '5px'
  },
  
  infoMotoristaSelecao: {
    flex: 1
  },
  
  nomeMotoristaSelecao: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '4px'
  },
  
  statusEnvioSelecao: {
    padding: '8px'
  },
  
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '15px',
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid #333'
  },
  
  btnCancelarModal: {
    background: '#222',
    color: '#fff',
    border: '1px solid #333',
    padding: '12px 25px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  
  btnConfirmarModal: {
    background: '#FFD700',
    color: '#000',
    border: 'none',
    padding: '12px 25px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  
  // AÇÕES
  acoesContainer: {
    display: 'flex',
    gap: '15px',
    marginBottom: '30px',
    flexWrap: 'wrap'
  },
  
  btnSelecionar: {
    background: 'rgba(52, 152, 219, 0.1)',
    color: '#3498db',
    border: '2px solid rgba(52, 152, 219, 0.3)',
    padding: '15px 20px',
    borderRadius: '15px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    transition: 'all 0.3s ease'
  },
  
  btnSolicitar: {
    border: 'none',
    padding: '15px 25px',
    borderRadius: '15px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    transition: '0.2s',
    fontSize: '14px'
  },
  
  btnCancelar: {
    border: 'none',
    padding: '15px 25px',
    borderRadius: '15px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    transition: '0.2s',
    fontSize: '14px'
  },
  
  // HISTÓRICO
  historicoContainer: {
    background: '#0a0a0a',
    padding: '20px',
    borderRadius: '20px',
    border: '1px solid #1a1a1a',
    marginBottom: '30px'
  },
  
  historicoHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '15px',
    paddingBottom: '10px',
    borderBottom: '1px solid #222'
  },
  
  historicoLista: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  
  itemHistorico: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 15px',
    background: '#111',
    borderRadius: '10px',
    border: '1px solid #222'
  },
  
  historicoInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  
  historicoTipo: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#FFD700'
  },
  
  historicoData: {
    fontSize: '11px',
    color: '#666'
  },
  
  historicoDetalhes: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px'
  },
  
  historicoQuantidade: {
    fontSize: '12px',
    fontWeight: 'bold'
  },
  
  historicoStatus: {
    fontSize: '11px',
    fontWeight: 'bold'
  },
  
  // ESTILOS EXISTENTES (atualizados)
  consolidadoWrapper: { 
    background: '#0a0a0a', 
    padding: '25px', 
    borderRadius: '20px', 
    border: '1px solid #1a1a1a', 
    marginBottom: '20px' 
  },
  
  consolidadoHeader: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: '20px' 
  },
  
  consolidadoGrid: { 
    display: 'grid', 
    gridTemplateColumns: '1fr 1fr', 
    gap: '30px', 
    alignItems: 'center' 
  },
  
  totalDestaque: { 
    background: '#111', 
    padding: '30px', 
    borderRadius: '15px', 
    borderLeft: '5px solid #FFD700' 
  },
  
  rankingLista: { 
    background: '#111', 
    padding: '15px', 
    borderRadius: '15px' 
  },
  
  rankingItem: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    padding: '8px 0', 
    borderBottom: '1px solid #222' 
  },
  
  statsBar: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(5, 1fr)', 
    gap: '15px', 
    marginBottom: '30px', 
    background: '#0a0a0a', 
    padding: '20px', 
    borderRadius: '20px', 
    border: '1px solid #1a1a1a', 
    alignItems: 'center' 
  },
  
  statCard: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '12px', 
    background: '#111', 
    padding: '15px', 
    borderRadius: '15px' 
  },
  
  statLabel: { 
    fontSize: '9px', 
    color: '#666', 
    fontWeight: 'bold' 
  },
  
  statValue: { 
    fontSize: '18px', 
    fontWeight: '900' 
  },
  
  headerArea: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    marginBottom: '30px', 
    alignItems: 'center' 
  },
  
  titulo: { 
    margin: 0, 
    fontSize: '22px', 
    fontWeight: 'bold' 
  },
  
  filterRow: { 
    display: 'flex', 
    gap: '10px' 
  },
  
  searchBox: { 
    background: '#111', 
    padding: '10px 15px', 
    borderRadius: '10px', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '10px', 
    border: '1px solid #222' 
  },
  
  inputBusca: { 
    background: 'transparent', 
    border: 'none', 
    color: '#fff', 
    outline: 'none', 
    width: '150px' 
  },
  
  dateInput: { 
    background: '#111', 
    border: '1px solid #222', 
    color: '#fff', 
    borderRadius: '10px', 
    padding: '10px' 
  },
  
  grid: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
    gap: '20px' 
  },
  
  cardMotorista: { 
    background: '#0a0a0a', 
    border: '1px solid #1a1a1a', 
    borderRadius: '20px', 
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.3s ease'
  },
  
  cardHeader: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    marginBottom: '20px',
    alignItems: 'center'
  },
  
  avatar: { 
    width: '40px', 
    height: '40px', 
    borderRadius: '10px', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    position: 'relative'
  },
  
  badgeSelecionado: {
    position: 'absolute',
    bottom: '-5px',
    right: '-5px',
    background: '#FFD700',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #000'
  },
  
  nomeLabel: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: '14px' 
  },
  
  resumoLabel: { 
    color: '#444', 
    fontSize: '9px', 
    fontWeight: 'bold' 
  },
  
  resumoValue: { 
    color: '#FFD700', 
    fontSize: '18px', 
    fontWeight: '900' 
  },
  
  contentLog: { 
    background: '#111', 
    padding: '12px', 
    borderRadius: '12px', 
    marginBottom: '8px' 
  },
  
  logHeader: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    marginBottom: '8px' 
  },
  
  badge: { 
    fontSize: '9px', 
    fontWeight: 'bold', 
    background: '#222', 
    padding: '2px 6px', 
    borderRadius: '4px' 
  },
  
  horaLabel: { 
    fontSize: '13px', 
    fontWeight: 'bold', 
    color: '#FFD700' 
  },
  
  dataRow: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  
  kmDisplay: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '6px' 
  },
  
  kmValue: { 
    fontSize: '14px', 
    fontWeight: 'bold' 
  },
  
  locInfo: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '4px' 
  },
  
  locText: { 
    color: '#444', 
    fontSize: '11px' 
  },
  
  emptyState: { 
    padding: '10px', 
    textAlign: 'center', 
    color: '#333', 
    fontSize: '12px' 
  }
};