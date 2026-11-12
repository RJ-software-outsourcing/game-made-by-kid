// Everything that can go in Coji's bag. `use` tells the child what to do with it.
export const ITEMS = {
  apple: { name: 'Apple', icon: '🍎', energy: 15, desc: 'A red apple. Crunch!', use: 'Eat it for energy, or sell it to Granny Bee.' },
  berries: { name: 'Berries', icon: '🫐', energy: 8, desc: 'Sweet little berries.', use: 'Eat them for energy, or sell them to Granny Bee.' },
  burger: { name: 'Burger', icon: '🍔', energy: 45, desc: 'A big, yummy burger!', use: 'Eat it when you are very tired.' },
  fries: { name: 'Fries', icon: '🍟', energy: 20, desc: 'Hot fries. Yum!', use: 'Eat them for energy.' },
  juice: { name: 'Juice', icon: '🧃', water: 30, energy: 10, desc: 'Cold orange juice.', use: 'Drink it when you are thirsty.' },
  milk: { name: 'Milk', icon: '🥛', water: 20, energy: 15, desc: 'Fresh milk from the farm.', use: 'Drink it for water and energy.' },
  water: { name: 'Water Bottle', icon: '💧', water: 40, desc: 'Fresh water.', use: 'Drink it when you are thirsty. Fill it at the well.' },
  carrot: { name: 'Carrot', icon: '🥕', energy: 10, desc: 'A crunchy carrot.', use: 'Give it to Bun the bunny at the farm, or eat it.' },
  mushroom: { name: 'Mushroom', icon: '🍄', energy: 6, desc: 'A little forest mushroom.', use: 'Eat it for a little energy.' },
  pumpkin: { name: 'Pumpkin', icon: '🎃', energy: 20, desc: 'A round orange pumpkin.', use: 'Eat it, or bring it to Boo the ghost for a lantern.' },
  cookie: { name: 'Cookie', icon: '🍪', energy: 12, desc: 'A warm cookie from a friend.', use: 'Eat it for energy.' },
  sandwich: { name: 'Sandwich', icon: '🥪', energy: 30, desc: 'A picnic sandwich.', use: 'Eat it when you are tired.' },
  candle: { name: 'Candle', icon: '🕯️', desc: 'A little candle.', use: 'Boo the ghost needs one for a pumpkin lantern.' },
  fish: { name: 'Fish', icon: '🐟', desc: 'A fresh fish.', use: 'Give it to Momo the cat at the harbor.' },
  shell: { name: 'Shell', icon: '🐚', desc: 'A pretty shell.', use: 'Take it to Penny at the bank. 1 shell = 1 coin.' },
  honey: { name: 'Honey', icon: '🍯', quest: true, desc: 'A jar of sweet honey.', use: 'Give it to Bruno the bear on Bear Bridge.' },
  glasses: { name: 'Round Glasses', icon: '👓', quest: true, desc: 'Round glasses.', use: 'Someone lost these. Who has big eyes and cannot see?' },
  feather: { name: 'Owl Feather', icon: '🪶', quest: true, desc: 'A big, soft owl feather.', use: 'Tina at the Toy Shop wants a soft feather.' },
  bulb: { name: 'Super Bright Bulb', icon: '💡', quest: true, desc: 'A big, bright light bulb!', use: 'Bring it to Grandpa Gus at the lighthouse.' },
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
      ['candle', 2],
    ],
    sell: [
      ['apple', 1],
      ['berries', 1],
      ['mushroom', 1],
    ],
  },
}
