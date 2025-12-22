// ... (imports do Firebase e Mapa mantidos)
import TelaConta from './TelaConta';
import Operacao from './Operacao';
import Historicos from './Historicos';

export default function App() {
  // ... (toda a lógica de auth e GPS que já fizemos)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      {telaAtiva === 'inicio' ? (
        <Dashboard setTelaAtiva={setTelaAtiva} usuarioEmail={usuario.email} />
      ) : telaAtiva === 'abastecimento' ? (
        <Operacao aoVoltar={() => setTelaAtiva('inicio')} />
      ) : telaAtiva === 'conta' ? (
        <TelaConta 
          aoVoltar={() => setTelaAtiva('inicio')} 
          logoff={handleLogout} 
          userEmail={usuario.email} 
        />
      ) : telaAtiva === 'historico' ? (
        <Historicos aoVoltar={() => setTelaAtiva('inicio')} userEmail={usuario.email} />
      ) : null}
    </SafeAreaView>
  );
}