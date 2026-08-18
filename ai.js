// ai.js
async function aiTurn(estado) {
  const jogadorId = estado.jogadorAtual;
  const jogador = estado.jogadores[jogadorId];
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  // 1. Invocar monstros, um por vez com delay
  const monstrosNaMao = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'monstro')
    .sort((a, b) => b.carta.atk - a.carta.atk);

  for (let item of monstrosNaMao) {
    const slotVazio = jogador.zonaMonstros.findIndex(slot => slot === null);
    if (slotVazio !== -1) {
      invocarMonstro(jogadorId, item.index, slotVazio, 'ataque');
      await delay(800);
    } else {
      break;
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
      await delay(800);
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
      await delay(800);
    }
  }

  const magiasCompra = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && item.carta.efeito === 'comprar_2');
  if (magiasCompra.length > 0) {
    usarMagia(jogadorId, magiasCompra[0].index, null);
    await delay(800);
  }

  // 3. Baixar armadilhas
  const armadilhasNaMao = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'armadilha');

  for (let item of armadilhasNaMao) {
    const slotVazio = jogador.zonaMagias.findIndex(slot => slot === null);
    if (slotVazio !== -1) {
      baixarArmadilha(jogadorId, item.index, slotVazio);
      await delay(800);
    } else {
      break;
    }
  }

  // 4. Atacar (com animações e delays entre ataques)
  if (!(estado.primeiroTurno && estado.jogadorAtual === jogadorId)) {
    await executarAtaquesAutomaticos(jogadorId);
  }

  // 5. Encerrar turno
  encerrarTurno();
}