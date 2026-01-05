import React, { useState, useEffect } from 'react';
// Adicionado 'Map' aos imports para evitar erro de referência
import { X, Search, User, MapPin, Navigation, ArrowRight, Bell, Trash2, Truck, Container, Target, Shield, AlertCircle, Map, Navigation as RouteIcon } from 'lucide-react';
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

const GOOGLE_MAPS_API_KEY = 'AIzaSyDT5OptLHwnCVPuevN5Ie8SFWxm4mRPAl4';

const obterCoordenadasDoEndereco = async (endereco) => {
  if (!endereco) return null;
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(endereco)}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }
  } catch (error) {
    console.error("Erro ao buscar coordenadas:", error);
  }
  return null;
};

const AcoesCargas = ({ cargaSelecionada, onFechar, onConfirmar }) => {
  const [motoristas, setMotoristas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [carretas, setCarretas] = useState([]);
  const [busca, setBusca] = useState('');
  const [processando, setProcessando] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [configurandoGeofence, setConfigurandoGeofence] = useState(false);

  useEffect(() => {
    const qMot = query(
      collection(db, "cadastro_motoristas"), 
      where("status", "==", "ATIVO"), 
      orderBy("nome", "asc")
    );

    const unsubMot = onSnapshot(qMot, (snapshot) => {
      setMotoristas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setCarregando(false);
    }, () => setCarregando(false));

    const unsubVeic = onSnapshot(collection(db, "cadastro_veiculos"), (snapshot) => {
      setVeiculos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

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
    if (cargaData.cercaVirtual?.centro) return cargaData.cercaVirtual;
    setConfigurandoGeofence(true);
    try {
      let coordenadas = null;
      if (cargaData.destinoLink) {
        coordenadas = await obterCoordenadasDoEndereco(cargaData.destinoLink);
      }
      if (!coordenadas && cargaData.destinoCidade) {
        const enderecoBusca = `${cargaData.destinoCliente || 'Destino'}, ${cargaData.destinoCidade}`;
        coordenadas = await obterCoordenadasDoEndereco(enderecoBusca);
      }
      return {
        tipo: 'circle',
        raio: cargaData.cercaVirtual?.raio || 100,
        centro: coordenadas,
        coordenadas: [],
        ativa: true
      };
    } catch (error) {
      console.error("Erro ao configurar geofence:", error);
      return { tipo: 'circle', raio: 100, centro: null, coordenadas: [], ativa: true };
    } finally {
      setConfigurandoGeofence(false);
    }
  };

  const enviarCargaAoMotorista = async (motorista) => {
    setProcessando(motorista.id);
    setConfigurandoGeofence(true);
    try {
      const emailLimpo = motorista.email_app?.toLowerCase().trim() || "";
      const cargaId = cargaSelecionada?.id;
      const motoristaUID = motorista.uid || motorista.id;
      const geofenceConfig = await configurarGeofenceParaCarga(cargaSelecionada);
      const conjunto = getConjuntoMotorista(motorista.id);

      await addDoc(collection(db, "notificacoes_cargas"), {
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
        destinoCoordenadas: geofenceConfig.centro,
        temRotaAutomatica: true,
        cercaVirtual: geofenceConfig,
        instrucaoAtual: 0,
        status: "pendente",
        vinculo: "FROTA",
        timestamp: serverTimestamp()
      });

      const cargaRef = doc(db, "ordens_servico", cargaId);
      await updateDoc(cargaRef, {
        motoristaId: motoristaUID,
        motoristaNome: motorista.nome,
        status: "PENDENTE ACEITE",
        destinoCoordenadas: geofenceConfig.centro,
        temRotaAutomatica: true,
        cercaVirtual: geofenceConfig,
        instrucaoAtual: 0,
        chegouAoDestino: false,
        finalizada: false,
        confirmacaoPendente: false,
        dataChegada: null,
        dataFinalizacao: null,
        dataInicioViagem: null,
        atribuidoEm: serverTimestamp()
      });

      alert("✅ Carga enviada com sucesso ao motorista!");
      if (onConfirmar) await onConfirmar({ id: motoristaUID, nome: motorista.nome });
      onFechar();
    } catch (e) {
      console.error(e);
      alert("❌ Erro ao enviar carga.");
    } finally {
      setProcessando(null);
      setConfigurandoGeofence(false);
    }
  };

  const filtrados = motoristas.filter(m => 
    m.nome?.toLowerCase().includes(busca.toLowerCase()) || m.cpf?.includes(busca)
  );

  const possuiTrajeto = cargaSelecionada?.trajeto && cargaSelecionada.trajeto.length > 0;
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
            <h2 className="text-white text-xs font-bold uppercase tracking-widest">Atribuir Viagem</h2>
            <div className="flex items-center gap-2">
               <span className="text-yellow-500 text-[10px] font-black uppercase">DT {cargaSelecionada?.dt}</span>
               <span className="text-zinc-500 text-[10px]">➔</span>
               <span className="text-zinc-400 text-[10px] font-bold uppercase">{cargaSelecionada?.destinoCliente}</span>
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
            <h4 className="text-[10px] font-bold text-blue-400 uppercase">FLUXO AUTOMÁTICO</h4>
            <p className="text-[9px] text-zinc-400">Finalização automática via geofence no destino.</p>
          </div>
        </div>
      </div>

      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
          <input 
            type="text"
            placeholder="Pesquisar motorista..."
            className="w-full bg-white/[0.03] border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white text-xs outline-none"
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
              disabled={processando || configurandoGeofence}
              className="flex items-center justify-between p-3 bg-white/[0.02] hover:bg-yellow-500/20 group rounded-xl border border-white/5 transition-all relative"
            >
              <div className="text-left overflow-hidden flex-1">
                <h4 className="text-zinc-100 font-bold text-[11px] uppercase truncate group-hover:text-yellow-400">{mot.nome}</h4>
                <div className="flex flex-col mt-1 gap-1">
                  <div className="flex items-center gap-1 text-[9px] text-zinc-500 group-hover:text-zinc-300 font-medium">
                    <MapPin size={10} /> {mot.cidade || 'Base'}
                  </div>
                  {conjunto && (
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] text-yellow-500/70 font-bold"><Truck size={10} className="inline mr-1"/>{conjunto.cavalo}</span>
                      <span className="text-[8px] text-blue-400/70 font-bold"><Container size={10} className="inline mr-1"/>{conjunto.carreta}</span>
                    </div>
                  )}
                </div>
              </div>
              <ArrowRight size={14} className="text-yellow-500" />
            </button>
          );
        })}
      </div>

      {cargaSelecionada?.motoristaNome && (
        <div className="p-3 bg-red-500/5 border-t border-red-500/10 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] text-red-500 font-black uppercase">Vinculado:</span>
            <span className="text-[11px] text-white font-bold">{cargaSelecionada.motoristaNome}</span>
          </div>
          <button onClick={desvincularCarga} className="bg-red-500 text-white p-2 rounded-lg">
            <Trash2 size={16} />
          </button>
        </div>
      )}

      {/* ROTA AUTOMÁTICA */}
      <div className="p-3 bg-purple-500/5 border-t border-purple-500/10">
        <div className="flex items-start gap-2">
          <div className="bg-purple-500/10 p-1 rounded">
            <Map size={12} className="text-purple-400" />
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-purple-400 uppercase">ROTA AUTOMÁTICA</h4>
            <p className="text-[9px] text-zinc-400">Cálculo de trajeto automático ativado para esta viagem.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcoesCargas;