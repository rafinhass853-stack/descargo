import React, { useState, useEffect } from 'react';
import { User, Send, CheckCircle, XCircle, Search } from 'lucide-react';

const AcoesCargas = ({ cargaSelecionada, onFechar }) => {
  const [motoristas, setMotoristas] = useState([]);
  const [busca, setBusca] = useState('');
  const [enviando, setEnviando] = useState(null);

  // Simulação de busca de motoristas cadastrados
  useEffect(() => {
    const carregarMotoristas = async () => {
      // Aqui entraria sua chamada de API (ex: axios.get('/api/motoristas'))
      const mockMotoristas = [
        { id: 1, nome: "João Silva", status: "Livre", veiculo: "Scania R450", appOnline: true },
        { id: 2, nome: "Marcos Oliveira", status: "Em Viagem", veiculo: "Volvo FH", appOnline: true },
        { id: 3, nome: "Ricardo Santos", status: "Livre", veiculo: "Mercedes Actros", appOnline: false },
      ];
      setMotoristas(mockMotoristas);
    };
    carregarMotoristas();
  }, []);

  const enviarCargaAoMotorista = async (motoristaId) => {
    setEnviando(motoristaId);
    
    // Lógica para enviar notificação Push/Socket
    try {
      console.log(`Enviando carga ${cargaSelecionada.id} para motorista ${motoristaId}`);
      // Simulação de delay da rede
      await new Promise(res => setTimeout(res, 1500));
      
      alert("Carga enviada com sucesso! Aguardando aceite do motorista.");
      onFechar();
    } catch (error) {
      alert("Erro ao enviar carga.");
    } finally {
      setEnviando(null);
    }
  };

  const motoristasFiltrados = motoristas.filter(m => 
    m.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#121212] border border-zinc-800 w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <div>
            <h2 className="text-yellow-500 font-bold text-xl uppercase tracking-wider">Enviar para Motorista</h2>
            <p className="text-zinc-400 text-sm">Carga: <span className="text-white">{cargaSelecionada?.dt || "S/DT"}</span> - Destino: <span className="text-white">{cargaSelecionada?.destino || "N/A"}</span></p>
          </div>
          <button onClick={onFechar} className="text-zinc-500 hover:text-white transition-colors">
            <XCircle size={28} />
          </button>
        </div>

        {/* Busca */}
        <div className="p-4 bg-zinc-900/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="text"
              placeholder="Buscar motorista pelo nome..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-yellow-500 transition-all"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        {/* Lista de Motoristas */}
        <div className="max-h-[400px] overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {motoristasFiltrados.map((mot) => (
            <div 
              key={mot.id} 
              className="flex items-center justify-between p-4 bg-zinc-800/40 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-full ${mot.appOnline ? 'bg-green-500/10 text-green-500' : 'bg-zinc-700 text-zinc-500'}`}>
                  <User size={24} />
                </div>
                <div>
                  <h3 className="text-white font-medium">{mot.nome}</h3>
                  <div className="flex gap-3 text-xs">
                    <span className={mot.status === 'Livre' ? 'text-green-400' : 'text-yellow-400'}>{mot.status}</span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-zinc-400">{mot.veiculo}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => enviarCargaAoMotorista(mot.id)}
                disabled={enviando || !mot.appOnline}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${
                  mot.appOnline 
                  ? 'bg-yellow-500 text-black hover:bg-yellow-400 active:scale-95' 
                  : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                }`}
              >
                {enviando === mot.id ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={16} />
                    {mot.appOnline ? 'ENVIAR' : 'OFFLINE'}
                  </>
                )}
              </button>
            </div>
          ))}

          {motoristasFiltrados.length === 0 && (
            <div className="text-center py-10 text-zinc-500">
              Nenhum motorista encontrado.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 text-right text-[10px] text-zinc-600 uppercase tracking-widest">
          Painel de Gestão Operacional - Descargo
        </div>
      </div>
    </div>
  );
};

export default AcoesCargas;