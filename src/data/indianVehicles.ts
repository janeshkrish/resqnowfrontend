/**
 * Cars, two-wheelers and commercial vehicles seen on Indian roads: on sale now, no longer
 * sold, and imported. Every model carries the class the request form prices it by
 * (lib/vehicleClasses). A "*" before a model puts it in the popular list shown before the
 * customer types.
 */
import type { VehicleClassId } from "@/lib/vehicleClasses";
import { electricClassFor } from "@/lib/vehicleClasses";

export type CatalogFamily = "car" | "bike" | "commercial";
export type CatalogStatus = "sale" | "old" | "import";

type Row = {
  /** Defaults to the brand's status. */
  s?: CatalogStatus;
  c: VehicleClassId;
  /** Comma-separated model names; "*" marks a popular one. */
  m: string;
  /** Electric models; a class here overrides the one worked out from `c`. */
  ev?: true | VehicleClassId;
};

type BrandSpec = {
  id: string;
  name: string;
  short?: string;
  logo?: string;
  family: CatalogFamily;
  status?: CatalogStatus;
  popular?: boolean;
  rows: Row[];
};

const SALE = "sale" as const;
const OLD = "old" as const;
const IMPORT = "import" as const;

const BRANDS: BrandSpec[] = [
  // ---------------------------------------------------------------- cars
  {
    id: "maruti-suzuki", name: "Maruti Suzuki", short: "Maruti", logo: "/brands/maruti-suzuki.png", family: "car", popular: true,
    rows: [
      { c: "hatchback", m: "Alto K10, S-Presso, Celerio, *Wagon R, Ignis, *Swift, *Baleno" },
      { c: "sedan", m: "*Dzire, Ciaz" },
      { c: "compact-suv", m: "*Brezza, Fronx, Grand Vitara, Jimny" },
      { c: "big-suv", m: "*Ertiga, XL6, Invicto, Eeco" },
      { s: OLD, c: "hatchback", m: "800, Alto 800, Alto, Zen, Zen Estilo, A-Star, Ritz, Swift (1st Gen), Swift (2nd Gen)" },
      { s: OLD, c: "sedan", m: "Esteem, Dzire (Old), Swift Dzire, SX4, Kizashi, Baleno (Old Sedan)" },
      { s: OLD, c: "compact-suv", m: "Vitara Brezza (Old), S-Cross, Gypsy, Grand Vitara (Old)" },
      { s: OLD, c: "big-suv", m: "Omni, Versa" },
    ],
  },
  {
    id: "hyundai", name: "Hyundai", logo: "/brands/hyundai.png", family: "car", popular: true,
    rows: [
      { c: "hatchback", m: "*Grand i10 NIOS, *i20, i20 N Line" },
      { c: "sedan", m: "Aura, *Verna" },
      { c: "compact-suv", m: "Exter, *Venue, Venue N Line, *Creta, Creta N Line" },
      { c: "compact-suv", m: "Creta Electric", ev: true },
      { c: "big-suv", m: "Alcazar, Tucson" },
      { c: "big-suv", m: "Ioniq 5", ev: "electric-suv" },
      { s: OLD, c: "hatchback", m: "Santro, Santro Xing, Eon, Getz, Getz Prime, i10, Grand i10, i20 Active" },
      { s: OLD, c: "sedan", m: "Xcent, Accent, Verna (Old), Elantra, Sonata, Sonata Embera, Sonata Transform" },
      { s: OLD, c: "compact-suv", m: "Kona Electric", ev: true },
      { s: OLD, c: "big-suv", m: "Terracan, Santa Fe" },
    ],
  },
  {
    id: "tata", name: "Tata Motors", short: "Tata", logo: "/brands/tata.png", family: "car", popular: true,
    rows: [
      { c: "hatchback", m: "*Tiago, *Altroz, Altroz Racer" },
      { c: "hatchback", m: "Tiago EV", ev: true },
      { c: "sedan", m: "Tigor" },
      { c: "sedan", m: "Tigor EV", ev: true },
      { c: "compact-suv", m: "*Punch, *Nexon, Curvv" },
      { c: "compact-suv", m: "*Punch EV, *Nexon EV, Curvv EV", ev: true },
      { c: "big-suv", m: "Harrier, Safari" },
      { c: "big-suv", m: "Harrier EV", ev: true },
      { s: OLD, c: "hatchback", m: "Indica, Indica V2, Indica Vista, Nano, Nano GenX, Bolt" },
      { s: OLD, c: "sedan", m: "Indigo, Indigo CS, Indigo Manza, Zest" },
      { s: OLD, c: "big-suv", m: "Sumo, Sumo Gold, Sumo Grande, Safari (Old), Safari Storme, Aria, Hexa, Sierra, Estate" },
    ],
  },
  {
    id: "mahindra", name: "Mahindra", logo: "/brands/mahindra.png", family: "car", popular: true,
    rows: [
      { c: "compact-suv", m: "*XUV 3XO" },
      { c: "compact-suv", m: "XUV400 EV, BE 6", ev: true },
      { c: "big-suv", m: "*XUV700, Scorpio Classic, *Scorpio-N, *Thar, Thar Roxx, *Bolero, Bolero Neo, Bolero Neo Plus, Marazzo" },
      { c: "big-suv", m: "XEV 9e", ev: true },
      { s: OLD, c: "hatchback", m: "Verito Vibe" },
      { s: OLD, c: "hatchback", m: "Reva-i, e2o, e2o Plus", ev: true },
      { s: OLD, c: "sedan", m: "Verito, Logan" },
      { s: OLD, c: "sedan", m: "e-Verito", ev: true },
      { s: OLD, c: "compact-suv", m: "KUV100, KUV100 NXT, TUV300, XUV300, NuvoSport, Quanto" },
      { s: OLD, c: "big-suv", m: "TUV300 Plus, XUV500, Xylo, Alturas G4, Scorpio (Old), Armada, Commander" },
    ],
  },
  {
    id: "honda-cars", name: "Honda Cars", short: "Honda", logo: "/brands/honda-cars.png", family: "car", popular: true,
    rows: [
      { c: "sedan", m: "*Amaze, *City, City e:HEV" },
      { c: "compact-suv", m: "Elevate" },
      { s: OLD, c: "hatchback", m: "Brio, Jazz" },
      { s: OLD, c: "sedan", m: "City (Dolphin), Civic, Accord" },
      { s: OLD, c: "compact-suv", m: "WR-V" },
      { s: OLD, c: "big-suv", m: "Mobilio, BR-V, CR-V" },
    ],
  },
  {
    id: "toyota", name: "Toyota", logo: "/brands/toyota.png", family: "car", popular: true,
    rows: [
      { c: "hatchback", m: "Glanza" },
      { c: "compact-suv", m: "Urban Cruiser Hyryder, Urban Cruiser Taisor" },
      { c: "big-suv", m: "Rumion, *Innova Crysta, Innova Hycross, *Fortuner, Fortuner Legender, Hilux" },
      { c: "luxury", m: "Camry, Vellfire, Land Cruiser" },
      { s: OLD, c: "hatchback", m: "Etios Liva, Etios Cross" },
      { s: OLD, c: "sedan", m: "Etios, Corolla, Corolla Altis, Yaris" },
      { s: OLD, c: "compact-suv", m: "Urban Cruiser" },
      { s: OLD, c: "big-suv", m: "Qualis, Innova" },
      { s: OLD, c: "luxury", m: "Prado, Prius" },
    ],
  },
  {
    id: "kia", name: "Kia", logo: "/brands/kia.png", family: "car", popular: true,
    rows: [
      { c: "compact-suv", m: "*Sonet, *Seltos, Syros" },
      { c: "big-suv", m: "Carens" },
      { c: "luxury", m: "Carnival" },
      { c: "luxury", m: "EV6, EV9", ev: "electric-suv" },
    ],
  },
  {
    id: "mg", name: "MG Motor", short: "MG", logo: "/brands/mg.png", family: "car", popular: true,
    rows: [
      { c: "compact-suv", m: "Astor" },
      { c: "compact-suv", m: "ZS EV, *Windsor EV", ev: true },
      { c: "hatchback", m: "Comet EV", ev: true },
      { c: "big-suv", m: "*Hector, Hector Plus, Gloster" },
    ],
  },
  {
    id: "renault", name: "Renault", logo: "/brands/renault.png", family: "car",
    rows: [
      { c: "hatchback", m: "Kwid" },
      { c: "compact-suv", m: "Kiger" },
      { c: "big-suv", m: "Triber" },
      { s: OLD, c: "hatchback", m: "Pulse" },
      { s: OLD, c: "sedan", m: "Scala, Fluence" },
      { s: OLD, c: "compact-suv", m: "Duster, Captur" },
      { s: OLD, c: "big-suv", m: "Lodgy, Koleos" },
    ],
  },
  {
    id: "nissan", name: "Nissan", logo: "/brands/nissan.png", family: "car",
    rows: [
      { c: "compact-suv", m: "Magnite" },
      { c: "big-suv", m: "X-Trail" },
      { s: OLD, c: "hatchback", m: "Micra, Micra Active" },
      { s: OLD, c: "sedan", m: "Sunny, Teana" },
      { s: OLD, c: "compact-suv", m: "Terrano, Kicks" },
      { s: OLD, c: "big-suv", m: "Evalia, X-Trail (Old)" },
      { s: OLD, c: "luxury", m: "370Z, GT-R" },
      { s: IMPORT, c: "luxury", m: "Patrol" },
    ],
  },
  {
    id: "datsun", name: "Datsun", family: "car", status: OLD,
    rows: [
      { c: "hatchback", m: "Go, redi-GO" },
      { c: "big-suv", m: "Go Plus" },
    ],
  },
  {
    id: "volkswagen", name: "Volkswagen", logo: "/brands/volkswagen.png", family: "car",
    rows: [
      { c: "sedan", m: "Virtus" },
      { c: "compact-suv", m: "Taigun" },
      { c: "big-suv", m: "Tiguan" },
      { s: OLD, c: "hatchback", m: "Polo, Polo GT" },
      { s: OLD, c: "sedan", m: "Ameo, Vento, Jetta, Passat" },
      { s: OLD, c: "compact-suv", m: "T-Roc" },
      { s: OLD, c: "big-suv", m: "Tiguan Allspace" },
      { s: OLD, c: "luxury", m: "Beetle, Phaeton, Touareg" },
    ],
  },
  {
    id: "skoda", name: "Skoda", logo: "/brands/skoda.png", family: "car",
    rows: [
      { c: "sedan", m: "Slavia, Superb" },
      { c: "compact-suv", m: "Kushaq, Kylaq" },
      { c: "big-suv", m: "Kodiaq" },
      { s: OLD, c: "hatchback", m: "Fabia" },
      { s: OLD, c: "sedan", m: "Rapid, Octavia, Octavia RS, Laura" },
      { s: OLD, c: "compact-suv", m: "Yeti, Karoq" },
    ],
  },
  {
    id: "jeep", name: "Jeep", family: "car",
    rows: [
      { c: "compact-suv", m: "Compass" },
      { c: "big-suv", m: "Meridian" },
      { c: "luxury", m: "Wrangler, Grand Cherokee" },
    ],
  },
  {
    id: "citroen", name: "Citroen", family: "car",
    rows: [
      { c: "hatchback", m: "C3" },
      { c: "hatchback", m: "eC3", ev: true },
      { c: "compact-suv", m: "Basalt, C3 Aircross, C5 Aircross" },
    ],
  },
  {
    id: "isuzu", name: "Isuzu", family: "car",
    rows: [
      { c: "big-suv", m: "D-Max V-Cross, MU-X" },
      { s: OLD, c: "big-suv", m: "MU-7" },
    ],
  },
  {
    id: "force", name: "Force Motors", short: "Force", family: "car",
    rows: [
      { c: "big-suv", m: "Gurkha" },
      { s: OLD, c: "big-suv", m: "Trax, Force One" },
    ],
  },
  {
    id: "vinfast", name: "VinFast", family: "car",
    rows: [{ c: "compact-suv", m: "VF6, VF7", ev: true }],
  },
  {
    id: "byd", name: "BYD", family: "car",
    rows: [
      { c: "compact-suv", m: "Atto 3", ev: true },
      { c: "big-suv", m: "eMAX 7", ev: true },
      { c: "luxury", m: "Seal", ev: "electric-car" },
      { c: "luxury", m: "Sealion 7", ev: "electric-suv" },
      { s: OLD, c: "big-suv", m: "e6", ev: true },
    ],
  },
  {
    id: "tesla", name: "Tesla", family: "car",
    rows: [
      { c: "luxury", m: "Model Y", ev: "electric-suv" },
      { s: IMPORT, c: "luxury", m: "Model 3", ev: "electric-car" },
    ],
  },
  {
    id: "bmw", name: "BMW", logo: "/brands/bmw.png", family: "car",
    rows: [
      { c: "luxury", m: "2 Series, 3 Series, 5 Series, 7 Series, X1, X3, X5, X7, Z4, M3, M4, M5" },
      { c: "luxury", m: "i4, i7", ev: "electric-car" },
      { c: "luxury", m: "iX, iX1", ev: "electric-suv" },
      { s: OLD, c: "luxury", m: "1 Series, X4, X6" },
    ],
  },
  {
    id: "mercedes", name: "Mercedes-Benz", short: "Mercedes", family: "car",
    rows: [
      { c: "luxury", m: "A-Class, C-Class, E-Class, S-Class, GLA, GLC, GLE, GLS, G-Wagon, Maybach" },
      { c: "luxury", m: "EQS", ev: "electric-car" },
      { c: "luxury", m: "EQA, EQB, EQS SUV", ev: "electric-suv" },
      { s: OLD, c: "luxury", m: "B-Class, CLA, M-Class, GL-Class" },
    ],
  },
  {
    id: "audi", name: "Audi", logo: "/brands/audi.png", family: "car",
    rows: [
      { c: "luxury", m: "A4, A6, A8, Q3, Q5, Q7, Q8" },
      { c: "luxury", m: "e-tron GT", ev: "electric-car" },
      { c: "luxury", m: "Q8 e-tron", ev: "electric-suv" },
      { s: OLD, c: "luxury", m: "A3, Q2, TT, R8" },
      { s: OLD, c: "luxury", m: "e-tron", ev: "electric-suv" },
    ],
  },
  {
    id: "volvo", name: "Volvo", family: "car",
    rows: [
      { c: "luxury", m: "XC60, XC90, S90" },
      { c: "luxury", m: "XC40 Recharge, C40 Recharge, EX40", ev: "electric-suv" },
      { s: OLD, c: "luxury", m: "XC40, S60, S80, V40" },
    ],
  },
  {
    id: "land-rover", name: "Land Rover", family: "car",
    rows: [
      { c: "luxury", m: "Defender, Discovery, Discovery Sport, Range Rover, Range Rover Sport, Range Rover Velar, Range Rover Evoque" },
      { s: OLD, c: "luxury", m: "Freelander 2" },
    ],
  },
  {
    id: "jaguar", name: "Jaguar", family: "car",
    rows: [
      { c: "luxury", m: "F-Pace, F-Type" },
      { c: "luxury", m: "I-Pace", ev: "electric-suv" },
      { s: OLD, c: "luxury", m: "XE, XF, XJ" },
    ],
  },
  {
    id: "lexus", name: "Lexus", family: "car",
    rows: [{ c: "luxury", m: "ES, NX, RX, LX, LM" }],
  },
  {
    id: "mini", name: "Mini", family: "car",
    rows: [
      { c: "luxury", m: "Cooper, Countryman" },
      { c: "luxury", m: "Cooper SE", ev: "electric-car" },
    ],
  },
  {
    id: "porsche", name: "Porsche", family: "car",
    rows: [
      { c: "luxury", m: "911, 718, Macan, Cayenne, Panamera" },
      { c: "luxury", m: "Taycan", ev: "electric-car" },
    ],
  },
  {
    id: "maserati", name: "Maserati", family: "car",
    rows: [{ c: "luxury", m: "Ghibli, Levante, Grecale, Quattroporte" }],
  },
  {
    id: "lamborghini", name: "Lamborghini", family: "car",
    rows: [
      { c: "luxury", m: "Urus, Huracan, Revuelto" },
      { s: OLD, c: "luxury", m: "Aventador" },
    ],
  },
  {
    id: "ferrari", name: "Ferrari", family: "car",
    rows: [{ c: "luxury", m: "Roma, 296 GTB, SF90, Purosangue" }],
  },
  {
    id: "rolls-royce", name: "Rolls-Royce", family: "car",
    rows: [{ c: "luxury", m: "Ghost, Cullinan, Phantom" }],
  },
  {
    id: "bentley", name: "Bentley", family: "car",
    rows: [{ c: "luxury", m: "Bentayga, Continental GT, Flying Spur" }],
  },
  {
    id: "aston-martin", name: "Aston Martin", family: "car",
    rows: [{ c: "luxury", m: "DB12, Vantage, DBX" }],
  },
  {
    id: "ford", name: "Ford", logo: "/brands/ford.png", family: "car", status: OLD,
    rows: [
      { c: "hatchback", m: "Figo, Freestyle, Fusion" },
      { c: "sedan", m: "Figo Aspire, Fiesta, Classic, Ikon, Escort, Mondeo" },
      { c: "compact-suv", m: "EcoSport" },
      { c: "big-suv", m: "Endeavour" },
      { c: "luxury", m: "Mustang" },
      { s: IMPORT, c: "big-suv", m: "F-150" },
    ],
  },
  {
    id: "chevrolet", name: "Chevrolet", family: "car", status: OLD,
    rows: [
      { c: "hatchback", m: "Spark, Beat, Sail UVA, Aveo UVA" },
      { c: "sedan", m: "Sail, Aveo, Optra, Optra Magnum, Cruze" },
      { c: "compact-suv", m: "Forester" },
      { c: "big-suv", m: "Tavera, Enjoy, Captiva, Trailblazer" },
      { c: "luxury", m: "Camaro" },
      { s: IMPORT, c: "luxury", m: "Corvette" },
    ],
  },
  {
    id: "fiat", name: "Fiat", family: "car", status: OLD,
    rows: [
      { c: "hatchback", m: "Uno, Palio, Palio Stile, Punto, Punto Evo, Abarth Punto" },
      { c: "sedan", m: "Siena, Petra, Linea, Linea Classic" },
      { c: "compact-suv", m: "Avventura, Urban Cross" },
    ],
  },
  {
    id: "mitsubishi", name: "Mitsubishi", logo: "/brands/mitsubishi.png", family: "car", status: OLD,
    rows: [
      { c: "sedan", m: "Lancer, Lancer Cedia" },
      { c: "big-suv", m: "Pajero, Pajero Sport, Outlander, Montero" },
    ],
  },
  {
    id: "subaru", name: "Subaru", family: "car", status: OLD,
    rows: [
      { c: "sedan", m: "Impreza" },
      { c: "compact-suv", m: "Forester" },
      { c: "big-suv", m: "Outback" },
    ],
  },
  {
    id: "opel", name: "Opel", family: "car", status: OLD,
    rows: [{ c: "sedan", m: "Astra, Corsa, Vectra" }],
  },
  {
    id: "hindustan-motors", name: "Hindustan Motors", short: "Hindustan", family: "car", status: OLD,
    rows: [{ c: "sedan", m: "Ambassador, Contessa" }],
  },
  {
    id: "premier", name: "Premier", family: "car", status: OLD,
    rows: [
      { c: "sedan", m: "Padmini, 118 NE" },
      { c: "compact-suv", m: "Rio" },
    ],
  },
  {
    id: "daewoo", name: "Daewoo", family: "car", status: OLD,
    rows: [
      { c: "hatchback", m: "Matiz" },
      { c: "sedan", m: "Cielo, Nexia" },
    ],
  },
  {
    id: "hummer", name: "Hummer", family: "car", status: IMPORT,
    rows: [{ c: "luxury", m: "H2, H3" }],
  },
  {
    id: "dodge", name: "Dodge", family: "car", status: IMPORT,
    rows: [{ c: "luxury", m: "Challenger, Charger" }],
  },

  // ---------------------------------------------------------------- two-wheelers
  {
    id: "hero", name: "Hero MotoCorp", short: "Hero", logo: "/brands/hero.png", family: "bike", popular: true,
    rows: [
      { c: "scooter", m: "*Pleasure+, Destini 125, Xoom, Maestro Edge" },
      { c: "scooter", m: "Vida V1, Vida VX2", ev: true },
      { c: "commuter-bike", m: "*Splendor+, Super Splendor, *HF Deluxe, Passion+, Passion XTEC, *Glamour, Glamour XTEC, Xtreme 125R" },
      { c: "sports-bike", m: "Xtreme 160R, Karizma XMR" },
      { c: "premium-bike", m: "Xpulse 200, Mavrick 440" },
      { s: OLD, c: "scooter", m: "Pleasure, Maestro, Duet" },
      { s: OLD, c: "commuter-bike", m: "Splendor iSmart, HF Dawn, Passion, Passion Pro, Achiever, Hunk, Ignitor" },
      { s: OLD, c: "sports-bike", m: "Xtreme 200S, Karizma ZMR, CBZ Xtreme" },
      { s: OLD, c: "premium-bike", m: "Xpulse 200T, Impulse" },
    ],
  },
  {
    id: "honda-bikes", name: "Honda Motorcycles", short: "Honda", logo: "/brands/honda-bikes.png", family: "bike", popular: true,
    rows: [
      { c: "scooter", m: "*Activa, *Activa 125, Dio, Dio 125" },
      { c: "scooter", m: "Activa e:, QC1", ev: true },
      { c: "commuter-bike", m: "*Shine, Shine 100, *SP 125, SP 160, Unicorn, Livo, CD 110 Dream" },
      { c: "sports-bike", m: "Hornet 2.0, CBR 650R" },
      { c: "premium-bike", m: "CB350 H'ness, CB350RS, CB350, CB300R, Africa Twin, Gold Wing" },
      { s: OLD, c: "scooter", m: "Activa 3G/4G/5G/6G, Activa i, Aviator, Grazia, Cliq, Navi" },
      { s: OLD, c: "commuter-bike", m: "CB Shine, Unicorn 150, Unicorn 160, CB Unicorn, Dream Yuga, Dream Neo, Twister, Stunner, CB Trigger" },
      { s: OLD, c: "sports-bike", m: "Hornet 160R, X-Blade, CBR 150R, CBR 250R" },
    ],
  },
  {
    id: "bajaj", name: "Bajaj", logo: "/brands/bajaj.png", family: "bike", popular: true,
    rows: [
      { c: "commuter-bike", m: "*Platina 100, Platina 110, CT 110X, Pulsar 125, *Pulsar 150, Pulsar N160, Pulsar NS125, Freedom 125 CNG" },
      { c: "sports-bike", m: "Pulsar NS160, *Pulsar NS200, Pulsar RS200, Pulsar N250, Pulsar 220F" },
      { c: "premium-bike", m: "Dominar 250, Dominar 400, Avenger 160 Street, Avenger 220 Cruise" },
      { c: "scooter", m: "Chetak Electric", ev: true },
      { s: OLD, c: "scooter", m: "Chetak (petrol), Super, Legend" },
      { s: OLD, c: "commuter-bike", m: "Pulsar 180, Discover 100, Discover 125, Discover 135, Discover 150, CT 100, Boxer, Caliber, V15, V12, XCD 125" },
      { s: OLD, c: "sports-bike", m: "Pulsar F250" },
      { s: OLD, c: "premium-bike", m: "Avenger 150, Avenger 220 Street" },
    ],
  },
  {
    id: "tvs", name: "TVS Motor", short: "TVS", logo: "/brands/tvs.png", family: "bike", popular: true,
    rows: [
      { c: "scooter", m: "*Jupiter, Jupiter 125, *Ntorq 125, Scooty Pep+, Scooty Zest, XL 100" },
      { c: "scooter", m: "iQube Electric", ev: true },
      { c: "commuter-bike", m: "Sport, Star City+, Radeon, *Raider 125, *Apache RTR 160, Apache RTR 160 4V" },
      { c: "sports-bike", m: "Apache RTR 180, Apache RTR 200 4V, Apache RR 310, Apache RTR 310" },
      { c: "premium-bike", m: "Ronin" },
      { s: OLD, c: "scooter", m: "Wego, XL Super, Scooty" },
      { s: OLD, c: "commuter-bike", m: "Victor, Metro, Fiero, Max 100, Centra, Phoenix, Flame" },
    ],
  },
  {
    id: "royal-enfield", name: "Royal Enfield", logo: "/brands/royal-enfield.png", family: "bike", popular: true,
    rows: [
      {
        c: "premium-bike",
        m: "*Classic 350, *Bullet 350, Meteor 350, *Hunter 350, Himalayan 450, Scram 440, Guerrilla 450, Interceptor 650, Continental GT 650, Super Meteor 650, Shotgun 650, Bear 650, Classic 650",
      },
      { s: OLD, c: "premium-bike", m: "Classic 500, Bullet 500, Electra, Thunderbird 350, Thunderbird 500, Himalayan 411, Scram 411, Machismo, Lightning" },
    ],
  },
  {
    id: "yamaha", name: "Yamaha", logo: "/brands/yamaha.png", family: "bike", popular: true,
    rows: [
      { c: "scooter", m: "Fascino, *Ray ZR, Aerox 155" },
      { c: "commuter-bike", m: "*FZ, FZ-S, FZ-X" },
      { c: "sports-bike", m: "*R15 V4, R15M, R15S, MT-15, R3, MT-03" },
      { s: OLD, c: "scooter", m: "Alpha, Ray, Ray Z" },
      { s: OLD, c: "commuter-bike", m: "Fazer, Gladiator, SZX, Libero, Crux, Enticer, YBX, RX 100, RX 135" },
      { s: OLD, c: "sports-bike", m: "R15 V1/V2/V3, FZ-25, Fazer 25, RD 350" },
    ],
  },
  {
    id: "suzuki-bikes", name: "Suzuki", logo: "/brands/suzuki-bikes.png", family: "bike", popular: true,
    rows: [
      { c: "scooter", m: "*Access 125, Burgman Street, Avenis" },
      { c: "sports-bike", m: "Gixxer, Gixxer SF, Gixxer 250, Gixxer SF 250, Hayabusa" },
      { c: "premium-bike", m: "V-Strom SX" },
      { s: OLD, c: "scooter", m: "Lets, Swish" },
      { s: OLD, c: "commuter-bike", m: "Hayate, Slingshot, Zeus, Heat, GS150R, Samurai, Shogun" },
      { s: OLD, c: "premium-bike", m: "Intruder 150, Inazuma" },
    ],
  },
  {
    id: "ktm", name: "KTM", logo: "/brands/ktm.png", family: "bike", popular: true,
    rows: [
      { c: "sports-bike", m: "Duke 125, *Duke 200, Duke 250, *Duke 390, RC 125, RC 200, RC 390" },
      { c: "premium-bike", m: "Adventure 250, Adventure 390" },
    ],
  },
  {
    id: "kawasaki", name: "Kawasaki", family: "bike",
    rows: [
      { c: "commuter-bike", m: "W175" },
      { c: "sports-bike", m: "Ninja 300, Ninja 400, Ninja 500, Ninja 650, Z650, Z900, Ninja ZX-6R, ZX-10R" },
      { c: "premium-bike", m: "Versys 650, Vulcan S, Eliminator" },
    ],
  },
  {
    id: "harley-davidson", name: "Harley-Davidson", short: "Harley", family: "bike",
    rows: [
      { c: "premium-bike", m: "X440, Nightster, Street Bob, Fat Bob, Fat Boy, Pan America" },
      { s: OLD, c: "premium-bike", m: "Street 750, Street Rod, Iron 883" },
    ],
  },
  {
    id: "triumph", name: "Triumph", family: "bike",
    rows: [
      { c: "premium-bike", m: "Speed 400, Scrambler 400 X, Bonneville T100, Bonneville T120, Tiger 900" },
      { c: "sports-bike", m: "Street Triple" },
    ],
  },
  {
    id: "bmw-motorrad", name: "BMW Motorrad", short: "BMW", family: "bike",
    rows: [
      { c: "sports-bike", m: "G 310 R, G 310 RR, S 1000 RR" },
      { c: "premium-bike", m: "G 310 GS, R 1250 GS" },
    ],
  },
  {
    id: "ducati", name: "Ducati", family: "bike",
    rows: [
      { c: "sports-bike", m: "Panigale V2, Monster" },
      { c: "premium-bike", m: "Scrambler, Multistrada, Diavel" },
    ],
  },
  {
    id: "husqvarna", name: "Husqvarna", family: "bike",
    rows: [
      { c: "sports-bike", m: "Vitpilen 250" },
      { c: "premium-bike", m: "Svartpilen 401" },
    ],
  },
  {
    id: "aprilia", name: "Aprilia", family: "bike",
    rows: [
      { c: "scooter", m: "SR 125, SR 160" },
      { c: "sports-bike", m: "RS 457, Tuono 457" },
    ],
  },
  {
    id: "vespa", name: "Vespa", family: "bike",
    rows: [{ c: "scooter", m: "Vespa VXL, Vespa SXL, Vespa ZX" }],
  },
  {
    id: "benelli", name: "Benelli", family: "bike",
    rows: [
      { c: "premium-bike", m: "Imperiale 400, Leoncino 250, Leoncino 500, TRK 251, TRK 502, TRK 502X, 502C" },
      { s: OLD, c: "sports-bike", m: "TNT 300, TNT 600i, Tornado 252R" },
    ],
  },
  {
    id: "jawa", name: "Jawa / Yezdi", short: "Jawa", family: "bike",
    rows: [
      { c: "premium-bike", m: "Jawa, Jawa 42, Perak, 42 Bobber, Yezdi Roadster, Yezdi Scrambler, Yezdi Adventure" },
      { s: OLD, c: "commuter-bike", m: "Jawa 250, Yezdi Roadking, Yezdi CL-II" },
    ],
  },
  {
    id: "hero-honda", name: "Hero Honda", family: "bike", status: OLD,
    rows: [
      { c: "scooter", m: "Pleasure" },
      { c: "commuter-bike", m: "Splendor, Splendor Plus, CD 100, CD Dawn, Passion, Ambition, Hunk, Glamour, Achiever, Street" },
      { c: "sports-bike", m: "Karizma, CBZ" },
    ],
  },
  {
    id: "kinetic", name: "Kinetic", family: "bike", status: OLD,
    rows: [
      { c: "scooter", m: "Kinetic Honda, Luna, Zing, Nova, Blaze" },
      { s: SALE, c: "scooter", m: "E-Luna", ev: true },
      { c: "commuter-bike", m: "Boss" },
    ],
  },
  {
    id: "lml", name: "LML", family: "bike", status: OLD,
    rows: [
      { c: "scooter", m: "Select, NV, Star" },
      { c: "commuter-bike", m: "Freedom, Adreno" },
    ],
  },
  {
    id: "rajdoot", name: "Rajdoot", family: "bike", status: OLD,
    rows: [
      { c: "commuter-bike", m: "Rajdoot 175" },
      { c: "sports-bike", m: "350" },
    ],
  },
  {
    id: "ola", name: "Ola Electric", short: "Ola", logo: "/brands/ola.png", family: "bike", popular: true,
    rows: [
      { c: "scooter", m: "S1, *S1 Pro, S1 Air, S1 X", ev: true },
      { c: "commuter-bike", m: "Roadster", ev: true },
    ],
  },
  {
    id: "ather", name: "Ather Energy", short: "Ather", logo: "/brands/ather.png", family: "bike", popular: true,
    rows: [
      { c: "scooter", m: "*450X, 450S, 450 Apex, *Rizta", ev: true },
      { s: OLD, c: "scooter", m: "450, 450 Plus", ev: true },
    ],
  },
  {
    id: "tvs-electric", name: "TVS Electric", short: "TVS", family: "bike",
    rows: [{ c: "scooter", m: "*iQube, iQube S, iQube ST, X", ev: true }],
  },
  {
    id: "bajaj-electric", name: "Bajaj Electric", short: "Bajaj", logo: "/brands/bajaj-electric.png", family: "bike",
    rows: [{ c: "scooter", m: "*Chetak", ev: true }],
  },
  {
    id: "simple", name: "Simple Energy", short: "Simple", family: "bike",
    rows: [{ c: "scooter", m: "Simple One, Simple Dot One", ev: true }],
  },
  {
    id: "revolt", name: "Revolt Motors", short: "Revolt", family: "bike",
    rows: [{ c: "commuter-bike", m: "RV400, RV1, RV1+", ev: true }],
  },
  {
    id: "ultraviolette", name: "Ultraviolette", family: "bike",
    rows: [{ c: "sports-bike", m: "F77, F77 Mach 2", ev: true }],
  },
  {
    id: "ampere", name: "Ampere", family: "bike",
    rows: [
      { c: "scooter", m: "Magnus, Nexus", ev: true },
      { s: OLD, c: "scooter", m: "Reo", ev: true },
    ],
  },
  {
    id: "okinawa", name: "Okinawa", family: "bike",
    rows: [{ c: "scooter", m: "Praise, iPraise+, Ridge, Okhi-90", ev: true }],
  },
  {
    id: "hero-electric", name: "Hero Electric", family: "bike", status: OLD,
    rows: [{ c: "scooter", m: "Optima, Photon, Flash, NYX", ev: true }],
  },
  {
    id: "river", name: "River", family: "bike",
    rows: [{ c: "scooter", m: "Indie", ev: true }],
  },

  // ---------------------------------------------------------------- commercial
  {
    id: "tata-commercial", name: "Tata Motors", short: "Tata", logo: "/brands/tata.png", family: "commercial", popular: true,
    rows: [
      { c: "pickup-mini-truck", m: "*Ace, Ace Gold, *Intra V10, Intra V30, Intra V50, Yodha" },
      { c: "pickup-mini-truck", m: "Ace EV", ev: "electric-car" },
      { c: "tempo-van", m: "Magic, *Winger" },
      { c: "light-commercial", m: "*407, 709, 1109, Ultra T.7" },
      { c: "heavy-truck", m: "LPT 1618, Signa, Prima, Starbus" },
      { s: OLD, c: "pickup-mini-truck", m: "Super Ace, Xenon" },
      { s: OLD, c: "tempo-van", m: "Venture" },
    ],
  },
  {
    id: "mahindra-commercial", name: "Mahindra", logo: "/brands/mahindra.png", family: "commercial", popular: true,
    rows: [
      { c: "pickup-mini-truck", m: "*Bolero Pik-Up, Bolero Maxx Pik-Up, *Jeeto, Supro Mini Truck, Imperio" },
      { c: "tempo-van", m: "Supro Van, Tourister" },
      { c: "light-commercial", m: "Furio 7, Loadking Optimo" },
      { c: "heavy-truck", m: "Furio 14, Blazo X, Cruzio" },
      { s: OLD, c: "pickup-mini-truck", m: "Maxx Pik-Up" },
      { s: OLD, c: "tempo-van", m: "Maxximo" },
    ],
  },
  {
    id: "ashok-leyland", name: "Ashok Leyland", short: "Leyland", family: "commercial", popular: true,
    rows: [
      { c: "pickup-mini-truck", m: "*Dost, *Bada Dost, Dost+" },
      { c: "light-commercial", m: "Partner, Ecomet, Boss" },
      { c: "tempo-van", m: "Mitr" },
      { c: "heavy-truck", m: "1618, 2820, 4220, Viking, Falcon, Oyster" },
    ],
  },
  {
    id: "eicher", name: "Eicher", family: "commercial", popular: true,
    rows: [
      { c: "light-commercial", m: "Pro 2049, *Pro 2059, Pro 2095, Pro 2110" },
      { c: "heavy-truck", m: "Pro 3015, Pro 6048, Skyline" },
    ],
  },
  {
    id: "bharatbenz", name: "BharatBenz", family: "commercial",
    rows: [
      { c: "light-commercial", m: "1015R" },
      { c: "heavy-truck", m: "1617R, 2823R, 3523R, 5528T, BharatBenz Bus" },
    ],
  },
  {
    id: "force-commercial", name: "Force Motors", short: "Force", family: "commercial", popular: true,
    rows: [
      { c: "tempo-van", m: "*Traveller, Urbania, Trax Cruiser" },
      { s: OLD, c: "pickup-mini-truck", m: "Kargo King" },
      { s: OLD, c: "tempo-van", m: "Tempo Traveller, Matador" },
    ],
  },
  {
    id: "maruti-commercial", name: "Maruti Suzuki", short: "Maruti", logo: "/brands/maruti-suzuki.png", family: "commercial",
    rows: [
      { c: "pickup-mini-truck", m: "Super Carry" },
      { c: "tempo-van", m: "Eeco Cargo" },
      { s: OLD, c: "tempo-van", m: "Omni Cargo" },
    ],
  },
  {
    id: "isuzu-commercial", name: "Isuzu", family: "commercial",
    rows: [{ c: "pickup-mini-truck", m: "D-Max, S-CAB" }],
  },
  {
    id: "piaggio", name: "Piaggio", family: "commercial",
    rows: [{ c: "pickup-mini-truck", m: "Porter 700" }],
  },
  {
    id: "sml-isuzu", name: "SML Isuzu", family: "commercial",
    rows: [
      { c: "light-commercial", m: "Sartaj, Samrat" },
      { c: "heavy-truck", m: "Prestige" },
    ],
  },
  {
    id: "volvo-commercial", name: "Volvo Trucks & Buses", short: "Volvo", family: "commercial",
    rows: [{ c: "heavy-truck", m: "FM, FH, 9400 Bus" }],
  },
  {
    id: "scania", name: "Scania", family: "commercial",
    rows: [{ c: "heavy-truck", m: "Scania Truck, Scania Bus" }],
  },
];

