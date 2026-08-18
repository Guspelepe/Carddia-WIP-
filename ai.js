// ai.js
async function aiTurn(estado) {
  const jogadorId = estado.jogadorAtual;
  const jogador = estado.jogadores[jogadorId];
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  // 1. Invocar monstros (do mais forte para o mais fraco)
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

  // 2. Usar magias (heurísticas conforme dificuldade)
  // Magias de remoção de monstros
  const magiasDestruir = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && item.carta.efeito === 'destruir_inimigo');

  for (let magia of magiasDestruir) {
    const inimigo = estado.jogadores[jogadorId === 1 ? 2 : 1];
    let alvoIndex = -1;
    let maiorAtk = 0;
    for (let i = 0; i < inimigo.zonaMonstros.length; i++) {
      const m = inimigo.zonaMonstros[i];
      if (m && m.atk > maiorAtk) {
        maiorAtk = m.atk;
        alvoIndex = i;
      }
    }
    // No difícil, só usar se o inimigo tem monstro forte ou se a IA está perdendo
    if (alvoIndex !== -1 && (nivelDificuldade !== 'dificil' || maiorAtk >= 2000 || jogador.hp < 2000)) {
      usarMagia(jogadorId, magia.index, { tipo: 'inimigo', slot: alvoIndex });
      await delay(800);
    }
  }

  // Magias de destruir todos os monstros
  const magiasDestruirTodos = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && item.carta.efeito === 'destruir_todos_inimigos');
  if (magiasDestruirTodos.length > 0) {
    usarMagia(jogadorId, magiasDestruirTodos[0].index, null);
    await delay(800);
  }

  // Magias de buff
  const magiasBuff = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && (item.carta.efeito === 'buff_500' || item.carta.efeito === 'buff_1000'));
  for (let magia of magiasBuff) {
    let alvoIndex = -1;
    let maiorAtk = 0;
    for (let i = 0; i < jogador.zonaMonstros.length; i++) {
      const m = jogador.zonaMonstros[i];
      if (m && m.atk > maiorAtk) {
        maiorAtk = m.atk;
        alvoIndex = i;
      }
    }
    if (alvoIndex !== -1) {
      usarMagia(jogadorId, magia.index, { tipo: 'proprio', slot: alvoIndex });
      await delay(800);
    }
  }

  // Magias de reviver
  const magiasReviver = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && item.carta.efeito === 'reviver_monstro');
  if (magiasReviver.length > 0 && jogador.cemiterio.length > 0) {
    const maisForte = jogador.cemiterio.reduce((a, b) => (b.atk > a.atk ? b : a));
    const idxCem = jogador.cemiterio.indexOf(maisForte);
    usarMagia(jogadorId, magiasReviver[0].index, { tipo: 'cemiterio', index: idxCem });
    await delay(800);
  }

  // Magias de curar
  const magiasCurar = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && item.carta.efeito === 'curar_2000');
  if (magiasCurar.length > 0 && jogador.hp < 3000) {
    usarMagia(jogadorId, magiasCurar[0].index, null);
    await delay(800);
  }

  // Magias de roubar monstro
  const magiasRoubar = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && item.carta.efeito === 'roubar_monstro');
  if (magiasRoubar.length > 0) {
    const inimigo = estado.jogadores[jogadorId === 1 ? 2 : 1];
    let alvoIndex = -1;
    let maiorAtk = 0;
    for (let i = 0; i < inimigo.zonaMonstros.length; i++) {
      const m = inimigo.zonaMonstros[i];
      if (m && m.atk > maiorAtk) {
        maiorAtk = m.atk;
        alvoIndex = i;
      }
    }
    if (alvoIndex !== -1 && (nivelDificuldade !== 'dificil' || maiorAtk >= 2000)) {
      usarMagia(jogadorId, magiasRoubar[0].index, { tipo: 'inimigo', slot: alvoIndex });
      await delay(800);
    }
  }

  // Magias de comprar cartas
  const magiasComprar = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'magia' && (item.carta.efeito === 'comprar_2' || item.carta.efeito === 'comprar_3_dano_1000'));
  for (let magia of magiasComprar) {
    if (jogador.mao.length < 3) {
      usarMagia(jogadorId, magia.index, null);
      await delay(800);
    }
  }

  // 3. Baixar armadilhas
  const armadilhas = jogador.mao
    .map((carta, index) => ({ carta, index }))
    .filter(item => item.carta.tipo === 'armadilha');
  for (let arm of armadilhas) {
    const slotVazio = jogador.zonaMagias.findIndex(slot => slot === null);
    if (slotVazio !== -1) {
      baixarArmadilha(jogadorId, arm.index, slotVazio);
      await delay(800);
    }
  }

  // 4. Atacar (se não for o primeiro turno)
  if (!(estado.primeiroTurno && estado.jogadorAtual === jogadorId)) {
    await executarAtaquesAutomaticos(jogadorId);
  }

  // 5. Encerrar turno
  encerrarTurno();
}