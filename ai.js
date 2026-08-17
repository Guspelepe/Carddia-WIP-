// ai.js
// IA simples: invoca todos os monstros possíveis, usa magias e armadilhas, e ataca.

function aiTurn(estado) {
  const jogadorId = estado.jogadorAtual; // deve ser 2
  const jogador = estado.jogadores[jogadorId];

  // 1. Invocar todos os monstros da mão (até preencher 3 slots)
  const monstrosNaMao = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'monstro');

  for (let item of monstrosNaMao) {
    const slotVazio = jogador.zonaMonstros.findIndex(slot => slot === null);
    if (slotVazio !== -1) {
      invocarMonstro(jogadorId, item.index, slotVazio, 'ataque');
      // Após invocar, verificar armadilha de invocação do oponente (Ira do Submundo)
      // A função invocarMonstro já chama verificarArmadilhaInvocacao internamente
    } else {
      break; // sem slots vazios
    }
  }

  // 2. Usar magias
  const magiasRemocao = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && item.carta.efeito === 'destruir_inimigo');

  if (magiasRemocao.length > 0) {
    const inimigoId = 1;
    const inimigo = estado.jogadores[inimigoId];
    let alvoIndex = -1;
    let maiorAtk = 0;
    for (let i = 0; i < inimigo.zonaMonstros.length; i++) {
      const monstro = inimigo.zonaMonstros[i];
      if (monstro && monstro.atk > maiorAtk) {
        maiorAtk = monstro.atk;
        alvoIndex = i;
      }
    }
    if (alvoIndex !== -1 && maiorAtk >= 2000) {
      usarMagia(jogadorId, magiasRemocao[0].index, { tipo: 'inimigo', slot: alvoIndex });
    }
  }

  const magiasBuff = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && item.carta.efeito === 'buff_500');

  if (magiasBuff.length > 0) {
    let alvoIndex = -1;
    let maiorAtk = 0;
    for (let i = 0; i < jogador.zonaMonstros.length; i++) {
      const monstro = jogador.zonaMonstros[i];
      if (monstro && monstro.atk > maiorAtk) {
        maiorAtk = monstro.atk;
        alvoIndex = i;
      }
    }
    if (alvoIndex !== -1) {
      usarMagia(jogadorId, magiasBuff[0].index, { tipo: 'proprio', slot: alvoIndex });
    }
  }

  const magiasCompra = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && item.carta.efeito === 'comprar_2');
  if (magiasCompra.length > 0) {
    usarMagia(jogadorId, magiasCompra[0].index, null);
  }

  // 3. Baixar armadilhas
  const armadilhasNaMao = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'armadilha');

  for (let item of armadilhasNaMao) {
    const slotVazio = jogador.zonaMagias.findIndex(slot => slot === null);
    if (slotVazio !== -1) {
      baixarArmadilha(jogadorId, item.index, slotVazio);
    } else {
      break;
    }
  }

  // 4. Atacar (se não for o primeiro turno do jogador 2, mas como o jogador 2 nunca começa, pode atacar sempre)
  executarBatalha(jogadorId);

  // 5. Encerrar turno após um pequeno delay
  setTimeout(() => {
    encerrarTurno();
  }, 1000);
}