export type CatalogBrand = {
  id: string;
  name: string;
  short: string;
  logo: string | null;
  family: CatalogFamily;
  status: CatalogStatus;
  popular: boolean;
  /** Has at least one electric model (shown in the EV lists). */
  hasEv: boolean;
};

export type CatalogModel = {
  id: string;
  brandId: string;
  brand: string;
  short: string;
  model: string;
  family: CatalogFamily;
  vehicleClass: VehicleClassId;
  /** The class in the EV lists; null for non-electric models. */
  evClass: VehicleClassId | null;
  status: CatalogStatus;
  popular: boolean;
};

// "Pleasure+" and "Pleasure" are different scooters.
const slug = (text: string) => text.toLowerCase().replace(/\+/g, " plus").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const CATALOG_BRANDS: CatalogBrand[] = [];
export const VEHICLE_CATALOG: CatalogModel[] = [];

for (const spec of BRANDS) {
  const brandStatus = spec.status ?? SALE;
  let hasEv = false;
  for (const row of spec.rows) {
    for (const raw of row.m.split(",")) {
      const text = raw.trim();
      if (!text) continue;
      const popular = text.startsWith("*");
      const model = popular ? text.slice(1).trim() : text;
      const evClass = row.ev ? (row.ev === true ? electricClassFor(row.c) : row.ev) : null;
      hasEv ||= Boolean(evClass);
      VEHICLE_CATALOG.push({
        id: `${spec.id}-${slug(model)}`,
        brandId: spec.id,
        brand: spec.name,
        short: spec.short ?? spec.name,
        model,
        family: spec.family,
        vehicleClass: row.c,
        evClass,
        status: row.s ?? brandStatus,
        popular,
      });
    }
  }
  CATALOG_BRANDS.push({
    id: spec.id,
    name: spec.name,
    short: spec.short ?? spec.name,
    logo: spec.logo ?? null,
    family: spec.family,
    status: brandStatus,
    popular: Boolean(spec.popular),
    hasEv,
  });
}

