import React, { useState, useEffect } from 'react';
import { X, Search, User, MapPin, Navigation, ArrowRight, Bell, Trash2, Truck, Container, Volume2, Map, Target, Shield, AlertCircle } from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, serverTimestamp, 
  onSnapshot, query, where, orderBy, getDocs, deleteDoc, doc, updateDoc 
} from 'firebase/firestore';

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

// Chave do Google Maps para geocoding
const GOOGLE_MAPS_API_KEY = 'AIzaSyDT5OptLHwnCVPuevN5Ie8SFWxm4mRPAl4';

// Função para obter coordenadas do endereço
const obterCoordenadasDoEndereco = async (endereco) => {
  if (!endereco) return null;
  
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(endereco)}&key=${GOOGLE_MAPS_API_KEY}`
    );
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng
      };
    }
  } catch (error) {
    console.error("Erro ao buscar coordenadas:", error);
  }
  
  return null;
};

// Função para gerar instruções de rota
const gerarInstrucoesDeRota = async (trajetoCoords, origemNome, destinoNome) => {
  if (!trajetoCoords || trajetoCoords.length === 0) return [];
  
  try {
    // Converte coordenadas para string OSRM
    const coordenadasStr = trajetoCoords.map(c => `${c.longitude},${c.latitude}`).join(';');
    
    // Faz requisição para OSRM
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordenadasStr}?overview=full&geometries=geojson&steps=true&alternatives=false`
    );
    
    const data = await response.json();
    
    if (!data.routes || data.routes.length === 0) {
      return trajetoCoords.map((coord, index) => ({
        ...coord,
        instrucao: index === 0 ? `Inicie viagem de ${origemNome}` : 
                  index === trajetoCoords.length - 1 ? `Chegada em ${destinoNome}` : 
                  "Siga em frente",
        tipo: index === 0 ? "depart" : 
              index === trajetoCoords.length - 1 ? "arrive" : 
              "continue",
        distanciaAteProximo: index < trajetoCoords.length - 1 ? "500m" : "0m",
        duracao: "30s",
        modo: "straight"
      }));
    }
    
    const legs = data.routes[0].legs;
    const instrucoes = [];
    
    // Instrução de partida
    instrucoes.push({
      latitude: trajetoCoords[0].latitude,
      longitude: trajetoCoords[0].longitude,
      instrucao: `Inicie a viagem de ${origemNome}`,
      distanciaAteProximo: "0m",
      duracao: "0s",
      tipo: "depart",
      modo: "depart"
    });
    
    // Extrai instruções do OSRM
    legs.forEach(leg => {
      leg.steps.forEach(step => {
        if (step.geometry && step.geometry.coordinates.length > 0) {
          const [lng, lat] = step.geometry.coordinates[Math.floor(step.geometry.coordinates.length / 2)];
          
          let instrucaoPt = step.maneuver.instruction || "Continue em frente";
          
          // Traduções
          if (instrucaoPt.includes('Turn left')) instrucaoPt = 'Vire à esquerda';
          else if (instrucaoPt.includes('Turn right')) instrucaoPt = 'Vire à direita';
          else if (instrucaoPt.includes('Continue')) instrucaoPt = 'Continue em frente';
          else if (instrucaoPt.includes('Keep left')) instrucaoPt = 'Mantenha-se à esquerda';
          else if (instrucaoPt.includes('Keep right')) instrucaoPt = 'Mantenha-se à direita';
          else if (instrucaoPt.includes('sharp left')) instrucaoPt = 'Vire acentuadamente à esquerda';
          else if (instrucaoPt.includes('sharp right')) instrucaoPt = 'Vire acentuadamente à direita';
          else if (instrucaoPt.includes('slight left')) instrucaoPt = 'Curve suavemente à esquerda';
          else if (instrucaoPt.includes('slight right')) instrucaoPt = 'Curve suavemente à direita';
          else if (instrucaoPt.includes('arrive')) instrucaoPt = 'Chegada ao destino';
          
          instrucoes.push({
            latitude: lat,
            longitude: lng,
            instrucao: instrucaoPt,
            distanciaAteProximo: `${Math.round(step.distance)}m`,
            duracao: `${Math.round(step.duration)}s`,
            tipo: step.maneuver.type || "continue",
            modo: step.maneuver.modifier || 'straight'
          });
        }
      });
    });
    
    // Instrução de chegada
    if (trajetoCoords.length > 0) {
      instrucoes.push({
        latitude: trajetoCoords[trajetoCoords.length - 1].latitude,
        longitude: trajetoCoords[trajetoCoords.length - 1].longitude,
        instrucao: `Você chegou em ${destinoNome}`,
        distanciaAteProximo: "0m",
        duracao: "0s",
        tipo: "arrive",
        modo: "arrive"
      });
    }
    
    return instrucoes;
    
  } catch (error) {
    console.error("Erro ao gerar instruções:", error);
    return [];
  }
};

