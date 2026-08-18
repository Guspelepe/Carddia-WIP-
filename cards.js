// cards.js
const ALL_CARDS = [
  // ========== MONSTROS (26) ==========
  // Normais
  { id: 'm01', tipo: 'monstro', nome: 'Guerreiro de Pedra', atk: 1200, def: 1500, custo: 0, efeito: null },
  { id: 'm02', tipo: 'monstro', nome: 'Dragão Jovem', atk: 1800, def: 1000, custo: 0, efeito: null },
  { id: 'm03', tipo: 'monstro', nome: 'Cavaleiro Andante', atk: 1600, def: 1200, custo: 0, efeito: null },
  { id: 'm04', tipo: 'monstro', nome: 'Lobo Cinzento', atk: 1000, def: 800, custo: 0, efeito: null },
  { id: 'm05', tipo: 'monstro', nome: 'Golem de Ferro', atk: 2000, def: 2000, custo: 0, efeito: null },
  { id: 'm06', tipo: 'monstro', nome: 'Águia Celeste', atk: 1500, def: 1000, custo: 0, efeito: null },
  { id: 'm07', tipo: 'monstro', nome: 'Serpente Marinha', atk: 1700, def: 1600, custo: 0, efeito: null },
  { id: 'm08', tipo: 'monstro', nome: 'Guerreiro Orc', atk: 1900, def: 1200, custo: 0, efeito: null },
  { id: 'm09', tipo: 'monstro', nome: 'Mago Arcano', atk: 1400, def: 1000, custo: 0, efeito: null },
  { id: 'm10', tipo: 'monstro', nome: 'Dragão Ancião', atk: 2500, def: 2000, custo: 0, efeito: null },
  { id: 'm11', tipo: 'monstro', nome: 'Leão de Nemeia', atk: 2200, def: 1800, custo: 0, efeito: null },
  { id: 'm12', tipo: 'monstro', nome: 'Gárgula', atk: 1300, def: 1400, custo: 0, efeito: null },
  { id: 'm13', tipo: 'monstro', nome: 'Cavalo Alado', atk: 1700, def: 1300, custo: 0, efeito: null },
  { id: 'm14', tipo: 'monstro', nome: 'Golem de Gelo', atk: 1800, def: 2000, custo: 0, efeito: null },
  { id: 'm15', tipo: 'monstro', nome: 'Mago do Caos', atk: 1600, def: 1000, custo: 0, efeito: null },
  { id: 'm16', tipo: 'monstro', nome: 'Cavaleiro Negro', atk: 2100, def: 1500, custo: 0, efeito: null },
  { id: 'm17', tipo: 'monstro', nome: 'Elfo Arqueiro', atk: 1500, def: 1200, custo: 0, efeito: null },
  { id: 'm18', tipo: 'monstro', nome: 'Dragão Bebê', atk: 1200, def: 700, custo: 0, efeito: null },
  { id: 'm19', tipo: 'monstro', nome: 'Titã', atk: 2600, def: 2200, custo: 0, efeito: null },
  { id: 'm20', tipo: 'monstro', nome: 'Sereia', atk: 1400, def: 1600, custo: 0, efeito: null },
  { id: 'm21', tipo: 'monstro', nome: 'Centauro', atk: 1800, def: 1400, custo: 0, efeito: null },
  { id: 'm22', tipo: 'monstro', nome: 'Múmia', atk: 1000, def: 1800, custo: 0, efeito: null },
  { id: 'm23', tipo: 'monstro', nome: 'Esfinge', atk: 2300, def: 2000, custo: 0, efeito: null },
  { id: 'm24', tipo: 'monstro', nome: 'Quimera', atk: 2400, def: 1800, custo: 0, efeito: null },
  // Com efeito
  { id: 'm25', tipo: 'monstro', nome: 'Fada Curandeira', atk: 800, def: 800, custo: 0, efeito: 'quando_morre_ganha_500_vida' },
  { id: 'm26', tipo: 'monstro', nome: 'Fênix Renascida', atk: 2000, def: 1500, custo: 0, efeito: 'quando_morre_ganha_500_vida' },

  // ========== MAGIAS (7) ==========
  { id: 's01', tipo: 'magia', nome: 'Aumento de Fé', efeito: 'buff_500', descricao: 'Escolha 1 monstro seu, ele ganha +500 de ATK.' },
  { id: 's02', tipo: 'magia', nome: 'Aumento de Fé', efeito: 'buff_500', descricao: 'Escolha 1 monstro seu, ele ganha +500 de ATK.' },
  { id: 's03', tipo: 'magia', nome: 'Aumento de Fé', efeito: 'buff_500', descricao: 'Escolha 1 monstro seu, ele ganha +500 de ATK.' },
  { id: 's04', tipo: 'magia', nome: 'Raios de Zeus', efeito: 'destruir_inimigo', descricao: 'Destrói 1 monstro inimigo na Zona de Monstros.' },
  { id: 's05', tipo: 'magia', nome: 'Raios de Zeus', efeito: 'destruir_inimigo', descricao: 'Destrói 1 monstro inimigo na Zona de Monstros.' },
  { id: 's06', tipo: 'magia', nome: 'Barganha Divina', efeito: 'comprar_2', descricao: 'Compre 2 cartas do seu deck imediatamente.' },
  { id: 's07', tipo: 'magia', nome: 'Barganha Divina', efeito: 'comprar_2', descricao: 'Compre 2 cartas do seu deck imediatamente.' },

  // ========== ARMADILHAS (7) ==========
  { id: 't01', tipo: 'armadilha', nome: 'Escudo de Atenas', efeito: 'armadilha_escudo', descricao: 'Quando o oponente atacar, mude o monstro dele para modo de Defesa e cancele o ataque.' },
  { id: 't02', tipo: 'armadilha', nome: 'Escudo de Atenas', efeito: 'armadilha_escudo', descricao: 'Quando o oponente atacar, mude o monstro dele para modo de Defesa e cancele o ataque.' },
  { id: 't03', tipo: 'armadilha', nome: 'Escudo de Atenas', efeito: 'armadilha_escudo', descricao: 'Quando o oponente atacar, mude o monstro dele para modo de Defesa e cancele o ataque.' },
  { id: 't04', tipo: 'armadilha', nome: 'Escudo de Atenas', efeito: 'armadilha_escudo', descricao: 'Quando o oponente atacar, mude o monstro dele para modo de Defesa e cancele o ataque.' },
  { id: 't05', tipo: 'armadilha', nome: 'Ira do Submundo', efeito: 'armadilha_ira', descricao: 'Quando o oponente invocar um monstro com mais de 2000 de ATK, destrua esse monstro imediatamente.' },
  { id: 't06', tipo: 'armadilha', nome: 'Ira do Submundo', efeito: 'armadilha_ira', descricao: 'Quando o oponente invocar um monstro com mais de 2000 de ATK, destrua esse monstro imediatamente.' },
  { id: 't07', tipo: 'armadilha', nome: 'Ira do Submundo', efeito: 'armadilha_ira', descricao: 'Quando o oponente invocar um monstro com mais de 2000 de ATK, destrua esse monstro imediatamente.' },
];