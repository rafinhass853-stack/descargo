import { useEffect } from 'react';
import { Alert, Vibration } from 'react-native';
import { collection, query, where, onSnapshot, doc, updateDoc, and } from 'firebase/firestore';

export const useNotificacaoCarga = (db, user, isLoggedIn, setCargaAtiva, aceitarCarga) => {
  useEffect(() => {
    if (isLoggedIn && user) {
      const q = query(
        collection(db, "ordens_servico"),
        and(
          where("motoristaId", "==", user.uid),
          where("status", "in", ["AGUARDANDO PROGRAMAÇÃO", "PENDENTE ACEITE"])
        )
      );

      const unsubscribeCargas = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const dados = change.doc.data();
          const id = change.doc.id;

          // Notificar apenas cargas PENDENTES que foram adicionadas ou modificadas
          if ((change.type === "added" || change.type === "modified") && 
              (dados.status === "AGUARDANDO PROGRAMAÇÃO" || dados.status === "PENDENTE ACEITE")) {
            
            Vibration.vibrate([0, 500, 500, 500], true); 

            const isVazio = dados.tipoViagem === 'VAZIO';
            const temInstrucoes = dados.trajetoComInstrucoes && dados.trajetoComInstrucoes.length > 0;
            const temGeofence = dados.cercaVirtual?.ativa;
            const raioGeofence = dados.cercaVirtual?.raio || 100;
            
            const titulo = isVazio ? "⚪ DESLOCAMENTO VAZIO" : "🔔 NOVA VIAGEM DISPONÍVEL";
            
            let mensagem = `📍 DESTINO: ${dados.destinoCliente || dados.cliente_destino}\n`;
            
            if (!isVazio) {
              mensagem += `🏁 ORIGEM: ${dados.origemCliente || dados.cliente_origem}\n`;
            }
            
            if (dados.peso && dados.tipoViagem === 'CARREGADO') {
              mensagem += `⚖️ PESO: ${dados.peso}\n`;
            }
            
            if (temInstrucoes) {
              mensagem += `🔊 ${dados.trajetoComInstrucoes.length} instruções de navegação\n`;
            }
            
            if (temGeofence) {
              mensagem += `🎯 Cerca virtual ativa (${raioGeofence}m)\n`;
            }
            
            mensagem += `🚚 VEÍCULO: ${dados.perfilVeiculo || 'Trucado'}\n\n`;
            mensagem += `📱 Fluxo automático:\n`;
            mensagem += `1. Aceite a viagem\n`;
            mensagem += `2. Viagem inicia automaticamente\n`;
            mensagem += `3. App detecta chegada\n`;
            mensagem += `4. Confirme para finalizar`;

            Alert.alert(
              titulo,
              mensagem,
              [
                { 
                  text: "RECUSAR", 
                  style: "destructive", 
                  onPress: async () => { 
                    Vibration.cancel(); 
                    await updateDoc(doc(db, "ordens_servico", id), { 
                      status: "RECUSADO",
                      motivoRecusa: "Recusado pelo motorista",
                      dataRecusa: new Date()
                    }); 
                  } 
                },
                { 
                  text: "✅ ACEITAR VIAGEM", 
                  onPress: () => { 
                    Vibration.cancel(); 
                    aceitarCarga(id, dados); 
                  } 
                }
              ],
              { 
                cancelable: false,
                onDismiss: () => Vibration.cancel()
              }
            );
          }
        });
      }, (error) => {
        console.error("Erro no listener de notificações:", error);
      });

      return () => unsubscribeCargas();
    }
  }, [isLoggedIn, user, db, aceitarCarga]);
};