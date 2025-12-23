import React, { useState, useEffect } from 'react';
import { User, XCircle, Search } from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, onSnapshot, query, where, orderBy } from 'firebase/firestore';

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
  const [enviando, setEnviando] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // Escuta a coleção 'cadastro_motoristas' em tempo real
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

  const enviarCargaAoMotorista = async (motorista) => {
    setEnviando(motorista.id);
    try {
      // 1. Cria a notificação com o MODELO COMPLETO para o App
      await addDoc(collection(db, "notificacoes_cargas"), {
        // Dados Identificadores
        cargaId: cargaSelecionada?.id || "N/A",
        dt: cargaSelecionada?.dt || "S/DT",
        vinculo: "FROTA",
        
        // Dados do Veículo e Carga
        peso: cargaSelecionada?.peso || "Não informado",
        carreta: cargaSelecionada?.tipoVeiculo || "Não informada",
        cavalo: "Verificar Cadastro", // Pode ser puxado se houver campo no motorista
        
        // Dados da Coleta (Origem)
        clienteColeta: cargaSelecionada?.origemCliente || "Não informado",
        origem: cargaSelecionada?.origemCidade || "Não informada",
        dataColeta: cargaSelecionada?.origemData || "Não informada",
        linkColeta: cargaSelecionada?.origemLink || "", // Link para o GPS
        
        // Dados da Entrega (Destino)
        clienteEntrega: cargaSelecionada?.destinoCliente || "Não informado",
        destino: cargaSelecionada?.destinoCidade || "Não informada",
        dataEntrega: cargaSelecionada?.destinoData || "Não informada",
        linkEntrega: cargaSelecionada?.destinoLink || "Considerar endereço da NF",
        
        // Dados do Motorista (para registro na notificação)
        motoristaId: motorista.uid || motorista.id,
        motoristaEmail: motorista.email_app, 
        motoristaNome: motorista.nome,
        motoristaCPF: motorista.cpf || "Não informado",
        
        // Outros
        observacao: cargaSelecionada?.observacoes || "",
        status: "pendente",
        lido: false,
        timestamp: serverTimestamp()
      });

      // 2. Atualiza o status no Painel de Cargas (muda para PROGRAMADA)
      if (onConfirmar) {
        await onConfirmar({
          id: motorista.id,
          nome: motorista.nome
        });
      }
      
      alert(`Carga DT ${cargaSelecionada?.dt} enviada com sucesso para ${motorista.nome}!`);
      onFechar();
    } catch (error) {
      console.error("Erro ao enviar:", error);
      alert("Erro ao processar envio. Verifique a conexão.");
    } finally {
      setEnviando(null);
    }
  };

  const filtrados = motoristas.filter(m => 
    m.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    m.cpf?.includes(busca)
  );

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-[#111] border border-zinc-800 w-full max-w-lg rounded-xl overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/40">
          <div>
            <h2 className="text-yellow-500 font-bold text-lg uppercase tracking-tight">Vincular Motorista</h2>
            <p className="text-zinc-500 text-xs">LANÇANDO DT: <span className="text-white font-mono">{cargaSelecionada?.dt}</span></p>
          </div>
          <button onClick={onFechar} className="text-zinc-500 hover:text-white transition-colors">
            <XCircle size={24} />
          </button>
        </div>

        {/* Busca */}
        <div className="p-4 bg-zinc-900/20 border-b border-zinc-800/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
            <input 
              type="text"
              placeholder="Pesquisar motorista cadastrado..."
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-yellow-500 transition-all"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        {/* Lista de Motoristas */}
        <div className="max-h-[400px] overflow-y-auto p-2">
          {carregando ? (
            <div className="text-center py-10 text-zinc-500 text-sm animate-pulse">Consultando base de motoristas...</div>
          ) : filtrados.length > 0 ? (
            filtrados.map((mot) => (
              <div key={mot.id} className="flex items-center justify-between p-3 hover:bg-zinc-800/50 rounded-lg mb-1 border border-transparent hover:border-zinc-700 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="text-zinc-200 text-sm font-bold uppercase">{mot.nome}</h3>
                    <p className="text-[10px] text-zinc-500 font-mono">
                      {mot.email_app || 'Sem e-mail'} | {mot.cidade}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => enviarCargaAoMotorista(mot)}
                  disabled={enviando === mot.id}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded font-black text-[11px] uppercase transition-all disabled:opacity-50"
                >
                  {enviando === mot.id ? "ENVIANDO..." : "SELECIONAR"}
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-10 text-zinc-600 text-xs uppercase tracking-widest">
              Nenhum motorista encontrado no cadastro
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcoesCargas;