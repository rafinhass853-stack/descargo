import React, { useState, useEffect } from 'react';
import { X, Search, User, MapPin, CheckCircle2, Navigation } from 'lucide-react';
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
      const emailLimpo = motorista.email?.toLowerCase().trim() || "";

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
    } catch {
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
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onFechar} />

      <div className="relative w-full max-w-[460px] bg-[#0c0c0e] border border-white/10 rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* HEADER */}
        <div className="p-8 pb-4 flex flex-col items-center">
          <div className="w-14 h-14 bg-yellow-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-yellow-500/20">
            <Navigation className="text-black" size={24} />
          </div>
          <h2 className="text-white text-xl font-black uppercase italic">Enviar para Motorista</h2>
          <span className="mt-1 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-zinc-400 font-bold uppercase">
            DT: {cargaSelecionada?.dt}
          </span>
        </div>

        {/* BUSCA */}
        <div className="px-8 py-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
            <input 
              type="text"
              placeholder="Pesquisar motorista..."
              className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-xs focus:border-yellow-500/50 outline-none uppercase"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        {/* LISTA */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
          {carregando ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {filtrados.map((mot) => (
                <button
                  key={mot.id}
                  onClick={() => enviarCargaAoMotorista(mot)}
                  disabled={processando}
                  className="w-full flex items-center justify-between p-4 bg-white/[0.03] hover:bg-yellow-500 rounded-2xl border border-white/5 hover:border-yellow-400 transition-all group active:scale-[0.97]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-zinc-900 flex items-center justify-center group-hover:bg-black">
                      <User size={18} className="text-zinc-500 group-hover:text-yellow-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-zinc-100 font-bold text-xs uppercase group-hover:text-black">
                        {mot.nome}
                      </p>
                      <div className="flex items-center gap-1 text-zinc-500 group-hover:text-black/70">
                        <MapPin size={10} />
                        <span className="text-[9px] font-bold uppercase">
                          {mot.cidade || 'Base'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {processando === mot.id ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <div className="px-4 py-2 bg-black text-yellow-400 text-[9px] font-black rounded-xl uppercase shadow-lg">
                      Enviar
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-6 bg-white/[0.02] border-t border-white/5">
          {cargaSelecionada?.motoristaNome ? (
            <div className="flex flex-col gap-3">
              <p className="text-[10px] text-center text-red-400 font-bold uppercase">
                Vinculado a: {cargaSelecionada.motoristaNome}
              </p>
              <button
                onClick={desvincularCarga}
                className="w-full py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all border border-red-500/20"
              >
                Remover Vínculo
              </button>
            </div>
          ) : (
            <button
              onClick={onFechar}
              className="w-full py-3 bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all"
            >
              Fechar Janela
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #eab308; }
      `}</style>
    </div>
  );
};

export default AcoesCargas;