// ---------------------------------------------------------------- older shape, used by My garage

export interface VehicleBrand {
  id: string;
  name: string;
  logo: string;
  type: 'car' | 'bike' | 'both';
  models: string[];
}

const DEFAULT_LOGO = '/brands/default-brand.png';

/** Car and bike brands with their model names (commercial vehicles aren't saved in My garage). */
export const indianVehicleBrands: VehicleBrand[] = CATALOG_BRANDS
  .filter((brand) => brand.family !== 'commercial')
  .map((brand) => ({
    id: brand.id,
    name: brand.name,
    logo: brand.logo ?? DEFAULT_LOGO,
    type: brand.family === 'bike' ? 'bike' : 'car',
    models: VEHICLE_CATALOG.filter((model) => model.brandId === brand.id).map((model) => model.model),
  }));

export const getCarBrands = () => indianVehicleBrands.filter(brand => brand.type === 'car' || brand.type === 'both');
export const getBikeBrands = () => indianVehicleBrands.filter(brand => brand.type === 'bike' || brand.type === 'both');
export const getCommercialBrands = (): VehicleBrand[] =>
  CATALOG_BRANDS.filter((brand) => brand.family === 'commercial').map((brand) => ({
    id: brand.id,
    name: brand.name,
    logo: brand.logo ?? DEFAULT_LOGO,
    type: 'car',
    models: VEHICLE_CATALOG.filter((model) => model.brandId === brand.id).map((model) => model.model),
  }));

export const getEVBrands = () =>
  indianVehicleBrands.filter((brand) => CATALOG_BRANDS.some((entry) => entry.id === brand.id && entry.hasEv));

export const getBrandModels = (brandId: string): string[] => {
  const brand = indianVehicleBrands.find(b => b.id === brandId || b.name === brandId);
  return brand ? brand.models : [];
};