const AcoesCargas = ({ cargaSelecionada, onFechar, onConfirmar }) => {
  const [motoristas, setMotoristas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [carretas, setCarretas] = useState([]);
  const [busca, setBusca] = useState('');
  const [processando, setProcessando] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [gerandoInstrucoes, setGerandoInstrucoes] = useState(false);
  const [configurandoGeofence, setConfigurandoGeofence] = useState(false);

  useEffect(() => {
    // Listener Motoristas
    const qMot = query(
      collection(db, "cadastro_motoristas"), 
      where("status", "==", "ATIVO"), 
      orderBy("nome", "asc")
    );

    const unsubMot = onSnapshot(qMot, (snapshot) => {
      setMotoristas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setCarregando(false);
    }, () => setCarregando(false));

    // Listener Veículos (Cavalos)
    const unsubVeic = onSnapshot(collection(db, "cadastro_veiculos"), (snapshot) => {
      setVeiculos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listener Carretas
    const unsubCarr = onSnapshot(collection(db, "carretas"), (snapshot) => {
      setCarretas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubMot();
      unsubVeic();
      unsubCarr();
    };
  }, []);

  const getConjuntoMotorista = (motoristaId) => {
    if (!motoristaId) return null;
    const cavalo = veiculos.find(v => v.motorista_id === motoristaId);
    const carreta = carretas.find(c => c.motorista_id === motoristaId);
    return {
      cavalo: cavalo ? cavalo.placa : '---',
      carreta: carreta ? carreta.placa : '---'
    };
  };

  const desvincularCarga = async () => {
    if (!window.confirm(`Deseja remover o vínculo da DT ${cargaSelecionada?.dt}?\n\nIsso resetará o status da viagem.`)) return;
    setProcessando('desvincular');
    try {
      const q = query(collection(db, "notificacoes_cargas"), where("cargaId", "==", cargaSelecionada.id));
      const snapshot = await getDocs(q);
      await Promise.all(snapshot.docs.map(d => deleteDoc(doc(db, "notificacoes_cargas", d.id))));

      const cargaRef = doc(db, "ordens_servico", cargaSelecionada.id);
      await updateDoc(cargaRef, {
        motoristaId: "",
        motoristaNome: "",
        status: "AGUARDANDO PROGRAMAÇÃO",
        atribuidoEm: null,
        trajetoComInstrucoes: [],
        instrucaoAtual: 0,
        // Resetar status de finalização
        chegouAoDestino: false,
        finalizada: false,
        confirmacaoPendente: false,
        dataChegada: null,
        dataFinalizacao: null,
        dataInicioViagem: null
      });

      if (onConfirmar) await onConfirmar(null);
      onFechar();
      alert("✅ Vínculo removido com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao remover vínculo.");
    } finally {
      setProcessando(null);
    }
  };

  const configurarGeofenceParaCarga = async (cargaData) => {
    // Verificar se já tem geofence configurada
    if (cargaData.cercaVirtual?.centro) {
      return cargaData.cercaVirtual;
    }
    
    // Se não tem, tentar configurar automaticamente
    setConfigurandoGeofence(true);
    
    try {
      // Tentar obter coordenadas do destino
      let coordenadas = null;
      
      // Primeiro tentar pelo endereço do Google
      if (cargaData.destinoLink) {
        coordenadas = await obterCoordenadasDoEndereco(cargaData.destinoLink);
      }
      
      // Se não encontrou, tentar pela cidade
      if (!coordenadas && cargaData.destinoCidade) {
        const enderecoBusca = `${cargaData.destinoCliente || 'Destino'}, ${cargaData.destinoCidade}`;
        coordenadas = await obterCoordenadasDoEndereco(enderecoBusca);
      }
      
      const geofenceConfig = {
        tipo: 'circle',
        raio: cargaData.cercaVirtual?.raio || 100,
        centro: coordenadas,
        coordenadas: [],
        ativa: true
      };
      
      return geofenceConfig;
      
    } catch (error) {
      console.error("Erro ao configurar geofence:", error);
      // Retornar geofence básica
      return {
        tipo: 'circle',
        raio: 100,
        centro: null,
        coordenadas: [],
        ativa: true
      };
    } finally {
      setConfigurandoGeofence(false);
    }
  };

  const enviarCargaAoMotorista = async (motorista) => {
    setProcessando(motorista.id);
    setGerandoInstrucoes(true);
    setConfigurandoGeofence(true);
    
    try {
      const emailLimpo = motorista.email_app?.toLowerCase().trim() || "";
      const cargaId = cargaSelecionada?.id;
      const motoristaUID = motorista.uid || motorista.id;

      // CONFIGURAR GEOFENCE PARA A CARGA
      const geofenceConfig = await configurarGeofenceParaCarga(cargaSelecionada);
      
      // GERAR INSTRUÇÕES DA ROTA (se tiver trajeto)
      let instrucoesRota = [];
      let possuiRotogramaAudio = false;
      
      if (cargaSelecionada?.trajeto && cargaSelecionada.trajeto.length > 0) {
        // Se já tem instruções, usa as existentes
        if (cargaSelecionada.trajetoComInstrucoes && cargaSelecionada.trajetoComInstrucoes.length > 0) {
          instrucoesRota = cargaSelecionada.trajetoComInstrucoes;
          possuiRotogramaAudio = true;
        } else {
          // Gera novas instruções
          instrucoesRota = await gerarInstrucoesDeRota(
            cargaSelecionada.trajeto,
            cargaSelecionada.origemCliente || "Origem",
            cargaSelecionada.destinoCliente || "Destino"
          );
          possuiRotogramaAudio = instrucoesRota.length > 0;
        }
      }

      // Pegar placas atuais
      const conjunto = getConjuntoMotorista(motorista.id);

      // SALVAR NOTIFICAÇÃO COM INSTRUÇÕES E GEOFENCE
      const notificacaoRef = await addDoc(collection(db, "notificacoes_cargas"), {
        cargaId: cargaId || "N/A",
        motoristaId: motoristaUID,
        motoristaEmail: emailLimpo,
        motoristaNome: motorista.nome,
        dt: cargaSelecionada?.dt || "S/DT",
        cavalo: conjunto?.cavalo || "---",
        carreta: conjunto?.carreta || "---",
        peso: cargaSelecionada?.peso || "0",
        origem: cargaSelecionada?.origemCidade || "",
        destino: cargaSelecionada?.destinoCidade || "",
        clienteColeta: cargaSelecionada?.origemCliente || "",
        clienteEntrega: cargaSelecionada?.destinoCliente || "",
        observacao: cargaSelecionada?.observacao || "",
        tipoViagem: cargaSelecionada?.tipoViagem || "CARREGADO",
        linkColeta: cargaSelecionada?.origemLink || "",
        linkEntrega: cargaSelecionada?.destinoLink || "",
        trajetoComInstrucoes: instrucoesRota,
        possuiRotogramaAudio: possuiRotogramaAudio,
        cercaVirtual: geofenceConfig, // ADICIONAR GEOFENCE
        instrucaoAtual: 0,
        status: "pendente",
        vinculo: "FROTA",
        timestamp: serverTimestamp()
      });

      // ATUALIZAR A CARGA COM INSTRUÇÕES E GEOFENCE
      const cargaRef = doc(db, "ordens_servico", cargaId);
      await updateDoc(cargaRef, {
        motoristaId: motoristaUID,
        motoristaNome: motorista.nome,
        status: "PENDENTE ACEITE",
        trajetoComInstrucoes: instrucoesRota,
        possuiRotogramaAudio: possuiRotogramaAudio,
        cercaVirtual: geofenceConfig, // SALVAR GEOFENCE NA CARGA
        instrucaoAtual: 0,
        chegouAoDestino: false,
        finalizada: false,
        confirmacaoPendente: false,
        dataChegada: null,
        dataFinalizacao: null,
        dataInicioViagem: null,
        atribuidoEm: serverTimestamp()
      });

      // Montar mensagem informativa
      let mensagem = "✅ Carga enviada ao motorista!\n\n";
      
      if (possuiRotogramaAudio) {
        mensagem += `• ${instrucoesRota.length} instruções de navegação por áudio\n`;
      }
      
      if (geofenceConfig.ativa) {
        mensagem += "• Sistema de geofence ativado\n";
        if (geofenceConfig.centro) {
          mensagem += `• Cerca virtual configurada (raio: ${geofenceConfig.raio}m)`;
        } else {
          mensagem += "• Cerca virtual básica (sem coordenadas específicas)";
        }
      }
      
      mensagem += "\n\n📱 Fluxo da viagem no app do motorista:";
      mensagem += "\n1. Motorista aceita a viagem";
      mensagem += "\n2. Viagem inicia automaticamente";
      mensagem += "\n3. App detecta entrada na área de destino";
      mensagem += "\n4. Motorista confirma chegada";
      mensagem += "\n5. Viagem é finalizada automaticamente";
      
      alert(mensagem);

      if (onConfirmar) await onConfirmar({ id: motoristaUID, nome: motorista.nome });
      onFechar();
      
    } catch (e) {
      console.error(e);
      alert("❌ Erro ao enviar carga ao motorista.");
    } finally {
      setProcessando(null);
      setGerandoInstrucoes(false);
      setConfigurandoGeofence(false);
    }
  };

  const filtrados = motoristas.filter(m => 
    m.nome?.toLowerCase().includes(busca.toLowerCase()) || m.cpf?.includes(busca)
  );

  const possuiTrajeto = cargaSelecionada?.trajeto && cargaSelecionada.trajeto.length > 0;
  const possuiInstrucoes = cargaSelecionada?.trajetoComInstrucoes && cargaSelecionada.trajetoComInstrucoes.length > 0;
  const possuiGeofence = cargaSelecionada?.cercaVirtual?.ativa;
  const geofenceConfigurada = cargaSelecionada?.cercaVirtual?.centro;

  return (
    <div className="absolute inset-0 z-[50] flex flex-col bg-[#0a0a0a] rounded-[8px] border-2 border-yellow-500/30 overflow-hidden">
      
      <div className="p-4 border-b border-white/5 bg-gradient-to-r from-yellow-500/10 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center">
            <User size={20} className="text-black" />
          </div>
          <div>
            <h2 className="text-white text-xs font-bold uppercase tracking-widest">Atribuir Viagem ao Motorista</h2>
            <div className="flex items-center gap-2">
               <span className="text-yellow-500 text-[10px] font-black uppercase">DT {cargaSelecionada?.dt}</span>
               <span className="text-zinc-500 text-[10px]">➔</span>
               <span className="text-zinc-400 text-[10px] font-bold uppercase">{cargaSelecionada?.destinoCliente}</span>
            </div>
            
            {/* INFO DA VIAGEM */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {possuiTrajeto && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded ${possuiInstrucoes ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                  {possuiInstrucoes ? (
                    <>
                      <Volume2 size={10} />
                      <span className="text-[8px] font-bold">{cargaSelecionada.trajetoComInstrucoes?.length || 0} instruções de áudio</span>
                    </>
                  ) : (
                    <>
                      <Map size={10} />
                      <span className="text-[8px] font-bold">Trajeto disponível (sem áudio)</span>
                    </>
                  )}
                </div>
              )}
              
              {possuiGeofence && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded ${geofenceConfigurada ? 'bg-blue-500/10 text-blue-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                  {geofenceConfigurada ? (
                    <>
                      <Target size={10} />
                      <span className="text-[8px] font-bold">Cerca virtual ativa ({cargaSelecionada.cercaVirtual.raio}m)</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={10} />
                      <span className="text-[8px] font-bold">Cerca virtual básica</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <button onClick={onFechar} className="p-2 hover:bg-white/10 rounded-full text-zinc-500">
          <X size={20} />
        </button>
      </div>

      {/* INFO DO FLUXO */}
      <div className="p-3 bg-gradient-to-r from-blue-500/5 to-transparent border-b border-blue-500/10">
        <div className="flex items-start gap-2">
          <Shield size={14} className="text-blue-400 mt-0.5" />
          <div>
            <h4 className="text-[10px] font-bold text-blue-400 uppercase">FLUXO AUTOMÁTICO DE FINALIZAÇÃO</h4>
            <p className="text-[9px] text-zinc-400">
              A viagem será finalizada automaticamente quando o motorista entrar na área de destino e confirmar a chegada.
            </p>
          </div>
        </div>
      </div>

      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
          <input 
            type="text"
            placeholder="Pesquisar motorista na frota..."
            className="w-full bg-white/[0.03] border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white text-xs outline-none focus:border-yellow-500/50"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 grid grid-cols-2 gap-2 custom-scrollbar">
        {carregando ? (
          <div className="col-span-2 flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtrados.map((mot) => {
          const conjunto = getConjuntoMotorista(mot.id);
          return (
            <button
              key={mot.id}
              onClick={() => enviarCargaAoMotorista(mot)}
              disabled={processando || gerandoInstrucoes || configurandoGeofence}
              className="flex items-center justify-between p-3 bg-white/[0.02] hover:bg-yellow-500/20 group rounded-xl border border-white/5 transition-all relative overflow-hidden"
            >
              {processando === mot.id && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl z-10">
                  <div className="text-center">
                    <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-[8px] text-white">
                      {configurandoGeofence ? 'Configurando geofence...' : 
                       gerandoInstrucoes ? 'Gerando instruções...' : 
                       'Enviando carga...'}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="text-left overflow-hidden flex-1">
                <h4 className="text-zinc-100 font-bold text-[11px] uppercase truncate group-hover:text-yellow-400">{mot.nome}</h4>
                <div className="flex flex-col mt-1 gap-1">
                  <div className="flex items-center gap-1 text-[9px] text-zinc-500 group-hover:text-zinc-300 font-medium">
                    <MapPin size={10} /> {mot.cidade || 'Base'}
                  </div>
                  {conjunto && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[8px] text-yellow-500/70 group-hover:text-yellow-300 font-bold">
                        <Truck size={10} /> {conjunto.cavalo}
                      </span>
                      <span className="flex items-center gap-1 text-[8px] text-blue-400/70 group-hover:text-blue-300 font-bold">
                        <Container size={10} /> {conjunto.carreta}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {processando !== mot.id ? (
                <ArrowRight size={14} className="text-yellow-500 group-hover:text-yellow-300 flex-shrink-0" />
              ) : null}
            </button>
          );
        })}
      </div>

      {cargaSelecionada?.motoristaNome && (
        <div className="p-3 bg-gradient-to-r from-red-500/5 to-transparent border-t border-red-500/10 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] text-red-500/60 font-black uppercase">Vinculado a:</span>
            <span className="text-[11px] text-red-500 font-bold uppercase">{cargaSelecionada.motoristaNome}</span>
            <span className="text-[9px] text-red-400/50 mt-1">
              Status: {cargaSelecionada.status || 'AGUARDANDO ACEITE'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.confirm(`Deseja ver os detalhes da atribuição para ${cargaSelecionada.motoristaNome}?`)) {
                  let detalhes = `Motorista: ${cargaSelecionada.motoristaNome}\n`;
                  detalhes += `DT: ${cargaSelecionada.dt}\n`;
                  detalhes += `Status: ${cargaSelecionada.status}\n`;
                  detalhes += `Destino: ${cargaSelecionada.destinoCliente}\n`;
                  
                  if (cargaSelecionada.cercaVirtual?.ativa) {
                    detalhes += `\nGeofence: ATIVA\n`;
                    detalhes += `Raio: ${cargaSelecionada.cercaVirtual.raio}m\n`;
                    if (cargaSelecionada.cercaVirtual.centro) {
                      detalhes += `Centro: ${cargaSelecionada.cercaVirtual.centro.lat?.toFixed(6)}, ${cargaSelecionada.cercaVirtual.centro.lng?.toFixed(6)}`;
                    }
                  }
                  
                  alert(detalhes);
                }
              }}
              className="bg-blue-500/10 text-blue-400 p-2 rounded-lg hover:bg-blue-500/20 transition-colors"
              title="Ver detalhes"
            >
              <Bell size={16} />
            </button>
            <button
              onClick={desvincularCarga}
              className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-colors"
              disabled={processando}
              title="Desvincular motorista"
            >
              {processando === 'desvincular' ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
            </button>
          </div>
        </div>
      )}

      {/* RODAPÉ INFORMATIVO */}
      <div className="p-3 bg-gradient-to-r from-green-500/5 to-transparent border-t border-green-500/10">
        <div className="flex items-start gap-2">
          <div className="bg-green-500/10 p-1 rounded">
            <Navigation size={12} className="text-green-400" />
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-green-400 uppercase">VIAGEM AUTOMÁTICA</h4>
            <p className="text-[9px] text-zinc-400">
              Após aceite do motorista, a viagem inicia automaticamente. A finalização ocorre apenas com confirmação do motorista dentro da área de destino.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #eab308; }
      `}</style>
    </div>
  );
};

export default AcoesCargas;