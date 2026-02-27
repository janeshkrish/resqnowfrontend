export interface VehicleBrand {
  id: string;
  name: string;
  logo: string;
  type: 'car' | 'bike' | 'both';
  models: string[];
}

export const indianVehicleBrands: VehicleBrand[] = [
  // Car Brands
  {
    id: 'maruti-suzuki',
    name: 'Maruti Suzuki',
    logo: '/brands/maruti-suzuki.png',
    type: 'car',
    models: [
      'Alto K10', 'S-Presso', 'Celerio', 'Wagon R', 'Ignis', 'Swift', 'Baleno', 'Dzire', 'Ciaz',
      'Ertiga', 'XL6', 'Brezza', 'Fronx', 'Grand Vitara', 'Jimny', 'Invicto',
      '800', 'Alto 800', 'Alto', 'Zen', 'Zen Estilo', 'A-Star', 'Ritz', 'Swift (1st Gen)', 'Swift (2nd Gen)',
      'Dzire (Old)', 'SX4', 'Kizashi', 'Gypsy', 'Omni', 'Versa', 'Eeco', 'S-Cross', 'Vitara Brezza (Old)'
    ]
  },
  {
    id: 'hyundai',
    name: 'Hyundai',
    logo: '/brands/hyundai.png',
    type: 'car',
    models: [
      'Grand i10 NIOS', 'i20', 'i20 N Line', 'Aura', 'Verna', 'Exter', 'Venue', 'Venue N Line',
      'Creta', 'Creta N Line', 'Alcazar', 'Tucson', 'Ioniq 5', 'Kona Electric',
      'Santro', 'Santro Xing', 'Eon', 'Getz', 'Getz Prime', 'i10', 'Grand i10', 'Xcent',
      'Accent', 'Verna (Old)', 'Elantra', 'Sonata', 'Sonata Embera', 'Sonata Transform', 'Terracan', 'Santa Fe'
    ]
  },
  {
    id: 'tata',
    name: 'Tata Motors',
    logo: '/brands/tata.png',
    type: 'car',
    models: [
      'Tiago', 'Tiago EV', 'Tigor', 'Tigor EV', 'Altroz', 'Altroz Racer', 'Punch', 'Punch EV',
      'Nexon', 'Nexon EV', 'Harrier', 'Safari', 'Curvv', 'Curvv EV',
      'Indica', 'Indica V2', 'Indica Vista', 'Indigo', 'Indigo CS', 'Indigo Manza', 'Nano', 'Nano GenX',
      'Zest', 'Bolt', 'Sumo', 'Sumo Gold', 'Sumo Grande', 'Safari (Old)', 'Safari Storme', 'Aria', 'Hexa', 'Sierra'
    ]
  },
  {
    id: 'mahindra',
    name: 'Mahindra',
    logo: '/brands/mahindra.png',
    type: 'car',
    models: [
      'XUV 3XO', 'XUV400 EV', 'XUV700', 'Scorpio Classic', 'Scorpio-N', 'Thar', 'Thar Roxx', 'Bolero',
      'Bolero Neo', 'Bolero Neo Plus', 'Marazzo',
      'KUV100', 'KUV100 NXT', 'TUV300', 'TUV300 Plus', 'XUV500', 'XUV300', 'NuvoSport', 'Quanto',
      'Xylo', 'Verito', 'Verito Vibe', 'Logan', 'Reva-i', 'e2o', 'e2o Plus', 'Alturas G4'
    ]
  },
  {
    id: 'honda-cars',
    name: 'Honda Cars',
    logo: '/brands/honda-cars.png',
    type: 'car',
    models: [
      'Amaze', 'City', 'City e:HEV', 'Elevate',
      'Brio', 'Jazz', 'WR-V', 'Mobilio', 'BR-V', 'City (Dolphin)', 'Civic', 'Accord', 'CR-V'
    ]
  },
  {
    id: 'toyota',
    name: 'Toyota',
    logo: '/brands/toyota.png',
    type: 'car',
    models: [
      'Glanza', 'Rumion', 'Urban Cruiser Hyryder', 'Innova Crysta', 'Innova Hycross', 'Fortuner',
      'Fortuner Legender', 'Hilux', 'Camry', 'Vellfire',
      'Qualis', 'Etios', 'Etios Liva', 'Etios Cross', 'Corolla', 'Corolla Altis', 'Yaris',
      'Urban Cruiser', 'Land Cruiser', 'Prado', 'Prius'
    ]
  },
  {
    id: 'kia',
    name: 'Kia',
    logo: '/brands/kia.png',
    type: 'car',
    models: ['Sonet', 'Seltos', 'Carens', 'Carnival', 'EV6', 'EV9']
  },
  {
    id: 'volkswagen',
    name: 'Volkswagen',
    logo: '/brands/volkswagen.png',
    type: 'car',
    models: [
      'Virtus', 'Taigun', 'Tiguan',
      'Polo', 'Polo GT', 'Ameo', 'Vento', 'Jetta', 'Passat', 'Beetle', 'T-Roc', 'Tiguan Allspace', 'Phaeton', 'Touareg'
    ]
  },
  {
    id: 'skoda',
    name: 'Skoda',
    logo: '/brands/skoda.png',
    type: 'car',
    models: [
      'Slavia', 'Kushaq', 'Kodiaq', 'Superb',
      'Fabia', 'Rapid', 'Octavia', 'Octavia RS', 'Laura', 'Yeti', 'Karoq'
    ]
  },
  {
    id: 'ford',
    name: 'Ford',
    logo: '/brands/ford.png',
    type: 'car',
    models: [
      'Figo', 'Figo Aspire', 'Freestyle', 'EcoSport', 'Endeavour', 'Fiesta', 'Classic', 'Ikon', 'Fusion', 'Mustang', 'Mondeo'
    ]
  },
  {
    id: 'chevrolet',
    name: 'Chevrolet',
    logo: '/brands/chevrolet.png',
    type: 'car',
    models: [
      'Spark', 'Beat', 'Sail', 'Sail UVA', 'Aveo', 'Aveo UVA', 'Optra', 'Optra Magnum', 'Cruze',
      'Tavera', 'Enjoy', 'Captiva', 'Trailblazer', 'Forester', 'Camaro'
    ]
  },
  {
    id: 'renault',
    name: 'Renault',
    logo: '/brands/renault.png',
    type: 'car',
    models: [
      'Kwid', 'Triber', 'Kiger',
      'Duster', 'Pulse', 'Scala', 'Lodgy', 'Fluence', 'Koleos', 'Captur'
    ]
  },
  {
    id: 'nissan',
    name: 'Nissan',
    logo: '/brands/nissan.png',
    type: 'car',
    models: [
      'Magnite', 'X-Trail',
      'Micra', 'Micra Active', 'Sunny', 'Terrano', 'Kicks', 'Evalia', 'Teana', 'X-Trail (Old)', '370Z', 'GT-R'
    ]
  },
  {
    id: 'datsun',
    name: 'Datsun',
    logo: '/brands/datsun.png',
    type: 'car',
    models: ['Go', 'Go Plus', 'redS-GO']
  },
  {
    id: 'mg',
    name: 'MG Motor',
    logo: '/brands/mg.png',
    type: 'car',
    models: ['Hector', 'Hector Plus', 'Astor', 'ZS EV', 'Comet EV', 'Windsor EV', 'Gloster']
  },
  {
    id: 'jeep',
    name: 'Jeep',
    logo: '/brands/jeep.png',
    type: 'car',
    models: ['Compass', 'Meridian', 'Wrangler', 'Grand Cherokee']
  },
  {
    id: 'citroen',
    name: 'Citroen',
    logo: '/brands/citroen.png',
    type: 'car',
    models: ['C3', 'eC3', 'C3 Aircross', 'Basalt', 'C5 Aircross']
  },
  {
    id: 'fiat',
    name: 'Fiat',
    logo: '/brands/fiat.png',
    type: 'car',
    models: ['Palio', 'Palio Stile', 'Punto', 'Punto Evo', 'Linea', 'Linea Classic', 'Avventura', 'Urban Cross', 'Abarth Punto']
  },
  {
    id: 'mitsubishi',
    name: 'Mitsubishi',
    logo: '/brands/mitsubishi.png',
    type: 'car',
    models: ['Lancer', 'Lancer Cedia', 'Pajero', 'Pajero Sport', 'Outlander', 'Montero']
  },
  {
    id: 'bmw',
    name: 'BMW',
    logo: '/brands/bmw.png',
    type: 'car',
    models: ['2 Series', '3 Series', '5 Series', '7 Series', 'X1', 'X3', 'X5', 'X7', 'Z4', 'M3', 'M4', 'M5']
  },
  {
    id: 'mercedes',
    name: 'Mercedes-Benz',
    logo: '/brands/mercedes.png',
    type: 'car',
    models: ['A-Class', 'C-Class', 'E-Class', 'S-Class', 'GLA', 'GLC', 'GLE', 'GLS', 'G-Wagon']
  },
  {
    id: 'audi',
    name: 'Audi',
    logo: '/brands/audi.png',
    type: 'car',
    models: ['A3', 'A4', 'A6', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'TT', 'R8']
  },
  {
    id: 'volvo',
    name: 'Volvo',
    logo: '/brands/volvo.png',
    type: 'car',
    models: ['XC40', 'XC40 Recharge', 'XC60', 'XC90', 'S90', 'C40 Recharge']
  },
  {
    id: 'force',
    name: 'Force Motors',
    logo: '/brands/force.png',
    type: 'car',
    models: ['Gurkha', 'Trax', 'Traveller', 'Tempo', 'Urbania']
  },

  // Bike Brands
  {
    id: 'hero',
    name: 'Hero MotoCorp',
    logo: '/brands/hero.png',
    type: 'bike',
    models: [
      'Splendor+', 'Splendor iSmart', 'Super Splendor', 'HF Deluxe', 'HF Dawn',
      'Passion', 'Passion Pro', 'Passion XTEC', 'Glamour', 'Glamour XTEC',
      'Xtreme 160R', 'Xtreme 200S', 'Xpulse 200', 'Xpulse 200T', 'Karizma ZMR', 'Karizma XMR',
      'Achiever', 'Hunk', 'CBZ Xtreme', 'Impulse',
      'Pleasure', 'Pleasure+', 'Maestro Edge', 'Destini 125', 'Vida V1'
    ]
  },
  {
    id: 'honda-bikes',
    name: 'Honda Motorcycles',
    logo: '/brands/honda-bikes.png',
    type: 'bike',
    models: [
      'Activa', 'Activa 3G/4G/5G/6G', 'Activa 125', 'Activa i',
      'Dio', 'Aviator', 'Grazia', 'Cliq', 'Navi',
      'Shine', 'CB Shine', 'SP 125', 'Unicorn 150', 'Unicorn 160', 'CB Unicorn',
      'Dream Yuga', 'Dream Neo', 'CD 110 Dream', 'Livo', 'Twister',
      'Hornet 160R', 'Hornet 2.0', 'X-Blade', 'CB350 H\'ness', 'CB350RS',
      'CBR 150R', 'CBR 250R', 'CBR 650R', 'CB300R', 'Africa Twin', 'Gold Wing'
    ]
  },
  {
    id: 'bajaj',
    name: 'Bajaj',
    logo: '/brands/bajaj.png',
    type: 'bike',
    models: [
      'Pulsar 150', 'Pulsar 180', 'Pulsar 220F', 'Pulsar NS200', 'Pulsar RS200', 'Pulsar N250', 'Pulsar F250',
      'Discover 100', 'Discover 125', 'Discover 135', 'Discover 150',
      'Platina 100', 'Platina 110', 'CT 100', 'CT 110X', 'Boxer', 'Caliber',
      'Avenger 150', 'Avenger 220 Cruise', 'Avenger 220 Street',
      'Dominar 250', 'Dominar 400', 'V15', 'V12',
      'Chetak Electric', 'Freedom 125 CNG'
    ]
  },
  {
    id: 'tvs',
    name: 'TVS Motor',
    logo: '/brands/tvs.png',
    type: 'bike',
    models: [
      'Apache RTR 160r', 'Apache RTR 180', 'Apache RTR 200 4V', 'Apache RR 310',
      'Jupiter', 'Jupiter 125', 'Ntorq 125', 'Scooty Pep+', 'Scooty Zest', 'Wego',
      'Sport', 'Star City+', 'Radeon', 'Victor', 'Metro', 'Fiero',
      'XL 100', 'XL Super', 'iQube Electric', 'Ronin'
    ]
  },
  {
    id: 'royal-enfield',
    name: 'Royal Enfield',
    logo: '/brands/royal-enfield.png',
    type: 'bike',
    models: [
      'Classic 350', 'Classic 500', 'Bullet 350', 'Bullet 500', 'Electra',
      'Thunderbird 350', 'Thunderbird 500', 'Meteor 350',
      'Himalayan 411', 'Himalayan 450', 'Scram 411',
      'Interceptor 650', 'Continental GT 650', 'Super Meteor 650', 'Shotgun 650', 'Hunter 350',
      'Machismo', 'Lightning'
    ]
  },
  {
    id: 'yamaha',
    name: 'Yamaha',
    logo: '/brands/yamaha.png',
    type: 'bike',
    models: [
      'R15 V1/V2/V3/V4', 'R15M', 'MT-15', 'FZ', 'FZ-S', 'Fazer', 'FZ-X', 'FZ-25', 'Fazer 25',
      'R3', 'MT-03', 'Gladiator', 'SZX', 'Libero', 'Crux', 'Enticer',
      'Fascino', 'Ray', 'Ray Z', 'Ray ZR', 'Alpha', 'Aerox 155'
    ]
  },
  {
    id: 'suzuki-bikes',
    name: 'Suzuki',
    logo: '/brands/suzuki-bikes.png',
    type: 'bike',
    models: [
      'Access 125', 'Burgman Street', 'Avenis', 'Lets', 'Swish',
      'Gixxer', 'Gixxer SF', 'Gixxer 250', 'Gixxer SF 250',
      'Intruder 150', 'V-Strom SX', 'Hayate', 'Slingshot', 'Zeus', 'Heat', 'GS150R', 'Inazuma', 'Hayabusa'
    ]
  },
  {
    id: 'ktm',
    name: 'KTM',
    logo: '/brands/ktm.png',
    type: 'bike',
    models: ['Duke 125', 'Duke 200', 'Duke 250', 'Duke 390', 'RC 125', 'RC 200', 'RC 390', 'Adventure 250', 'Adventure 390']
  },
  {
    id: 'kawasaki',
    name: 'Kawasaki',
    logo: '/brands/kawasaki.png',
    type: 'bike',
    models: ['Ninja 300', 'Ninja 400', 'Ninja 650', 'Z650', 'Z900', 'Versys 650', 'Vulcan S', 'ZX-10R', 'W175']
  },
  {
    id: 'benelli',
    name: 'Benelli',
    logo: '/brands/benelli.png',
    type: 'bike',
    models: ['Imperiale 400', 'Leoncino 250', 'Leoncino 500', 'TRK 251', 'TRK 502', 'TRK 502X', 'TNT 300', 'TNT 600i', '502C', 'Tornado 252R']
  },
  {
    id: 'jawa',
    name: 'Jawa / Yezdi',
    logo: '/brands/jawa.png',
    type: 'bike',
    models: ['Jawa', 'Jawa 42', 'Perak', '42 Bobber', 'Yezdi Roadster', 'Yezdi Scrambler', 'Yezdi Adventure']
  },
  {
    id: 'ola',
    name: 'Ola Electric',
    logo: '/brands/ola.png',
    type: 'bike',
    models: ['S1', 'S1 Pro', 'S1 Air', 'S1 X']
  },
  {
    id: 'ather',
    name: 'Ather Energy',
    logo: '/brands/ather.png',
    type: 'bike',
    models: ['450X', '450 Plus', '450S', 'Rizta']
  },
  {
    id: 'simple',
    name: 'Simple Energy',
    logo: '/brands/simple.png',
    type: 'bike',
    models: ['Simple One', 'Simple Dot One']
  },
  {
    id: 'revolt',
    name: 'Revolt Motors',
    logo: '/brands/revolt.png',
    type: 'bike',
    models: ['RV400', 'RV1', 'RV1+']
  },
  {
    id: 'ultraviolette',
    name: 'Ultraviolette',
    logo: '/brands/ultraviolette.png',
    type: 'bike',
    models: ['F77', 'F77 Mach 2', 'F99']
  },
  {
    id: 'tvs-electric',
    name: 'TVS Electric',
    logo: '/brands/tvs-electric.png',
    type: 'bike',
    models: ['iQube', 'iQube S', 'iQube ST', 'X']
  },
  {
    id: 'bajaj-electric',
    name: 'Bajaj Electric',
    logo: '/brands/bajaj-electric.png',
    type: 'bike',
    models: ['Chetak']
  }
];

export const getCarBrands = () => indianVehicleBrands.filter(brand => brand.type === 'car' || brand.type === 'both');
export const getBikeBrands = () => indianVehicleBrands.filter(brand => brand.type === 'bike' || brand.type === 'both');
export const getCommercialBrands = () => indianVehicleBrands.filter(brand =>
  ['tata', 'mahindra', 'force', 'bajaj'].includes(brand.id)
);

export const getEVBrands = () =>
  indianVehicleBrands.filter((brand) =>
    brand.models.some((model) => /(ev|electric|e-)/i.test(model))
  );

export const getBrandModels = (brandId: string): string[] => {
  const brand = indianVehicleBrands.find(b => b.id === brandId || b.name === brandId);
  return brand ? brand.models : [];
};
