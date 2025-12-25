import React, { useState, useEffect } from 'react';
import { X, Search, User, MapPin, Navigation, ArrowRight, Bell, Trash2 } from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, serverTimestamp, 
  onSnapshot, query, where, orderBy, getDocs, deleteDoc, doc 
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
  const [busca, setBusca] = useState('');
  const [processando, setProcessando] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "cadastro_motoristas"), 
      where("status", "==", "ATIVO"), 
      orderBy("nome", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMotoristas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setCarregando(false);
    }, () => setCarregando(false));

    return () => unsubscribe();
  }, []);

  const desvincularCarga = async () => {
    if (!window.confirm(`Deseja remover o vínculo da DT ${cargaSelecionada?.dt}?`)) return;
    setProcessando('desvincular');
    try {
      const q = query(collection(db, "notificacoes_cargas"), where("cargaId", "==", cargaSelecionada.id));
      const snapshot = await getDocs(q);
      await Promise.all(snapshot.docs.map(d => deleteDoc(doc(db, "notificacoes_cargas", d.id))));
      if (onConfirmar) await onConfirmar(null);
      onFechar();
    } catch {
      alert("Erro ao remover vínculo.");
    } finally {
      setProcessando(null);
    }
  };

  const enviarCargaAoMotorista = async (motorista) => {
    setProcessando(motorista.id);
    try {
      const emailLimpo = motorista.email_app?.toLowerCase().trim() || "";

      await addDoc(collection(db, "notificacoes_cargas"), {
        cargaId: cargaSelecionada?.id || "N/A",
        motoristaId: motorista.uid || motorista.id,
        motoristaEmail: emailLimpo,
        motoristaNome: motorista.nome,
        dt: cargaSelecionada?.dt || "S/DT",
        carreta: cargaSelecionada?.carreta || "Não Informada",
        peso: cargaSelecionada?.peso || "0",
        origem: cargaSelecionada?.origem || "",
        destino: cargaSelecionada?.destino || "",
        clienteColeta: cargaSelecionada?.clienteColeta || "",
        clienteEntrega: cargaSelecionada?.clienteEntrega || "",
        observacao: cargaSelecionada?.observacao || "",
        tipoViagem: cargaSelecionada?.tipoViagem || "CARREGADO",
        linkColeta: cargaSelecionada?.linkColeta || "",
        linkEntrega: cargaSelecionada?.linkEntrega || "",
        status: "pendente",
        vinculo: "FROTA",
        timestamp: serverTimestamp()
      });

      if (onConfirmar) await onConfirmar({ id: motorista.id, nome: motorista.nome });
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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop mais denso para foco total */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onFechar} />

      <div className="relative w-full max-w-[480px] bg-[#111] border border-white/10 rounded-[24px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* HEADER ESTILIZADO */}
        <div className="relative p-6 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
          <button 
            onClick={onFechar}
            className="absolute right-4 top-4 p-2 hover:bg-white/10 rounded-full text-zinc-500 transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-500 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Bell className="text-black" size={24} />
            </div>
            <div>
              <h2 className="text-white text-lg font-bold tracking-tight">Despachar Carga</h2>
              <div className="flex items-center gap-2">
                <span className="text-yellow-500 text-[11px] font-black uppercase tracking-wider">DT {cargaSelecionada?.dt}</span>
                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                <span className="text-zinc-500 text-[11px] font-medium uppercase">{cargaSelecionada?.destino}</span>
              </div>
            </div>
          </div>
        </div>

        {/* PESQUISA COM UI LIMPA */}
        <div className="px-6 py-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-yellow-500 transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Buscar por nome ou CPF..."
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white text-sm focus:border-yellow-500/50 focus:bg-white/[0.05] outline-none transition-all"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        {/* LISTA DE MOTORISTAS */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-3 custom-scrollbar">
          {carregando ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Carregando Frota...</span>
            </div>
          ) : filtrados.length > 0 ? (
            filtrados.map((mot) => (
              <button
                key={mot.id}
                onClick={() => enviarCargaAoMotorista(mot)}
                disabled={processando}
                className="w-full group flex items-center justify-between p-4 bg-white/[0.02] hover:bg-yellow-500 rounded-2xl border border-white/5 hover:border-yellow-400 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-4 text-left">
                  <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                    <User size={20} className="text-zinc-400 group-hover:text-black" />
                  </div>
                  <div>
                    <h4 className="text-zinc-100 font-bold text-sm uppercase group-hover:text-black transition-colors">
                      {mot.nome}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-1 text-zinc-500 group-hover:text-black/60 transition-colors">
                        <MapPin size={12} />
                        <span className="text-[10px] font-bold uppercase">{mot.cidade || 'Base'}</span>
                      </div>
                      <span className="text-zinc-800 group-hover:text-black/20">|</span>
                      <span className="text-[10px] text-zinc-500 group-hover:text-black/60 font-medium uppercase tracking-tighter">CNH {mot.cnh_cat}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  {processando === mot.id ? (
                    <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-yellow-500 group-hover:bg-white group-hover:text-yellow-600 shadow-xl opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all">
                      <ArrowRight size={20} />
                    </div>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-10">
              <p className="text-zinc-600 text-xs font-bold uppercase italic">Nenhum motorista ativo encontrado</p>
            </div>
          )}
        </div>

        {/* FOOTER - STATUS DE VÍNCULO */}
        {cargaSelecionada?.motoristaNome && (
          <div className="mx-6 mb-6 p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] text-red-500/60 font-black uppercase tracking-widest">Já vinculado a:</span>
              <span className="text-xs text-red-500 font-bold uppercase">{cargaSelecionada.motoristaNome}</span>
            </div>
            <button
              onClick={desvincularCarga}
              disabled={processando === 'desvincular'}
              className="p-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
              title="Remover Vínculo"
            >
              {processando === 'desvincular' ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
            </button>
          </div>
        )}

      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #eab308; }
      `}</style>
    </div>
  );
};

export default AcoesCargas;