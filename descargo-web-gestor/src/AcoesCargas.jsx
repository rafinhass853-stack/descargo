import React, { useState, useEffect } from 'react';
import { X, Search, User, MapPin, Navigation, ArrowRight, Bell, Trash2, Truck, Container } from 'lucide-react';
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

const AcoesCargas = ({ cargaSelecionada, onFechar, onConfirmar }) => {
  const [motoristas, setMotoristas] = useState([]);
  const [veiculos, setVeiculos] = useState([]); // Novo estado para cavalos
  const [carretas, setCarretas] = useState([]); // Novo estado para carretas
  const [busca, setBusca] = useState('');
  const [processando, setProcessando] = useState(null);
  const [carregando, setCarregando] = useState(true);

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

  // Função para buscar o conjunto de placas do motorista
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
    if (!window.confirm(`Deseja remover o vínculo da DT ${cargaSelecionada?.dt}?`)) return;
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
        atribuidoEm: null
      });

      if (onConfirmar) await onConfirmar(null);
      onFechar();
    } catch (e) {
      console.error(e);
      alert("Erro ao remover vínculo.");
    } finally {
      setProcessando(null);
    }
  };

  const enviarCargaAoMotorista = async (motorista) => {
    setProcessando(motorista.id);
    try {
      const emailLimpo = motorista.email_app?.toLowerCase().trim() || "";
      const cargaId = cargaSelecionada?.id;
      const motoristaUID = motorista.uid || motorista.id;

      // Pegar placas atuais para enviar na notificação
      const conjunto = getConjuntoMotorista(motorista.id);

      await addDoc(collection(db, "notificacoes_cargas"), {
        cargaId: cargaId || "N/A",
        motoristaId: motoristaUID,
        motoristaEmail: emailLimpo,
        motoristaNome: motorista.nome,
        dt: cargaSelecionada?.dt || "S/DT",
        cavalo: conjunto?.cavalo || "---", // Enviando placa do cavalo
        carreta: conjunto?.carreta || "---", // Enviando placa da carreta
        peso: cargaSelecionada?.peso || "0",
        origem: cargaSelecionada?.origemCidade || "",
        destino: cargaSelecionada?.destinoCidade || "",
        clienteColeta: cargaSelecionada?.origemCliente || "",
        clienteEntrega: cargaSelecionada?.destinoCliente || "",
        observacao: cargaSelecionada?.observacao || "",
        tipoViagem: cargaSelecionada?.tipoViagem || "CARREGADO",
        linkColeta: cargaSelecionada?.origemLink || "",
        linkEntrega: cargaSelecionada?.destinoLink || "",
        status: "pendente",
        vinculo: "FROTA",
        timestamp: serverTimestamp()
      });

      const cargaRef = doc(db, "ordens_servico", cargaId);
      await updateDoc(cargaRef, {
        motoristaId: motoristaUID,
        motoristaNome: motorista.nome,
        status: "PENDENTE ACEITE",
        atribuidoEm: serverTimestamp()
      });

      if (onConfirmar) await onConfirmar({ id: motoristaUID, nome: motorista.nome });
      onFechar();
    } catch (e) {
      console.error(e);
      alert("Erro ao enviar carga.");
    } finally {
      setProcessando(null);
    }
  };

  const filtrados = motoristas.filter(m => 
    m.nome?.toLowerCase().includes(busca.toLowerCase()) || m.cpf?.includes(busca)
  );

  return (
    <div className="absolute inset-0 z-[50] flex flex-col bg-[#0a0a0a] rounded-[8px] border-2 border-yellow-500/30 overflow-hidden">
      
      <div className="p-4 border-b border-white/5 bg-gradient-to-r from-yellow-500/10 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center">
            <User size={20} className="text-black" />
          </div>
          <div>
            <h2 className="text-white text-xs font-bold uppercase tracking-widest">Selecionar Motorista</h2>
            <div className="flex items-center gap-2">
               <span className="text-yellow-500 text-[10px] font-black uppercase">DT {cargaSelecionada?.dt}</span>
               <span className="text-zinc-500 text-[10px]">➔</span>
               <span className="text-zinc-400 text-[10px] font-bold uppercase">{cargaSelecionada?.destinoCidade}</span>
            </div>
          </div>
        </div>
        <button onClick={onFechar} className="p-2 hover:bg-white/10 rounded-full text-zinc-500">
          <X size={20} />
        </button>
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
              disabled={processando}
              className="flex items-center justify-between p-3 bg-white/[0.02] hover:bg-yellow-500 group rounded-xl border border-white/5 transition-all"
            >
              <div className="text-left overflow-hidden flex-1">
                <h4 className="text-zinc-100 font-bold text-[11px] uppercase truncate group-hover:text-black">{mot.nome}</h4>
                <div className="flex flex-col mt-1 gap-1">
                  <div className="flex items-center gap-1 text-[9px] text-zinc-500 group-hover:text-black/70 font-medium">
                    <MapPin size={10} /> {mot.cidade || 'Base'}
                  </div>
                  {conjunto && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[8px] text-yellow-500/70 group-hover:text-black/80 font-bold">
                        <Truck size={10} /> {conjunto.cavalo}
                      </span>
                      <span className="flex items-center gap-1 text-[8px] text-blue-400/70 group-hover:text-black/80 font-bold">
                        <Container size={10} /> {conjunto.carreta}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {processando === mot.id ? (
                 <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                 <ArrowRight size={14} className="text-yellow-500 group-hover:text-black" />
              )}
            </button>
          );
        })}
      </div>

      {cargaSelecionada?.motoristaNome && (
        <div className="p-3 bg-red-500/5 border-t border-red-500/10 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] text-red-500/60 font-black uppercase">Vinculado a:</span>
            <span className="text-[11px] text-red-500 font-bold uppercase">{cargaSelecionada.motoristaNome}</span>
          </div>
          <button
            onClick={desvincularCarga}
            className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}

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