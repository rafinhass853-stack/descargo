import React, { useEffect } from 'react';
import { Alert, Vibration } from 'react-native';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp,
  and 
} from 'firebase/firestore';

const useMonitorarCargas = ({
  db,
  user,
  viagemIniciada,
  cargaAtiva,
  setCargaAtiva,
  setViagemIniciada,
  setChegouAoDestino,
  setConfirmacaoPendente,
  setShowConfirmacaoModal,
  setStatusOperacional,
  sincronizarComFirestore
}) => {
  
  const aceitarCarga = async (id, dados) => {
    try {
      await updateDoc(doc(db, "ordens_servico", id), { 
        status: "ACEITO", 
        aceitoEm: serverTimestamp(),
        dataInicioViagem: serverTimestamp()
      });
      Alert.alert("✅ CARGA ACEITA!", "A viagem será iniciada automaticamente em alguns segundos.", [{ text: "OK" }]);
    } catch (error) {
      console.error("Erro ao aceitar carga:", error);
      Alert.alert("Erro", "Não foi possível aceitar a carga.");
    }
  };

  const iniciarViagem = async (id, dados) => {
    try {
      await updateDoc(doc(db, "ordens_servico", id), {
        status: "EM ANDAMENTO",
        dataInicioViagem: serverTimestamp()
      });
      const cargaIniciada = { id, ...dados, status: "EM ANDAMENTO" };
      setCargaAtiva(cargaIniciada);
      setViagemIniciada(true);
      const novoStatus = dados.tipoViagem === 'VAZIO' ? 'Viagem vazio' : 'Viagem carregado';
      setStatusOperacional(novoStatus);
      sincronizarComFirestore({ statusOperacional: novoStatus });
      Alert.alert("🚚 VIAGEM INICIADA!", "A viagem foi iniciada automaticamente.\n\nMantenha o app aberto para rastreamento.", [{ text: "ENTENDI" }]);
    } catch (error) {
      console.error("Erro ao iniciar viagem:", error);
      Alert.alert("Erro", "Não foi possível iniciar a viagem.");
    }
  };

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "ordens_servico"), 
      and(
        where("motoristaId", "==", user.uid), 
        where("status", "in", ["AGUARDANDO PROGRAMAÇÃO", "PENDENTE ACEITE", "ACEITO", "EM ANDAMENTO", "AGUARDANDO CONFIRMAÇÃO"])
      )
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        // Processar novas cargas
        snapshot.docChanges().forEach((change) => {
          const dados = change.doc.data();
          const id = change.doc.id;

          // Nova carga ou carga pendente
          if ((change.type === "added" || change.type === "modified") && 
              (dados.status === "AGUARDANDO PROGRAMAÇÃO" || dados.status === "PENDENTE ACEITE")) {
            
            Vibration.vibrate([0, 500, 500, 500], true);
            const temGeofence = dados.cercaVirtual?.ativa;
            const mensagemGeofence = temGeofence 
              ? `\n📍 Sistema de geofence ativo (${dados.cercaVirtual.raio}m)` 
              : '';
            
            Alert.alert(
              dados.tipoViagem === 'VAZIO' ? "⚪ DESLOCAMENTO DE VAZIO" : "🔔 NOVA CARGA", 
              `Destino: ${dados.destinoCliente || dados.cliente_destino}${mensagemGeofence}\n\nA viagem iniciará automaticamente ao ser aceita.`, 
              [
                { 
                  text: "RECUSAR", 
                  style: "cancel", 
                  onPress: async () => { 
                    Vibration.cancel(); 
                    await updateDoc(doc(db, "ordens_servico", id), { 
                      status: "RECUSADO" 
                    }); 
                  }
                },
                { 
                  text: "ACEITAR", 
                  onPress: () => { 
                    Vibration.cancel(); 
                    aceitarCarga(id, dados); 
                  }
                }
              ]
            );
          }

          // Carga aceita - iniciar viagem automaticamente
          if (change.type === "modified" && dados.status === "ACEITO" && !viagemIniciada) {
            iniciarViagem(id, dados);
          }

          // Carga em andamento
          if (dados.status === "EM ANDAMENTO" || dados.status === "AGUARDANDO CONFIRMAÇÃO") {
            setCargaAtiva({ id, ...dados });
            setViagemIniciada(true);
            
            if (dados.status === "AGUARDANDO CONFIRMAÇÃO") {
              setChegouAoDestino(true);
              setConfirmacaoPendente(true);
              setShowConfirmacaoModal(true);
            }
          }
        });

        // Limpar carga ativa se não houver mais cargas
        if (snapshot.empty && cargaAtiva) {
          setCargaAtiva(null);
          setViagemIniciada(false);
        }
      },
      (error) => {
        console.error("Erro ao monitorar cargas:", error);
        if (error.code === 'permission-denied') {
          console.log("Permissão negada para monitorar ordens de serviço");
        }
      }
    );

    return () => unsubscribe();
  }, [user?.uid, viagemIniciada, cargaAtiva]);
};

export default useMonitorarCargas;