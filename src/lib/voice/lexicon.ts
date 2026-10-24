/**
 * What ResQNow-Thozhan understands and says. The questions themselves come from
 * config/requestQuestions.ts; this file only adds, for each of them, the words that answer it
 * (English, Tanglish and Tamil script) and the line Thozhan says when the answer is missing.
 * lexicon.test.ts fails when the form gains a question or option that has no words or prompt here.
 */
import type { ServiceKey } from "@/config/requestQuestions";
import type { VehicleFamily } from "@/lib/vehicleClasses";

export type Lang = "en" | "tg" | "ta";
/** A line in each language; `say` is the Tanglish line in Tamil script, for a Tamil voice to read aloud. */
export type L3 = Record<Lang, string> & { say?: string };
const L = (en: string, tg: string, ta: string, say?: string): L3 => ({ en, tg, ta, ...(say ? { say } : {}) });

export const NOT_SURE = /not sure|don'?t know|dont know|theriyala|theriyadhu|தெரியல|தெரியாது/i;
export const YES = /^(yes|yeah|yep|ok|okay|correct|right|aamaa|aama|amaa|adhe|sari|seri|ஆமா|ஆமாம்|அதே|சரி)\b/i;
export const NO = /^(no|nope|illa|illai|vera|different|another|இல்லை|வேறு)\b/i;
export const SKIP = /^(skip|no|none|illa|theriyala|don'?t know|வேண்டாம்|இல்லை)\b/i;

/** Which service a sentence is about. Order matters: the first rule that matches wins. */
export const SERVICE_WORDS: Array<[ServiceKey, RegExp]> = [
  ["sos", /emergency|\bsos\b|kaappathunga|help me|காப்பாத்துங்க|அவசர/i],
  ["ev-charging", /charge (illa|theernduchu|poyiduchu|kammi|low|zero|dead|mudinjiduchu)|out of charge|no charge|charging|சார்ஜ்/i],
  ["winching", /ditch|kuzhi|pallam|\bmud\b|sethu|chetru|\bsand\b|slipped|fell into|thanni-?la|drain|பள்ளம்|சேறு|குழி/i],
  ["flat-tire", /punct\w*|punchar|pancher|\bflat\b|\btyre|\btire|tyar|பஞ்சர்|டயர்/i],
  ["battery", /battery|start aagala|won'?t start|not starting|பேட்டரி|ஸ்டார்ட் ஆக/i],
  ["fuel", /petrol|diesel|\bfuel\b|\bcng\b|பெட்ரோல்|டீசல்|எரிபொருள்/i],
  ["lockout", /\bkeys?\b|saavi|chaavi|locked|lockout|சாவி/i],
  ["towing", /\btow\w*|breakdown|broke down|nikkudhu|nindhuduchu|accident|crash|டோயிங்|விபத்து|பழுது/i],
  ["mechanical", /engine|smoke|noise|sound|overheat|heat|brake|gear|leak|mechanic|repair|பிரேக்|புகை|சத்தம்|இன்ஜின்/i],
];

/** Which kind of vehicle. "vandi" and "vaaganam" say a vehicle but not which. */
export const FAMILY_WORDS: Array<[VehicleFamily, RegExp]> = [
  ["ev", /\bev\b|electric|e-?scooter|e-?bike|எலக்ட்ரிக்/i],
  ["commercial", /lorry|truck|tempo|\bvan\b|pick-?up|mini ?truck|\bbus\b|goods vehicle|லாரி|டெம்போ|வேன்|டிரக்/i],
  ["car", /\bcar\b|கார்|four[- ]?wheeler|4 ?wheeler/i],
  ["bike", /\bbike\b|motor ?bike|motorcycle|scooty|scooter|two[- ]?wheeler|2 ?wheeler|பைக்|ஸ்கூட்டி|ஸ்கூட்டர்|டூ ?வீலர்/i],
];
export const GENERIC_VEHICLE = /\b(vandi|vaaganam|vehicle)\b|வண்டி|வாகனம்/i;
export const HIGHWAY = /highway|nedunjaalai|நெடுஞ்சாலை/i;

type Words = Record<string, RegExp>;
const HURT_WORDS: Words = {
  yes: /\bhurt|injur|bleed|blood|adi pattu|adi pattirukku|adi pattuchu|ratham|ambulance|காயம்|அடிபட்டு|ரத்தம்/i,
  no: /no one|nobody|not hurt|yaarukkum (adi )?(illa|padala)|adi padala|safe|everyone.{0,6}(ok|fine)|யாருக்கும் இல்லை|அடிபடல/i,
};

/** The words that answer each question, keyed by service, question id and option value. */
export const ANSWER_WORDS: Record<ServiceKey, Record<string, Words>> = {
  sos: {
    hurt: HURT_WORDS,
    what: { accident: /accident|crash|\bhit\b|mothi|இடி|விபத்து/i, breakdown: /breakdown|stopped|nikkudhu|nindhuduchu|பழுது/i,
      stuck: /stuck|ditch|\bmud\b|water|kuzhi|sethu|maattikichu|மாட்டி/i, unsure: NOT_SURE },
  },
  towing: {
    why: { accident: /accident|crash|mothi|விபத்து/i, nostart: /won'?t start|not starting|start aagala|start aaga maatt|ஸ்டார்ட் ஆக/i,
      breakdown: /breakdown|broke down|nikkudhu|nindhuduchu|stopped|பழுது|நின்னுடுச்சு/i, other: /something else|vera edho/i },
    roll: { no: /won'?t move|can'?t (move|push)|not moving|locked|jam|nagaradhu|nagarala|thalla mudiyaadhu|நகரவில்லை|நகரல|^no\b/i,
      yes: /\bmoves|it rolls|can (be )?push|nagarudhu|thalla mudiyum|நகர்கிறது|நகருது|^yes\b/i, dk: NOT_SURE },
  },
  "flat-tire": {
    tyretype: { tubeless: /tube ?less|டியூப்லெஸ்/i, tube: /\btube\b(?! ?less)|tube tyre|டியூப் டயர்|டியூப்(?!லெஸ்)/i, dk: NOT_SURE },
    tyre: {
      fl: /front left|left front|munnadi left|left munnadi/i, fr: /front right|right front|munnadi right|right munnadi/i,
      rl: /(back|rear) left|left (back|rear)|pinnadi left|left pinnadi/i, rr: /(back|rear) right|right (back|rear)|pinnadi right|right pinnadi/i,
      front: /front|munnadi|munnaadi|முன்|ஃப்ரண்ட்/i, rear: /\bback\b|rear|pinnadi|pinnaadi|பின்|பேக்/i,
    },
    spare: { repair: /repair|no stepney|stepney illa|spare illa|don'?t have (a )?(stepney|spare)|ஸ்டெப்னி இல்ல/i,
      spare: /stepney (irukku|iruku|undu)|have (a )?(stepney|spare)|fit (the )?(stepney|spare)|spare (irukku|iruku)|ஸ்டெப்னி இருக்கு/i },
    damage: { torn: /torn|\bcut\b|kizhinj|கிழி/i, rim: /bent|\brim\b|valanj|வளை/i,
      flat: /only flat|just flat|flat mattum|kaathu (mattum|poyiduchu)|air (mattum|poyiduchu)|காத்து போயிடுச்சு/i },
  },
  battery: {
    battery_scope: { auxiliary: /small|12 ?v|auxiliary|chinna/i, traction: /main|traction|drive battery|periya/i, unknown: NOT_SURE },
    symptom: { click: /tik|click|tak ?tak|டிக்/i, lights: /only (the )?lights?|light mattum|லைட் மட்டும்/i, slow: /weak|slowly|tries|try pannudhu|stops/i,
      dead: /nothing (at all|happens)|no (light|sound)|onnum (aagala|illa)|சத்தமே இல்லை|ஒன்னும் ஆகல/i },
    need: { jump: /jump/i, new: /new battery|pudhu battery|change (the )?battery|replace|புது பேட்டரி|புதிய பேட்டரி/i, dk: NOT_SURE },
    age: { lt2: /\b(one|1|oru) (year|varusham)|less than 2|recently/i, "2to4": /\b(2|3|4|two|three|four|rendu|moonu|naalu) (years?|varusham)/i,
      gt4: /\b([5-9]|five|six|anju|aaru) (years?|varusham)|more than 4|very old|romba pazhaya/i, dk: NOT_SURE },
  },
  mechanical: {
    help: { tow: /garage|workshop|shed|\btow|கேரேஜ்/i, inspect: /check|inspect|here|inga|spot-?la|இங்கே/i },
    mechanical_scope: { chassis: /wheel|brake|suspension/i, "ev-system": /motor|controller|electric|wiring|display/i, unknown: NOT_SURE },
    issue: { nostart: /won'?t start|start aagala/i, heat: /overheat|heat|soodu|சூடு/i, noise: /noise|sound|sattham|சத்தம்/i,
      light: /warning light|light (eriyudhu|varudhu|on)/i, smoke: /smoke|pugai|புகை/i, brakes: /brake|பிரேக்/i, gears: /gear|கியர்/i,
      leak: /leak|\boil\b|ozhugudhu|ஒழுகு/i, other: /something else|vera edho/i },
    drive: { no: /can'?t drive|cannot drive|stuck|won'?t move|otta mudiyaadhu|nagaradhu|ஓட்ட முடியாது/i, yes: /can drive|slowly|mella|otta mudiyum|ஓட்ட முடியும்|^yes\b/i },
  },
  fuel: {
    fuel: { petrol: /petrol|பெட்ரோல்/i, diesel: /diesel|டீசல்/i, cng: /\bcng\b|\bgas\b/i },
    qty: {},
  },
  lockout: {
    inside: { yes: /(baby|child|kid|kuzhandhai|paapa|dog|cat|pet|naai|someone|my (son|daughter)).{0,24}(inside|ulla)|ulla (kuzhandhai|paapa|naai)|குழந்தை/i,
      no: /no one|nobody|yaarum illa|^no\b|^illa\b|யாரும் இல்லை/i },
    what: { inside: /(key|saavi|chaavi).{0,16}(inside|ulla)|locked inside|ulla (vechu|maattikichu)|உள்ளே/i, lost: /\blost\b|kaanom|missing|தொலை|காணோம்/i,
      broken: /broke|odanj|stuck in (the )?lock|உடை/i, remote: /remote|fob|central lock/i },
  },
  winching: {
    hurt: HURT_WORDS,
    where: { ditch: /ditch|kuzhi|pallam|பள்ளம்|குழி/i, mud: /\bmud|sand|sethu|chetru|மணல்|சேறு/i, water: /water|flood|thanni|drain|தண்ணீர்|தண்ணி/i,
      slope: /slope|hill|yetram|ஏற்ற/i },
    upright: { no: /fell|toppled|overturn|saanj|kavizh|கவிழ்/i, yes: /standing|on (its|the) wheels|nikkudhu|^yes\b/i },
    far: { lt5: /\b[1-4] ?(m|meter|metre|steps?|adi)\b|right next|pakkathula|kitta/i, "5to15": /\b([5-9]|1[0-5]) ?(m|meter|metre|steps?|adi)\b/i,
      more: /far|romba dhooram|more than 15|தூரம்/i },
  },
  "ev-charging": {
    left: { "0": /\b0 ?%|zero|fully (dead|empty)|charge (illa|zero|theernduchu)|சார்ஜ் இல்லை/i, lt5: /\b[1-4] ?(%|percent)|below 5|less than 5/i,
      "5to10": /\b([5-9]|10) ?(%|percent)/i, dk: NOT_SURE },
    port: { ccs2: /ccs ?2|\bccs\b/i, type2: /type ?2/i, home: /3 ?pin|three pin|home plug|normal plug|veetu plug/i,
      brand: /(ather|ola|tvs|bajaj|brand|company).{0,14}(charger|plug)|own charger/i, dk: NOT_SURE },
    plan: { tow: /\btow|kondu po|take (it )?to/i, charge: /charge (it )?here|inga charge|here/i },
  },
  other: {},
};

/** Questions answered by a number of litres rather than a word. */
export const LITRE_QUESTIONS = new Set(["fuel.qty"]);
const LITRE_WORDS: Record<string, number> = { one: 1, oru: 1, two: 2, rendu: 2, three: 3, moonu: 3, five: 5, anju: 5, ten: 10, pathu: 10, twenty: 20, irubadhu: 20 };
export function litresIn(text: string): { n: number; quote: string } | null {
  const m = /\b(\d+|one|oru|two|rendu|three|moonu|five|anju|ten|pathu|twenty|irubadhu)\s*(l\b|litres?|liters?|ltrs?|லிட்டர்)/i.exec(text);
  if (!m) return null;
  return { n: LITRE_WORDS[m[1].toLowerCase()] ?? Number(m[1]), quote: m[0] };
}

/** What Thozhan says when the answer to a form question is missing. */
export const QUESTION_PROMPTS: Record<ServiceKey, Record<string, L3>> = {
  sos: {
    hurt: L("First, is anyone hurt?", "Mudhalla, yaarukkaachum adi pattirukkaa?", "முதலில், யாருக்காவது அடிபட்டிருக்கிறதா?", "முதல்ல, யாருக்காச்சும் அடி பட்டிருக்கா?"),
    what: L("What happened? You can skip this.", "Enna aachu? Venumna skip pannunga.", "என்ன ஆச்சு? தவிர்க்கலாம்.", "என்ன ஆச்சு? வேணும்னா ஸ்கிப் பண்ணுங்க."),
  },
  towing: {
    why: L("What happened to the vehicle: a breakdown, an accident, or it won’t start?", "Vandikku enna aachu: breakdown-aa, accident-aa, illa start aagalayaa?", "வாகனத்துக்கு என்ன ஆச்சு: பழுதா, விபத்தா, ஸ்டார்ட் ஆகவில்லையா?", "வண்டிக்கு என்ன ஆச்சு: பிரேக்டவுனா, ஆக்சிடென்டா, இல்ல ஸ்டார்ட் ஆகலையா?"),
    roll: L("Put it in neutral and try pushing a little. Does it move?", "Neutral-la pottu konjam thalli paarunga. Nagarudhaa?", "நியூட்ரலில் போட்டு கொஞ்சம் தள்ளிப் பாருங்கள். நகர்கிறதா?", "நியூட்ரல்ல போட்டு கொஞ்சம் தள்ளிப் பாருங்க. நகருதா?"),
  },
  "flat-tire": {
    tyretype: L("Is it a tube tyre or tubeless?", "Tube tyre-aa, tubeless-aa?", "டியூப் டயரா, டியூப்லெஸ்ஸா?", "ட்யூப் டயரா, ட்யூப்லெஸ்ஸா?"),
    tyre: L("Which tyre is flat?", "Endha tyre flat aayirukku?", "எந்த டயர் பஞ்சர்?", "எந்த டயர் ஃப்ளாட் ஆயிருக்கு?"),
    spare: L("Do you have a stepney, or should we repair the tyre?", "Stepney irukkaa, illa tyre-a repair pannanumaa?", "ஸ்டெப்னி இருக்கிறதா, அல்லது டயரை சரிசெய்யணுமா?", "ஸ்டெப்னி இருக்கா, இல்ல டயர ரிப்பேர் பண்ணணுமா?"),
    damage: L("How does the tyre look: only flat, torn, or is the wheel bent?", "Tyre eppadi irukku: flat mattum-aa, kizhinjirukkaa, illa wheel valanjirukkaa?", "டயர் எப்படி இருக்கிறது: காற்று மட்டும் போனதா, கிழிந்ததா, சக்கரம் வளைந்ததா?", "டயர் எப்படி இருக்கு: ஃப்ளாட் மட்டுமா, கிழிஞ்சிருக்கா, இல்ல வீல் வளைஞ்சிருக்கா?"),
  },
  battery: {
    battery_scope: L("Which battery needs help: the small 12-volt one, or the main drive battery?", "Endha battery: chinna 12V battery-aa, illa main battery-aa?", "எந்த பேட்டரி: சிறிய 12V பேட்டரியா, முதன்மை பேட்டரியா?", "எந்த பேட்டரி: சின்ன பன்னிரண்டு வோல்ட் பேட்டரியா, இல்ல மெயின் பேட்டரியா?"),
    symptom: L("When you try to start it, what happens?", "Start pannum bodhu enna aagudhu?", "ஸ்டார்ட் செய்யும்போது என்ன ஆகிறது?", "ஸ்டார்ட் பண்ணும் போது என்ன ஆகுது?"),
    need: L("Do you need a jump-start or a new battery?", "Jump-start podhumaa, illa pudhu battery venumaa?", "ஜம்ப்-ஸ்டார்ட் போதுமா, புதிய பேட்டரி வேண்டுமா?", "ஜம்ப் ஸ்டார்ட் போதுமா, இல்ல புது பேட்டரி வேணுமா?"),
    age: L("Roughly how old is the battery? You can skip this.", "Battery evlo varusham aachu? Theriyalana skip pannunga.", "பேட்டரி எத்தனை வருடம் ஆனது? தெரியாவிட்டால் தவிர்க்கலாம்.", "பேட்டரி எவ்ளோ வருஷம் ஆச்சு? தெரியலன்னா ஸ்கிப் பண்ணுங்க."),
  },
  mechanical: {
    help: L("Should a mechanic check it here, or take it to a garage?", "Mechanic inga vandhu check pannanumaa, illa garage-ku kondu poganumaa?", "மெக்கானிக் இங்கே வந்து பார்க்கணுமா, கேரேஜுக்கு கொண்டு போகணுமா?", "மெக்கானிக் இங்க வந்து செக் பண்ணணுமா, இல்ல கேரேஜுக்கு கொண்டு போகணுமா?"),
    mechanical_scope: L("What needs a look: wheels and brakes, or the motor and electricals?", "Wheel, brake problem-aa, illa motor, electrical problem-aa?", "சக்கரம், பிரேக் பிரச்சனையா, மோட்டார், மின் பிரச்சனையா?", "வீல், பிரேக் பிராப்ளமா, இல்ல மோட்டார், எலக்ட்ரிக்கல் பிராப்ளமா?"),
    issue: L("What do you notice? Tap all that apply, or skip.", "Enna problem therinjudhu? Ellaam thattunga, illa skip pannunga.", "என்ன கவனிக்கிறீர்கள்? பொருந்துவதைத் தட்டுங்கள்.", "என்ன பிராப்ளம் தெரிஞ்சுது? எல்லாம் தட்டுங்க, இல்ல ஸ்கிப் பண்ணுங்க."),
    drive: L("Can you still drive it slowly?", "Mella otta mudiyumaa?", "மெதுவாக ஓட்ட முடியுமா?", "மெல்ல ஓட்ட முடியுமா?"),
  },
  fuel: {
    fuel: L("Which fuel: petrol, diesel or CNG?", "Petrol-aa, diesel-aa, illa CNG-aa?", "பெட்ரோலா, டீசலா, CNG-யா?", "பெட்ரோலா, டீசலா, இல்ல சி.என்.ஜி.யா?"),
    qty: L("How much fuel should we bring?", "Evlo litre venum?", "எத்தனை லிட்டர் வேண்டும்?", "எவ்ளோ லிட்டர் வேணும்?"),
  },
  lockout: {
    inside: L("First, is a child, person or pet stuck inside?", "Mudhalla, ulla kuzhandhai, yaaraachum, illa pet maattirukkaangalaa?", "முதலில், உள்ளே குழந்தை, யாராவது அல்லது செல்லப்பிராணி மாட்டியிருக்கிறதா?", "முதல்ல, உள்ள குழந்தை, யாராச்சும், இல்ல பெட் மாட்டிருக்காங்களா?"),
    what: L("Where is your key?", "Key enga irukku?", "சாவி எங்கே?", "கீ எங்க இருக்கு?"),
  },
  winching: {
    hurt: L("First, is anyone hurt?", "Mudhalla, yaarukkaachum adi pattirukkaa?", "முதலில், யாருக்காவது அடிபட்டிருக்கிறதா?", "முதல்ல, யாருக்காச்சும் அடி பட்டிருக்கா?"),
    where: L("Where is it stuck: a ditch, mud, water or a slope?", "Enga maattikichu: kuzhi-la-aa, sethu-la-aa, thanni-la-aa, illa yetram-aa?", "எங்கே மாட்டியது: பள்ளம், சேறு, தண்ணீர், அல்லது சரிவு?", "எங்க மாட்டிக்கிச்சு: குழியிலயா, சேத்துலயா, தண்ணியிலயா, இல்ல ஏத்தமா?"),
    upright: L("Is it standing on its wheels?", "Vandi wheel mela nikkudhaa, illa saanjiduchaa?", "வாகனம் சக்கரங்களில் நிற்கிறதா, கவிழ்ந்ததா?", "வண்டி வீல் மேல நிக்குதா, இல்ல சாஞ்சிடுச்சா?"),
    far: L("How far is it from the road? One big step is about a metre.", "Road-la irundhu evlo dhooram? Oru periya adi oru meter.", "சாலையிலிருந்து எவ்வளவு தூரம்? ஒரு பெரிய அடி ஒரு மீட்டர்.", "ரோட்ல இருந்து எவ்ளோ தூரம்? ஒரு பெரிய அடி ஒரு மீட்டர்."),
  },
  "ev-charging": {
    left: L("How much charge is left?", "Evlo charge irukku?", "எவ்வளவு சார்ஜ் உள்ளது?", "எவ்ளோ சார்ஜ் இருக்கு?"),
    port: L("Which socket does it have? Open the charging flap and match the shape.", "Endha socket irukku? Charging flap-a thirandhu paarunga.", "எந்த சாக்கெட் உள்ளது? சார்ஜிங் மூடியைத் திறந்து பாருங்கள்.", "எந்த சாக்கெட் இருக்கு? சார்ஜிங் ஃப்ளாப்ப திறந்து பாருங்க."),
    plan: L("Charge it here, or tow it to a charger?", "Inga charge pannalaamaa, illa charger-ku tow pannanumaa?", "இங்கேயே சார்ஜ் செய்யலாமா, சார்ஜருக்கு இழுத்துச் செல்லலாமா?", "இங்க சார்ஜ் பண்ணலாமா, இல்ல சார்ஜருக்கு டோ பண்ணணுமா?"),
  },
  other: {},
};

/** The form's callouts, said aloud: keyed service.question.answer. */
export const CALLOUT_LINES: Record<string, L3> = {
  "sos.hurt.yes": L("Call 108 for an ambulance first. We’ll still send help to your vehicle.", "Mudhalla 108-ku call panni ambulance kooptunga. Unga vandikku help naanga anuppuvom.", "முதலில் 108-ஐ அழைத்து ஆம்புலன்ஸ் வரவழையுங்கள். உங்கள் வாகனத்துக்கு உதவி அனுப்புகிறோம்.", "முதல்ல நூத்தி எட்டுக்கு கால் பண்ணி ஆம்புலன்ஸ் கூப்டுங்க. உங்க வண்டிக்கு ஹெல்ப் நாங்க அனுப்புவோம்."),
  "winching.hurt.yes": L("Call 108 for an ambulance first. Don’t try to move the vehicle yourself.", "Mudhalla 108-ku call pannunga. Vandi-a neengale nagaththa try pannaadheenga.", "முதலில் 108-ஐ அழையுங்கள். வாகனத்தை நீங்களே நகர்த்த முயற்சிக்காதீர்கள்.", "முதல்ல நூத்தி எட்டுக்கு கால் பண்ணுங்க. வண்டிய நீங்களே நகத்த ட்ரை பண்ணாதீங்க."),
  "towing.why.accident": L("If anyone is hurt, call 108 first. Take photos of the damage for insurance.", "Yaarukkaachum adi pattirundha mudhalla 108-ku call pannunga. Insurance-ku damage-a photo edunga.", "யாருக்காவது அடிபட்டிருந்தால் முதலில் 108-ஐ அழையுங்கள். காப்பீட்டுக்கு சேதத்தை புகைப்படம் எடுங்கள்.", "யாருக்காச்சும் அடி பட்டிருந்தா முதல்ல நூத்தி எட்டுக்கு கால் பண்ணுங்க. இன்சூரன்ஸுக்கு டேமேஜ போட்டோ எடுங்க."),
  "flat-tire.damage.torn": L("A torn tyre can’t be repaired. The mechanic will fit a stepney or arrange a tow.", "Kizhinja tyre-a repair panna mudiyaadhu. Mechanic stepney poduvaaru, illa tow arrange pannuvaaru.", "கிழிந்த டயரை சரிசெய்ய முடியாது. மெக்கானிக் ஸ்டெப்னி போடுவார், அல்லது இழுத்துச் செல்ல ஏற்பாடு செய்வார்.", "கிழிஞ்ச டயர ரிப்பேர் பண்ண முடியாது. மெக்கானிக் ஸ்டெப்னி போடுவாரு, இல்ல டோ அரேஞ்ச் பண்ணுவாரு."),
  "flat-tire.damage.rim": L("A bent wheel may not hold air. The mechanic will check and suggest a tow if needed.", "Valanja wheel-la kaathu nikkaadhu. Mechanic paathutu thevaina tow solluvaaru.", "வளைந்த சக்கரத்தில் காற்று நிற்காது. மெக்கானிக் பார்த்து தேவைப்பட்டால் இழுத்துச் செல்லச் சொல்வார்.", "வளைஞ்ச வீல்ல காத்து நிக்காது. மெக்கானிக் பாத்துட்டு தேவைன்னா டோ சொல்லுவாரு."),
  "mechanical.help.tow": L("We’ll move you to towing so you can pick the garage.", "Garage-a neenga choose panna, idha towing-ku maathuvom.", "கேரேஜை நீங்கள் தேர்வு செய்ய, இதை டோயிங்கிற்கு மாற்றுவோம்.", "கேரேஜ நீங்க சூஸ் பண்ண, இத டோயிங்குக்கு மாத்துவோம்."),
  "mechanical.issue.heat": L("Switch the engine off. Don’t open the radiator cap while it’s hot.", "Engine-a off pannunga. Soodaa irukkum bodhu radiator cap-a thirakkaadheenga.", "இன்ஜினை அணையுங்கள். சூடாக இருக்கும்போது ரேடியேட்டர் மூடியைத் திறக்காதீர்கள்.", "இன்ஜின ஆஃப் பண்ணுங்க. சூடா இருக்கும் போது ரேடியேட்டர் கேப்ப திறக்காதீங்க."),
  "fuel.fuel.cng": L("CNG can’t be brought in a can. We can tow you to the nearest CNG pump.", "CNG-a can-la kondu vara mudiyaadhu. Pakkathu CNG pump-ku tow pannalaam.", "CNG-ஐ கேனில் கொண்டு வர முடியாது. அருகிலுள்ள CNG பம்புக்கு இழுத்துச் செல்லலாம்.", "சி.என்.ஜி.ய கேன்ல கொண்டு வர முடியாது. பக்கத்து சி.என்.ஜி. பம்புக்கு டோ பண்ணலாம்."),
  "lockout.inside.yes": L("If it’s hot or they look unwell, call 112 now. We’ve marked this urgent.", "Soodaa irundhaalo, udambu sariyilladha maadhiri therinjaalo, ippove 112-ku call pannunga. Idha urgent-nu mark pannitten.", "வெப்பமாக இருந்தாலோ உடல்நலம் சரியில்லாதது போல் தெரிந்தாலோ, இப்போதே 112-ஐ அழையுங்கள். இதை அவசரம் என்று குறித்துவிட்டேன்.", "சூடா இருந்தாலோ, உடம்பு சரியில்லாத மாதிரி தெரிஞ்சாலோ, இப்பவே நூத்தி பன்னிரண்டுக்கு கால் பண்ணுங்க. இத அர்ஜென்ட்னு மார்க் பண்ணிட்டேன்."),
  "winching.upright.no": L("This needs a crane. We’ll send a bigger recovery truck, which costs more.", "Idhukku crane venum. Periya recovery truck anuppuvom, konjam adhigam aagum.", "இதற்கு கிரேன் தேவை. பெரிய மீட்பு வாகனம் அனுப்புவோம், செலவு கொஞ்சம் அதிகம்.", "இதுக்கு கிரேன் வேணும். பெரிய ரிக்கவரி டிரக் அனுப்புவோம், கொஞ்சம் அதிகம் ஆகும்."),
  "ev-charging.port.dk": L("A known socket is needed for charging. If you’re not sure, towing to a charger is the safe choice.", "Charge panna socket theriyanum. Theriyalana charger-ku tow pannuradhu safe.", "சார்ஜ் செய்ய சாக்கெட் தெரிய வேண்டும். தெரியாவிட்டால் சார்ஜருக்கு இழுத்துச் செல்வதே பாதுகாப்பானது.", "சார்ஜ் பண்ண சாக்கெட் தெரியணும். தெரியலன்னா சார்ஜருக்கு டோ பண்றது சேஃப்."),
  "ev-charging.plan.tow": L("Towing arranges a carrier to take it to a charger.", "Charger-ku kondu poga towing carrier arrange pannuvom.", "சார்ஜருக்கு கொண்டு செல்ல டோயிங் வாகனம் ஏற்பாடு செய்வோம்.", "சார்ஜருக்கு கொண்டு போக டோயிங் கேரியர் அரேஞ்ச் பண்ணுவோம்."),
};

/** How Thozhan names each service and reacts to it. */
export const SERVICE_TALK: Record<ServiceKey, { label: L3; react: L3 }> = {
  sos: { label: L("Emergency", "Emergency", "அவசர உதவி", "எமர்ஜென்சி"), react: L("I’m here with you.", "Naan irukken, bayappadaadheenga.", "நான் இருக்கிறேன், பயப்படாதீர்கள்.", "நான் இருக்கேன், பயப்படாதீங்க.") },
  towing: { label: L("Towing", "Towing", "டோயிங்", "டோயிங்"), react: L("That sounds stressful.", "Aiyo, kashtam dhaan.", "அய்யோ, கஷ்டம்தான்.", "அய்யோ, கஷ்டம் தான்.") },
  "flat-tire": { label: L("Puncture", "Puncture", "பஞ்சர்", "பஞ்சர்"), react: L("Oh no, a puncture!", "Aiyo, puncture-aa!", "அய்யோ, பஞ்சரா!", "அய்யோ, பஞ்சரா!") },
  battery: { label: L("Battery", "Battery", "பேட்டரி", "பேட்டரி"), react: L("Ah, the battery’s given up.", "Aiyo, battery down-aa!", "அய்யோ, பேட்டரி போயிடுச்சா!", "அய்யோ, பேட்டரி டவுனா!") },
  mechanical: { label: L("Mechanic", "Mechanic", "மெக்கானிக்", "மெக்கானிக்"), react: L("Hmm, let’s get that looked at.", "Hmm, adha paathudalaam.", "ம்ம், அதைப் பார்த்துவிடலாம்.", "ம்ம், அத பாத்துடலாம்.") },
  fuel: { label: L("Fuel", "Fuel", "எரிபொருள்", "ஃப்யூல்"), react: L("Out of fuel? Happens to everyone.", "Petrol theernduchaa? Paravaala, ellarukkum nadakkum.", "எரிபொருள் தீர்ந்ததா? பரவாயில்லை, எல்லோருக்கும் நடக்கும்.", "பெட்ரோல் தீர்ந்துச்சா? பரவால்ல, எல்லாருக்கும் நடக்கும்.") },
  lockout: { label: L("Lockout", "Key lockout", "சாவி உதவி", "கீ லாக்அவுட்"), react: L("Locked out? We’ll get you back in.", "Key maattikichaa? Open pannidalaam.", "சாவி மாட்டிக்கொண்டதா? திறந்துவிடலாம்.", "கீ மாட்டிக்கிச்சா? ஓப்பன் பண்ணிடலாம்.") },
  winching: { label: L("Stuck vehicle", "Vandi maattikichu", "வாகனம் மாட்டியது", "வண்டி மாட்டிக்கிச்சு"), react: L("Okay, we’ll pull it out.", "Sari, vandi-a veliya eduthudalaam.", "சரி, வாகனத்தை வெளியே எடுத்துவிடலாம்.", "சரி, வண்டிய வெளிய எடுத்துடலாம்.") },
  "ev-charging": { label: L("EV charging", "EV charging", "EV சார்ஜிங்", "ஈ.வி. சார்ஜிங்"), react: L("Out of charge? We’ll bring power to you.", "Charge theernduchaa? Charge kondu varalaam.", "சார்ஜ் தீர்ந்ததா? சார்ஜ் கொண்டு வருகிறோம்.", "சார்ஜ் தீர்ந்துச்சா? சார்ஜ் கொண்டு வரலாம்.") },
  other: { label: L("Something else", "Vera edho", "வேறு உதவி", "வேற ஏதோ"), react: L("Okay, I’ll pass it on in your own words.", "Sari, unga words-laye technician-ku solluvom.", "சரி, உங்கள் வார்த்தைகளிலேயே டெக்னீஷியனிடம் சொல்கிறோம்.", "சரி, உங்க வார்த்தையிலயே டெக்னீஷியனுக்கு சொல்லுவோம்.") },
};

export const FAMILY_TALK: Record<VehicleFamily, L3> = {
  bike: L("bike", "bike", "பைக்", "பைக்"), car: L("car", "car", "கார்", "கார்"), commercial: L("vehicle", "vandi", "வாகனம்", "வண்டி"), ev: L("EV", "EV", "மின் வாகனம்", "ஈ.வி."),
};

/** Everything else Thozhan says. [[name]] marks a little picture chip inside the sentence. */
export const LINES = {
  hello: L("Hi, I’m ResQNow-Thozhan.", "Vanakkam, naan ResQNow-Thozhan.", "வணக்கம், நான் ResQNow-தோழன்.", "வணக்கம், நான் ரெஸ்க்யூநவ் தோழன்."),
  helloSub: L("Tell me what happened, in your own words. I’ll ask only what’s missing.", "Enna aachunu unga style-la sollunga. Missing-a irukkuradha mattum kekkuren.", "என்ன ஆச்சு என்று சொல்லுங்கள். இல்லாததை மட்டும் கேட்கிறேன்.", "என்ன ஆச்சுன்னு உங்க ஸ்டைல்ல சொல்லுங்க. மிஸ் ஆனத மட்டும் கேக்குறேன்."),
  understood: L("[[react]] Noted: [[svc]] for your [[veh]].", "[[react]] Note pannitten: unga [[veh]]-ku [[svc]].", "[[react]] குறித்துக்கொண்டேன்: உங்கள் [[veh]]-க்கு [[svc]].", "[[react]] நோட் பண்ணிட்டேன்: உங்க [[veh]]க்கு [[svc]]."),
  understoodNoVeh: L("[[react]] Noted: [[svc]].", "[[react]] Note pannitten: [[svc]].", "[[react]] குறித்துக்கொண்டேன்: [[svc]].", "[[react]] நோட் பண்ணிட்டேன்: [[svc]]."),
  safetyHighway: L("You’re on a highway, so first: pull over to the side and switch on your hazard lights.", "Highway-la irukeenga, mudhalla side-la niruthi hazard light podunga.", "நெடுஞ்சாலையில் இருக்கிறீர்கள், முதலில் ஓரமாக நிறுத்தி ஹசார்ட் விளக்கைப் போடுங்கள்.", "ஹைவேல இருக்கீங்க, முதல்ல சைடுல நிறுத்தி ஹசார்ட் லைட் போடுங்க."),
  evSwitch: L("It’s electric, so I’ll arrange charging instead of fuel.", "Idhu EV, adhanaala fuel-ku badhila charging arrange panren.", "இது மின் வாகனம், எனவே எரிபொருளுக்குப் பதில் சார்ஜிங் ஏற்பாடு செய்கிறேன்.", "இது ஈ.வி., அதனால ஃப்யூலுக்கு பதிலா சார்ஜிங் அரேஞ்ச் பண்றேன்."),
  askService: L("I didn’t quite catch what went wrong. Which of these is it?", "Enna problem nu sariyaa puriyala. Idhula edhu?", "என்ன பிரச்சனை என்று சரியாகப் புரியவில்லை. இவற்றில் எது?", "என்ன பிராப்ளம்னு சரியா புரியல. இதுல எது?"),
  askFamily: L("Which vehicle is it: bike, car, commercial or EV?", "Endha vandi: bike-aa, car-aa, lorry/tempo-vaa, illa EV-aa?", "எந்த வாகனம்: பைக், கார், வணிக வாகனம், அல்லது EV?", "எந்த வண்டி: பைக்கா, காரா, லாரி டெம்போவா, இல்ல ஈ.வி.யா?"),
  askGarage: L("Is it your [[garage]]?", "Unga [[garage]] thaana?", "உங்கள் [[garage]] தானா?", "உங்க [[garage]] தானா?"),
  askBrand: L("Which [[veh]] is it? Tell me the brand and model.", "Enna [[veh]]? Brand, model sollunga.", "எந்த [[veh]]? பிராண்ட், மாடல் சொல்லுங்கள்.", "என்ன [[veh]]? பிராண்ட், மாடல் சொல்லுங்க."),
  askModel: L("Nice, [[brand]]. Which model?", "Super, [[brand]]. Endha model?", "அருமை, [[brand]]. எந்த மாடல்?", "சூப்பர், [[brand]]. எந்த மாடல்?"),
  askName: L("Tell me its name, like the badge on the back.", "Adhoda per sollunga, pinnadi irukkura badge maadhiri.", "அதன் பெயரைச் சொல்லுங்கள், பின்புற பேட்ஜ் போல.", "அதோட பேர் சொல்லுங்க, பின்னாடி இருக்குற பேட்ஜ் மாதிரி."),
  askClass: L("Which is it closest to?", "Idhula edhu maadhiri?", "இவற்றில் எது போல?", "இதுல எது மாதிரி?"),
  askSwitch: L("[[callout]] Shall I switch this to towing?", "[[callout]] Towing-ku maathattumaa?", "[[callout]] டோயிங்கிற்கு மாற்றட்டுமா?", "[[callout]] டோயிங்குக்கு மாத்தட்டுமா?"),
  switched: L("Done, it’s a towing request now. Same vehicle, a few towing questions.", "Sari, ippo idhu towing request. Konjam towing kelvigal mattum.", "சரி, இப்போது இது டோயிங் கோரிக்கை. சில கேள்விகள் மட்டும்.", "சரி, இப்போ இது டோயிங் ரிக்வெஸ்ட். கொஞ்சம் டோயிங் கேள்விகள் மட்டும்."),
  again: L("Sorry, I missed that. Tap one, or say it another way.", "Sorry, adhu puriyala. Onnu thattunga, illa vera maadhiri sollunga.", "மன்னிக்கவும், புரியவில்லை. ஒன்றைத் தட்டுங்கள், அல்லது வேறு விதமாகச் சொல்லுங்கள்.", "சாரி, அது புரியல. ஒண்ணு தட்டுங்க, இல்ல வேற மாதிரி சொல்லுங்க."),
  locating: L("Finding where you are…", "Neenga enga irukeenganu paakuren…", "நீங்கள் எங்கே இருக்கிறீர்கள் என்று பார்க்கிறேன்…", "நீங்க எங்க இருக்கீங்கன்னு பாக்குறேன்…"),
  askLocation: L("Almost done. I can see you near [[place]]. Is that right?", "Kitta vandhutom. Neenga [[place]] pakkathula irukeenga, correct-aa?", "கிட்டத்தட்ட முடிந்தது. நீங்கள் [[place]] அருகில் இருக்கிறீர்கள், சரியா?", "கிட்ட வந்துட்டோம். நீங்க [[place]] பக்கத்துல இருக்கீங்க, கரெக்டா?"),
  noLocation: L("I couldn’t find your location. Let’s pick it on the map.", "Unga location kidaikkala. Map-la choose pannalaam.", "உங்கள் இருப்பிடம் கிடைக்கவில்லை. வரைபடத்தில் தேர்வு செய்யலாம்.", "உங்க லொகேஷன் கிடைக்கல. மேப்ல சூஸ் பண்ணலாம்."),
  askDrop: L("Where should we take it? Say the place, and you’ll confirm it on the map.", "Enga kondu poganum? Edam sollunga, map-la confirm pannalaam.", "எங்கே கொண்டு செல்ல வேண்டும்? இடத்தைச் சொல்லுங்கள், வரைபடத்தில் உறுதிசெய்யலாம்.", "எங்க கொண்டு போகணும்? இடம் சொல்லுங்க, மேப்ல கன்ஃபர்ம் பண்ணலாம்."),
  askLandmark: L("Any landmark near you, like a bus stop or a shop? You can skip this.", "Pakkathula edhaavadhu landmark irukkaa? Bus stop, kadai maadhiri. Illana skip.", "அருகில் ஏதாவது அடையாளம் உள்ளதா? பஸ் நிறுத்தம், கடை போல.", "பக்கத்துல ஏதாவது லேண்ட்மார்க் இருக்கா? பஸ் ஸ்டாப், கடை மாதிரி. இல்லன்னா ஸ்கிப்."),
  ready: L("That’s everything the form needs. Check it once, then slide to send.", "Form-ku thevaiyaanadhu ellam irukku. Oru thadava paathutu slide panni anuppunga.", "படிவத்துக்குத் தேவையான அனைத்தும் உள்ளது. ஒருமுறை பார்த்துவிட்டு ஸ்லைடு செய்து அனுப்புங்கள்.", "ஃபார்முக்கு தேவையானது எல்லாம் இருக்கு. ஒரு தடவ பாத்துட்டு ஸ்லைட் பண்ணி அனுப்புங்க."),
  readyMap: L("That’s everything I need. Confirm the places on the map, then send.", "Enakku thevaiyaanadhu ellam irukku. Map-la edatha confirm panni anuppunga.", "எனக்குத் தேவையானது எல்லாம் உள்ளது. வரைபடத்தில் இடங்களை உறுதிசெய்து அனுப்புங்கள்.", "எனக்கு தேவையானது எல்லாம் இருக்கு. மேப்ல இடத்த கன்ஃபர்ம் பண்ணி அனுப்புங்க."),
};

export const ACK: Record<Lang, string[]> = { en: ["Got it.", "Perfect.", "Okay."], tg: ["Sari.", "Super.", "Okay."], ta: ["சரி.", "அருமை.", "சரி."] };
/** The Tanglish acknowledgements in Tamil script, for speaking. */
export const ACK_SAY = ["சரி.", "சூப்பர்.", "ஓகே."];
export const NOD = { svc: L("oh no", "aiyo", "அய்யோ"), veh: L("mm-hmm", "mm", "ம்ம்"), urgent: L("I’m here", "naan irukken", "நான் இருக்கேன்") };

export const UI = {
  yes: L("Yes", "Aamaa", "ஆமாம்"),
  differentOne: L("A different one", "Vera vandi", "வேறு வாகனம்"),
  notListed: L("Not listed", "List-la illa", "பட்டியலில் இல்லை"),
  otherModel: L("Other model", "Vera model", "வேறு மாடல்"),
  skip: L("Skip", "Skip", "தவிர்"),
  done: L("That’s all", "Avlo dhaan", "அவ்வளவுதான்"),
  noLandmark: L("No landmark", "Landmark illa", "அடையாளம் இல்லை"),
  yesHere: L("Yes, that’s me", "Aamaa, inga dhaan", "ஆமாம், இங்கேதான்"),
  onMap: L("Pick on the map", "Map-la choose panren", "வரைபடத்தில் தேர்வு"),
  switchYes: L("Switch to towing", "Towing-ku maathunga", "டோயிங்கிற்கு மாற்று"),
  switchNo: L("Change my answer", "Answer maathanum", "பதிலை மாற்று"),
  typeHere: L("Type to ResQNow-Thozhan", "Thozhan-kku type pannunga", "தோழனிடம் எழுதுங்கள்"),
};
