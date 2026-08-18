// ai.js
// IA simples com delays entre ações para melhor visualização.

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function aiTurn(estado) {
  const jogadorId = estado.jogadorAtual;
  const jogador = estado.jogadores[jogadorId];

  // 1. Invocar monstros (um por vez com delay)
  const monstrosNaMao = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'monstro');

  for (let item of monstrosNaMao) {
    const slotVazio = jogador.zonaMonstros.findIndex(slot => slot === null);
    if (slotVazio !== -1) {
      invocarMonstro(jogadorId, item.index, slotVazio, 'ataque');
      await sleep(800);
    } else {
      break;
    }
  }

  // 2. Usar magias (se houver)
  const magiasRemocao = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && item.carta.efeito === 'destruir_inimigo');

  if (magiasRemocao.length > 0) {
    const inimigo = estado.jogadores[1];
    let alvoIndex = -1, maiorAtk = 0;
    for (let i = 0; i < inimigo.zonaMonstros.length; i++) {
      if (inimigo.zonaMonstros[i] && inimigo.zonaMonstros[i].atk > maiorAtk) {
        maiorAtk = inimigo.zonaMonstros[i].atk;
        alvoIndex = i;
      }
    }
    if (alvoIndex !== -1 && maiorAtk >= 2000) {
      usarMagia(jogadorId, magiasRemocao[0].index, { tipo: 'inimigo', slot: alvoIndex });
      await sleep(800);
    }
  }

  const magiasBuff = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && item.carta.efeito === 'buff_500');

  if (magiasBuff.length > 0) {
    let alvoIndex = -1, maiorAtk = 0;
    for (let i = 0; i < jogador.zonaMonstros.length; i++) {
      if (jogador.zonaMonstros[i] && jogador.zonaMonstros[i].atk > maiorAtk) {
        maiorAtk = jogador.zonaMonstros[i].atk;
        alvoIndex = i;
      }
    }
    if (alvoIndex !== -1) {
      usarMagia(jogadorId, magiasBuff[0].index, { tipo: 'proprio', slot: alvoIndex });
      await sleep(800);
    }
  }

  const magiasCompra = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && item.carta.efeito === 'comprar_2');
  if (magiasCompra.length > 0) {
    usarMagia(jogadorId, magiasCompra[0].index, null);
    await sleep(800);
  }

  // 3. Baixar armadilhas
  const armadilhasNaMao = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'armadilha');

  for (let item of armadilhasNaMao) {
    const slotVazio = jogador.zonaMagias.findIndex(slot => slot === null);
    if (slotVazio !== -1) {
      baixarArmadilha(jogadorId, item.index, slotVazio);
      await sleep(800);
    } else {
      break;
    }
  }

  // 4. Atacar
  if (typeof executarAtaquesAutomaticos === 'function') {
    executarAtaquesAutomaticos(jogadorId);
  } else {
    console.error('executarAtaquesAutomaticos não definida');
  }
  await sleep(1000);

  // 5. Encerrar turno
  encerrarTurno();
}