import React, { useState, useEffect, useMemo } from 'react';
import { 
  getFirestore, collection, onSnapshot, query, 
  orderBy, where
} from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  Gauge, MapPin, Clock, User, Search, AlertTriangle, Calendar, ArrowRight
} from 'lucide-react';

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
  const [motoristasNomes, setMotoristasNomes] = useState({});
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroData, setFiltroData] = useState(new Date().toISOString().split('T')[0]); // Padrão: Hoje

  useEffect(() => {
    // 1. Mapeamento de nomes (ID -> Nome)
    const qMot = query(collection(db, "cadastro_motoristas"));
    const unsubMot = onSnapshot(qMot, (snapshot) => {
      let nomes = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        nomes[doc.id] = data.nome;
        if(data.uid) nomes[data.uid] = data.nome;
      });
      setMotoristasNomes(nomes);
    });

    // 2. Histórico (Ordenado por tempo)
    const qJor = query(collection(db, "historico_jornadas"), orderBy("timestamp", "desc"));
    const unsubJor = onSnapshot(qJor, (snapshot) => {
      const lista = [];
      snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
      setRegistros(lista);
    });

    return () => { unsubMot(); unsubJor(); };
  }, []);

  // Lógica de Processamento de Dados (Cálculos e Alertas)
  const motoristasAgrupados = useMemo(() => {
    const grupos = {};

    // Filtra pela data selecionada antes de agrupar
    const registrosFiltradosPorData = registros.filter(reg => {
      if (!reg.timestamp) return false;
      const dataReg = new Date(reg.timestamp.seconds * 1000).toISOString().split('T')[0];
      return dataReg === filtroData;
    });

    registrosFiltradosPorData.forEach((reg, index) => {
      const nomeReal = motoristasNomes[reg.motoristaId] || reg.motoristaNome || "ID: " + reg.motoristaId;
      if (!grupos[nomeReal]) grupos[nomeReal] = [];
      
      // Lógica de Alerta: Verifica se o KM é menor que o registro anterior (cronológico)
      let temAlertaKM = false;
      const proxReg = registrosFiltradosPorData[index + 1]; // Próximo na lista desc é o anterior no tempo
      if (proxReg && proxReg.motoristaId === reg.motoristaId && reg.km < proxReg.km) {
        temAlertaKM = true;
      }

      grupos[nomeReal].push({ ...reg, alertaKM: temAlertaKM });
    });

    return grupos;
  }, [registros, motoristasNomes, filtroData]);

  const nomesFiltrados = Object.keys(motoristasAgrupados).filter(nome => 
    nome.toLowerCase().includes(filtroNome.toLowerCase())
  );

  return (
    <div style={styles.container}>
      <div style={styles.headerArea}>
        <div style={styles.brand}>
          <div style={styles.logoIcon}><Gauge size={20} color="#000" /></div>
          <div>
            <h2 style={styles.titulo}>Jornada e Hodômetro</h2>
            <span style={styles.sub}>Controle de KM e horários por condutor</span>
          </div>
        </div>
        
        <div style={styles.filterRow}>
          <div style={styles.inputGroup}>
            <Calendar size={14} color="#FFD700" />
            <input 
              type="date" 
              style={styles.dateInput} 
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
            />
          </div>
          <div style={styles.searchBox}>
            <Search size={16} color="#555" />
            <input 
              style={styles.inputBusca} 
              placeholder="Buscar motorista..." 
              onChange={(e) => setFiltroNome(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={styles.grid}>
        {nomesFiltrados.length > 0 ? nomesFiltrados.map((nome) => {
          const logs = motoristasAgrupados[nome];
          // Cálculo de KM rodado no dia (Diferença entre o maior e menor KM do dia)
          const kms = logs.map(l => l.km || 0);
          const kmRodadoDia = Math.max(...kms) - Math.min(...kms);

          return (
            <div key={nome} style={styles.cardMotorista}>
              <div style={styles.cardHeader}>
                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                  <div style={styles.avatar}><User size={16} color="#000" /></div>
                  <span style={styles.nomeLabel}>{nome.toUpperCase()}</span>
                </div>
                <div style={styles.resumoDia}>
                   <span style={styles.resumoLabel}>RODADO HOJE:</span>
                   <span style={styles.resumoValue}>{kmRodadoDia} KM</span>
                </div>
              </div>

              <div style={styles.timeline}>
                {logs.map((log, idx) => (
                  <div key={log.id} style={styles.itemLog}>
                    <div style={styles.statusIndicator}>
                      <div style={{...styles.ponto, backgroundColor: log.tipo === 'INICIO' ? '#2ecc71' : '#e67e22'}} />
                      {idx !== logs.length - 1 && <div style={styles.linha} />}
                    </div>

                    <div style={styles.contentLog}>
                      <div style={styles.logHeader}>
                        <span style={{...styles.badge, color: log.tipo === 'INICIO' ? '#2ecc71' : '#e67e22'}}>
                          {log.tipo === 'INICIO' ? 'ABERTURA' : 'FECHAMENTO'}
                        </span>
                        <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                           {log.alertaKM && (
                             <div style={styles.alerta} title="KM informado é menor que o registro anterior!">
                               <AlertTriangle size={12} color="#ff4d4d" />
                               <span style={{fontSize: '9px', fontWeight: 'bold'}}>ERRO KM</span>
                             </div>
                           )}
                           <span style={styles.dataLog}>
                             {log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString('pt-BR') : '...'}
                           </span>
                        </div>
                      </div>

                      <div style={styles.detalhes}>
                        <div style={styles.detalheItem}>
                          <Gauge size={12} color={log.alertaKM ? "#ff4d4d" : "#FFD700"} />
                          <span style={{fontWeight: 'bold'}}>{log.km} KM</span>
                        </div>
                        <div style={styles.detalheItem}>
                          <MapPin size={12} color="#888" />
                          <span>{log.cidade || '---'}</span>
                        </div>
                        {log.duracaoFinal && (
                          <div style={styles.detalheItem}>
                            <Clock size={12} color="#2ecc71" />
                            <span>{log.duracaoFinal}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }) : (
          <div style={styles.noData}>Nenhum registro para esta data ou motorista.</div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px' },
  headerArea: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  brand: { display: 'flex', alignItems: 'center', gap: '10px' },
  logoIcon: { backgroundColor: '#FFD700', padding: '8px', borderRadius: '8px' },
  titulo: { fontSize: '18px', margin: 0, fontWeight: 'bold', color: '#fff' },
  sub: { fontSize: '10px', color: '#444', textTransform: 'uppercase', letterSpacing: '1px' },
  filterRow: { display: 'flex', gap: '15px' },
  inputGroup: { display: 'flex', alignItems: 'center', gap: '10px', background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '8px 15px', borderRadius: '10px' },
  dateInput: { background: 'transparent', border: 'none', color: '#fff', fontSize: '12px', outline: 'none', cursor: 'pointer' },
  searchBox: { display: 'flex', alignItems: 'center', gap: '10px', background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '8px 15px', borderRadius: '10px' },
  inputBusca: { background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '12px', width: '180px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: '20px' },
  cardMotorista: { background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '15px', padding: '20px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #1a1a1a', paddingBottom: '15px' },
  avatar: { width: '32px', height: '32px', background: '#FFD700', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  nomeLabel: { fontSize: '14px', fontWeight: '900', color: '#fff' },
  resumoDia: { textAlign: 'right', display: 'flex', flexDirection: 'column' },
  resumoLabel: { fontSize: '9px', color: '#444', fontWeight: 'bold' },
  resumoValue: { fontSize: '14px', color: '#FFD700', fontWeight: '900' },
  timeline: { display: 'flex', flexDirection: 'column' },
  itemLog: { display: 'flex', gap: '15px' },
  statusIndicator: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  ponto: { width: '10px', height: '10px', borderRadius: '50%', marginTop: '5px' },
  linha: { width: '2px', flex: 1, background: '#1a1a1a', margin: '5px 0' },
  contentLog: { flex: 1, background: '#0d0d0d', border: '1px solid #111', padding: '12px', borderRadius: '12px', marginBottom: '15px' },
  logHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  badge: { fontSize: '10px', fontWeight: '900' },
  dataLog: { fontSize: '11px', color: '#333', fontWeight: 'bold' },
  alerta: { display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 77, 77, 0.1)', padding: '2px 8px', borderRadius: '4px', color: '#ff4d4d' },
  detalhes: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
  detalheItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#bbb' },
  noData: { color: '#333', textAlign: 'center', gridColumn: '1/-1', padding: '50px', fontSize: '14px' }
};