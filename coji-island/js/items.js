// Everything that can go in Coji's bag.
export const ITEMS = {
  apple: { name: 'Apple', icon: '🍎', energy: 15, desc: 'A red apple. Crunch!' },
  berries: { name: 'Berries', icon: '🫐', energy: 8, desc: 'Sweet little berries.' },
  burger: { name: 'Burger', icon: '🍔', energy: 45, desc: 'A big, yummy burger!' },
  fries: { name: 'Fries', icon: '🍟', energy: 20, desc: 'Hot fries. Yum!' },
  juice: { name: 'Juice', icon: '🧃', water: 30, energy: 10, desc: 'Cold orange juice.' },
  milk: { name: 'Milk', icon: '🥛', water: 20, energy: 15, desc: 'Fresh milk from the farm.' },
  water: { name: 'Water Bottle', icon: '💧', water: 40, desc: 'Fresh water. Fill it at the well!' },
  carrot: { name: 'Carrot', icon: '🥕', energy: 10, desc: 'A crunchy carrot. Bunnies love carrots!' },
  fish: { name: 'Fish', icon: '🐟', desc: 'A fresh fish. Cats love fish!' },
  shell: { name: 'Shell', icon: '🐚', desc: 'A pretty shell. The bank swaps shells for coins.' },
  honey: { name: 'Honey', icon: '🍯', quest: true, desc: 'A jar of sweet honey.' },
  glasses: { name: 'Round Glasses', icon: '👓', quest: true, desc: 'Round glasses. Who lost them?' },
  feather: { name: 'Owl Feather', icon: '🪶', quest: true, desc: 'A big, soft owl feather.' },
  bulb: { name: 'Super Bright Bulb', icon: '💡', quest: true, desc: 'A big, bright light bulb!' },
}

export const SHOPS = {
  ben: {
    title: 'Burger Hut',
    who: 'ben',
    buy: [
      ['burger', 4],
      ['fries', 2],
      ['juice', 2],
      ['water', 1],
    ],
    sell: [],
  },
  granny: {
    title: "Granny Bee's Market",
    who: 'granny',
    buy: [
      ['honey', 5],
      ['carrot', 1],
      ['milk', 2],
    ],
    sell: [
      ['apple', 1],
      ['berries', 1],
    ],
  },
}
