import React, { useState, useEffect } from 'react';
import { XCircle, Search, User, UserMinus } from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, onSnapshot, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';

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

  // Escuta motoristas ativos
  useEffect(() => {
    const q = query(
      collection(db, "cadastro_motoristas"), 
      where("status", "==", "ATIVO"), 
      orderBy("nome", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = [];
      snapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() });
      });
      setMotoristas(lista);
      setCarregando(false);
    }, (error) => {
      console.error("Erro ao buscar motoristas:", error);
      setCarregando(false);
    });

    return () => unsubscribe();
  }, []);

  // FUNÇÃO PARA DESASSOCIAR MOTORISTA
  const desvincularCarga = async () => {
    const confirmar = window.confirm(`Deseja remover o motorista atual da DT ${cargaSelecionada?.dt}?`);
    if (!confirmar) return;

    setProcessando('desvincular');
    try {
      // 1. Remove a notificação do banco para o motorista não ver mais no App
      const q = query(
        collection(db, "notificacoes_cargas"), 
        where("cargaId", "==", cargaSelecionada.id)
      );
      
      const querySnapshot = await getDocs(q);
      const promessas = [];
      querySnapshot.forEach((documento) => {
        promessas.push(deleteDoc(doc(db, "notificacoes_cargas", documento.id)));
      });
      await Promise.all(promessas);

      // 2. Avisa o componente pai que agora a carga está sem motorista
      if (onConfirmar) {
        await onConfirmar(null); 
      }
      
      alert("Motorista desassociado com sucesso!");
      onFechar();
    } catch (error) {
      console.error("Erro ao desvincular:", error);
      alert("Erro ao remover vínculo.");
    } finally {
      setProcessando(null);
    }
  };

  const enviarCargaAoMotorista = async (motorista) => {
    setProcessando(motorista.id);
    try {
      await addDoc(collection(db, "notificacoes_cargas"), {
        cargaId: cargaSelecionada?.id || "N/A",
        dt: cargaSelecionada?.dt || "S/DT",
        vinculo: "FROTA",
        motoristaId: motorista.uid || motorista.id,
        motoristaNome: motorista.nome,
        status: "pendente",
        timestamp: serverTimestamp()
      });

      if (onConfirmar) {
        await onConfirmar({ id: motorista.id, nome: motorista.nome });
      }
      onFechar();
    } catch  {
      alert("Erro ao enviar.");
    } finally {
      setProcessando(null);
    }
  };

  const filtrados = motoristas.filter(m => 
    m.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    m.cpf?.includes(busca)
  );

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[9999] p-2">
      <div className="bg-[#111] border border-yellow-500/30 w-full max-w-5xl rounded-lg flex flex-col max-h-[80vh] shadow-[0_0_20px_rgba(234,179,8,0.1)]">
        
        {/* Header Amarelo */}
        <div className="p-2 px-4 border-b border-zinc-800 flex justify-between items-center bg-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <span className="bg-yellow-500 text-black text-[10px] font-black px-2 py-0.5 rounded">VINCULAR</span>
            <h2 className="text-zinc-200 font-bold text-[11px] uppercase tracking-wider">
              DT: <span className="text-yellow-500">{cargaSelecionada?.dt}</span>
            </h2>
          </div>
          <button onClick={onFechar} className="text-zinc-500 hover:text-yellow-500">
            <XCircle size={18} />
          </button>
        </div>

        {/* BOTÃO DESASSOCIAR - Só aparece se a carga já tiver motorista */}
        {cargaSelecionada?.motoristaNome && (
          <div className="p-2 bg-red-950/20 border-b border-red-500/30 flex items-center justify-between px-4">
            <div className="text-[10px] text-zinc-400 uppercase">
              Atual: <span className="text-white font-bold">{cargaSelecionada.motoristaNome}</span>
            </div>
            <button 
              onClick={desvincularCarga}
              disabled={processando === 'desvincular'}
              className="bg-red-600 hover:bg-red-500 text-white text-[9px] font-black py-1 px-3 rounded flex items-center gap-2 transition-all"
            >
              <UserMinus size={12} />
              {processando === 'desvincular' ? "REMOVENDO..." : "DESASSOCIAR MOTORISTA"}
            </button>
          </div>
        )}

        {/* Busca Slim */}
        <div className="p-2 bg-zinc-900/50 flex items-center gap-2 border-b border-zinc-800">
          <Search size={14} className="text-yellow-500 ml-2" />
          <input 
            type="text"
            placeholder="Substituir ou pesquisar motorista..."
            className="flex-1 bg-transparent border-none text-white text-[12px] focus:ring-0 placeholder:text-zinc-600 uppercase"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {/* Grid Compacto */}
        <div className="flex-1 overflow-y-auto p-3 bg-[#0d0d0d] custom-scrollbar">
          {carregando ? (
            <div className="text-center py-10 text-yellow-500 text-[10px] animate-pulse">CARREGANDO...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5">
              {filtrados.map((mot) => (
                <button
                  key={mot.id}
                  onClick={() => enviarCargaAoMotorista(mot)}
                  disabled={processando}
                  className="flex items-center justify-between p-1.5 bg-zinc-900/80 border border-zinc-800 rounded hover:border-yellow-500 hover:bg-yellow-500/10 transition-all group text-left"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-zinc-300 group-hover:text-yellow-500 text-[10px] font-bold uppercase truncate leading-tight">
                      {mot.nome?.split(' ').slice(0, 2).join(' ')}
                    </span>
                    <span className="text-zinc-600 text-[8px] truncate uppercase">
                      {mot.cidade || '---'}
                    </span>
                  </div>
                  <div className="shrink-0">
                    <div className="w-4 h-4 rounded bg-zinc-800 flex items-center justify-center group-hover:bg-yellow-500">
                      <User size={8} className="text-zinc-500 group-hover:text-black" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-1.5 bg-[#1a1a1a] border-t border-zinc-800 text-center">
            <button onClick={onFechar} className="text-zinc-500 hover:text-white text-[9px] font-black uppercase">
              [ FECHAR ]
            </button>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #eab308; }
      `}</style>
    </div>
  );
};

export default AcoesCargas;