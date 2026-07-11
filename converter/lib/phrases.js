/* ============================================================
   phrases — offline travel phrasebook. Each phrase carries a
   [script, pronunciation] pair per language. tts = BCP-47 code
   for optional speech synthesis when a matching voice exists.
   ============================================================ */

export const LANGUAGES = {
  es: { name: 'Spanish',    flag: '🇪🇸', tts: 'es-ES' },
  fr: { name: 'French',     flag: '🇫🇷', tts: 'fr-FR' },
  de: { name: 'German',     flag: '🇩🇪', tts: 'de-DE' },
  it: { name: 'Italian',    flag: '🇮🇹', tts: 'it-IT' },
  pt: { name: 'Portuguese', flag: '🇵🇹', tts: 'pt-PT' },
  ja: { name: 'Japanese',   flag: '🇯🇵', tts: 'ja-JP' },
  zh: { name: 'Mandarin',   flag: '🇨🇳', tts: 'zh-CN' },
  th: { name: 'Thai',       flag: '🇹🇭', tts: 'th-TH' },
};

export const CATEGORIES = ['Basics', 'Dining', 'Getting around', 'Emergencies', 'Shopping'];

// t: { lang: [native script, pronunciation] }
export const PHRASES = [
  { cat: 'Basics', en: 'Hello', t: {
    es: ['Hola', 'OH-lah'], fr: ['Bonjour', 'bon-ZHOOR'], de: ['Hallo', 'HAH-lo'],
    it: ['Ciao', 'chow'], pt: ['Olá', 'oh-LAH'], ja: ['こんにちは', 'kon-nichi-wa'],
    zh: ['你好', 'nǐ hǎo'], th: ['สวัสดี', 'sa-wàt-dee'] } },
  { cat: 'Basics', en: 'Thank you', t: {
    es: ['Gracias', 'GRAH-syas'], fr: ['Merci', 'mer-SEE'], de: ['Danke', 'DAHN-kuh'],
    it: ['Grazie', 'GRAH-tsyeh'], pt: ['Obrigado', 'oh-bree-GAH-doo'], ja: ['ありがとう', 'a-ri-ga-tō'],
    zh: ['谢谢', 'xiè-xie'], th: ['ขอบคุณ', 'khòp-khun'] } },
  { cat: 'Basics', en: 'Please', t: {
    es: ['Por favor', 'por fah-VOR'], fr: ['S’il vous plaît', 'seel voo PLEH'], de: ['Bitte', 'BIT-tuh'],
    it: ['Per favore', 'per fah-VOH-reh'], pt: ['Por favor', 'poor fah-VOR'], ja: ['お願いします', 'o-ne-gai shi-mas'],
    zh: ['请', 'qǐng'], th: ['กรุณา', 'ga-ru-naa'] } },
  { cat: 'Basics', en: 'Yes', t: {
    es: ['Sí', 'see'], fr: ['Oui', 'wee'], de: ['Ja', 'yah'], it: ['Sì', 'see'],
    pt: ['Sim', 'seeng'], ja: ['はい', 'hai'], zh: ['是', 'shì'], th: ['ใช่', 'châi'] } },
  { cat: 'Basics', en: 'No', t: {
    es: ['No', 'noh'], fr: ['Non', 'nohn'], de: ['Nein', 'nine'], it: ['No', 'noh'],
    pt: ['Não', 'nowng'], ja: ['いいえ', 'ii-e'], zh: ['不', 'bù'], th: ['ไม่', 'mâi'] } },
  { cat: 'Basics', en: 'Excuse me / Sorry', t: {
    es: ['Perdón', 'per-DOHN'], fr: ['Excusez-moi', 'ex-koo-zay-MWAH'], de: ['Entschuldigung', 'ent-SHOOL-di-goong'],
    it: ['Mi scusi', 'mee SKOO-zee'], pt: ['Com licença', 'kong lee-SEN-sa'], ja: ['すみません', 'su-mi-ma-sen'],
    zh: ['对不起', 'duì-bu-qǐ'], th: ['ขอโทษ', 'khǎw-thôot'] } },
  { cat: 'Basics', en: 'Do you speak English?', t: {
    es: ['¿Habla inglés?', 'AH-bla een-GLES'], fr: ['Parlez-vous anglais?', 'par-lay voo ahn-GLEH'],
    de: ['Sprechen Sie Englisch?', 'SHPREH-khen zee ENG-lish'], it: ['Parla inglese?', 'PAR-la een-GLEH-zeh'],
    pt: ['Fala inglês?', 'FAH-la een-GLESH'], ja: ['英語を話せますか', 'eigo o hana-se-mas ka'],
    zh: ['你会说英语吗', 'nǐ huì shuō yīng-yǔ ma'], th: ['พูดอังกฤษได้ไหม', 'phûut ang-grìt dâai mǎi'] } },
  { cat: 'Basics', en: "I don't understand", t: {
    es: ['No entiendo', 'no en-TYEN-do'], fr: ['Je ne comprends pas', 'zhuh nuh kom-PRAHN pah'],
    de: ['Ich verstehe nicht', 'ikh fer-SHTAY-uh nikht'], it: ['Non capisco', 'non ka-PEES-ko'],
    pt: ['Não entendo', 'nowng en-TEN-doo'], ja: ['わかりません', 'wa-ka-ri-ma-sen'],
    zh: ['我不懂', 'wǒ bù dǒng'], th: ['ไม่เข้าใจ', 'mâi kâo-jai'] } },
  { cat: 'Basics', en: 'How much is it?', t: {
    es: ['¿Cuánto cuesta?', 'KWAN-to KWES-ta'], fr: ['C’est combien?', 'say kom-BYAN'],
    de: ['Wie viel kostet das?', 'vee feel KOS-tet das'], it: ['Quanto costa?', 'KWAN-to KOS-ta'],
    pt: ['Quanto custa?', 'KWAN-too KOOS-ta'], ja: ['いくらですか', 'i-ku-ra des ka'],
    zh: ['多少钱', 'duō-shǎo qián'], th: ['เท่าไหร่', 'thâo-rài'] } },

  { cat: 'Dining', en: 'A table for two, please', t: {
    es: ['Una mesa para dos', 'OO-na MEH-sa PA-ra dohs'], fr: ['Une table pour deux', 'oon TAH-bluh poor duh'],
    de: ['Einen Tisch für zwei', 'EYE-nen tish foor tsvai'], it: ['Un tavolo per due', 'oon TA-vo-lo per DOO-eh'],
    pt: ['Uma mesa para dois', 'OO-ma MEH-za pa-ra doysh'], ja: ['二人です', 'fu-ta-ri des'],
    zh: ['两位', 'liǎng wèi'], th: ['โต๊ะสำหรับสองคน', 'tó sǎm-ràp sǎwng khon'] } },
  { cat: 'Dining', en: 'The menu, please', t: {
    es: ['La carta, por favor', 'la KAR-ta'], fr: ['Le menu, s’il vous plaît', 'luh muh-NOO'],
    de: ['Die Speisekarte, bitte', 'dee SHPY-zeh-kar-teh'], it: ['Il menu, per favore', 'eel meh-NOO'],
    pt: ['O menu, por favor', 'oo meh-NOO'], ja: ['メニューをください', 'menyū o ku-da-sai'],
    zh: ['菜单', 'cài-dān'], th: ['ขอเมนู', 'khǎw menu'] } },
  { cat: 'Dining', en: "I'm vegetarian", t: {
    es: ['Soy vegetariano/a', 'soy veh-heh-ta-RYA-no'], fr: ['Je suis végétarien(ne)', 'zhuh swee vay-zhay-ta-RYAN'],
    de: ['Ich bin Vegetarier(in)', 'ikh bin veh-geh-TA-ri-er'], it: ['Sono vegetariano/a', 'SO-no veh-jeh-ta-RYA-no'],
    pt: ['Sou vegetariano/a', 'soh veh-zheh-ta-RYA-no'], ja: ['ベジタリアンです', 'be-ji-ta-ri-an des'],
    zh: ['我吃素', 'wǒ chī sù'], th: ['กินเจ', 'gin je'] } },
  { cat: 'Dining', en: 'The bill, please', t: {
    es: ['La cuenta, por favor', 'la KWEN-ta'], fr: ['L’addition, s’il vous plaît', 'la-dee-SYON'],
    de: ['Die Rechnung, bitte', 'dee REKH-noong'], it: ['Il conto, per favore', 'eel KON-to'],
    pt: ['A conta, por favor', 'a KON-ta'], ja: ['お会計お願いします', 'o-kai-kei o-ne-gai shi-mas'],
    zh: ['买单', 'mǎi-dān'], th: ['เก็บเงินด้วย', 'gèp ngern dûai'] } },
  { cat: 'Dining', en: 'Water', t: {
    es: ['Agua', 'AH-gwa'], fr: ['De l’eau', 'duh loh'], de: ['Wasser', 'VAS-ser'],
    it: ['Acqua', 'AH-kwa'], pt: ['Água', 'AH-gwa'], ja: ['水', 'mi-zu'],
    zh: ['水', 'shuǐ'], th: ['น้ำ', 'nám'] } },

  { cat: 'Getting around', en: 'Where is the bathroom?', t: {
    es: ['¿Dónde está el baño?', 'DON-deh es-TA el BA-nyo'], fr: ['Où sont les toilettes?', 'oo sohn lay twah-LET'],
    de: ['Wo ist die Toilette?', 'vo ist dee twa-LET-teh'], it: ['Dov’è il bagno?', 'do-VEH eel BA-nyo'],
    pt: ['Onde é a casa de banho?', 'ON-deh eh a KA-za deh BA-nyo'], ja: ['トイレはどこですか', 'toi-re wa do-ko des ka'],
    zh: ['洗手间在哪里', 'xǐ-shǒu-jiān zài nǎ-lǐ'], th: ['ห้องน้ำอยู่ที่ไหน', 'hông-nám yùu thîi-nǎi'] } },
  { cat: 'Getting around', en: 'Where is…?', t: {
    es: ['¿Dónde está…?', 'DON-deh es-TA'], fr: ['Où est…?', 'oo eh'], de: ['Wo ist…?', 'vo ist'],
    it: ['Dov’è…?', 'do-VEH'], pt: ['Onde fica…?', 'ON-deh FEE-ka'], ja: ['…はどこですか', '…wa do-ko des ka'],
    zh: ['…在哪里', '…zài nǎ-lǐ'], th: ['…อยู่ที่ไหน', '…yùu thîi-nǎi'] } },
  { cat: 'Getting around', en: 'Left', t: {
    es: ['Izquierda', 'ees-KYER-da'], fr: ['Gauche', 'gohsh'], de: ['Links', 'links'], it: ['Sinistra', 'see-NEES-tra'],
    pt: ['Esquerda', 'esh-KER-da'], ja: ['左', 'hi-da-ri'], zh: ['左', 'zuǒ'], th: ['ซ้าย', 'sáai'] } },
  { cat: 'Getting around', en: 'Right', t: {
    es: ['Derecha', 'deh-REH-cha'], fr: ['Droite', 'drwaht'], de: ['Rechts', 'rekhts'], it: ['Destra', 'DES-tra'],
    pt: ['Direita', 'dee-RAY-ta'], ja: ['右', 'mi-gi'], zh: ['右', 'yòu'], th: ['ขวา', 'khwǎa'] } },
  { cat: 'Getting around', en: 'Stop here, please', t: {
    es: ['Pare aquí, por favor', 'PA-reh a-KEE'], fr: ['Arrêtez-vous ici', 'a-reh-tay voo ee-SEE'],
    de: ['Halten Sie hier, bitte', 'HAL-ten zee heer'], it: ['Si fermi qui', 'see FER-mee kwee'],
    pt: ['Pare aqui, por favor', 'PA-reh a-KEE'], ja: ['ここで止めてください', 'ko-ko de to-me-te ku-da-sai'],
    zh: ['在这里停', 'zài zhè-lǐ tíng'], th: ['จอดที่นี่', 'jòt thîi-nîi'] } },

  { cat: 'Emergencies', en: 'Help!', t: {
    es: ['¡Ayuda!', 'a-YOO-da'], fr: ['Au secours!', 'oh suh-KOOR'], de: ['Hilfe!', 'HIL-fuh'],
    it: ['Aiuto!', 'a-YOO-to'], pt: ['Socorro!', 'soh-KOH-hoo'], ja: ['助けて', 'ta-su-ke-te'],
    zh: ['救命', 'jiù-mìng'], th: ['ช่วยด้วย', 'chûai-dûai'] } },
  { cat: 'Emergencies', en: 'Call the police', t: {
    es: ['Llame a la policía', 'YA-meh a la po-lee-SEE-a'], fr: ['Appelez la police', 'a-play la po-LEES'],
    de: ['Rufen Sie die Polizei', 'ROO-fen zee dee po-li-TSAI'], it: ['Chiami la polizia', 'KYA-mee la po-li-TSEE-a'],
    pt: ['Chame a polícia', 'SHA-me a po-LEE-sya'], ja: ['警察を呼んでください', 'kei-satsu o yon-de ku-da-sai'],
    zh: ['叫警察', 'jiào jǐng-chá'], th: ['เรียกตำรวจ', 'rîak tam-rùat'] } },
  { cat: 'Emergencies', en: 'Call an ambulance', t: {
    es: ['Llame a una ambulancia', 'YA-meh a OO-na am-boo-LAN-sya'], fr: ['Appelez une ambulance', 'a-play oon am-boo-LAHNS'],
    de: ['Rufen Sie einen Krankenwagen', 'ROO-fen zee EYE-nen KRAN-ken-va-gen'], it: ['Chiami un’ambulanza', 'KYA-mee oon am-boo-LAN-tsa'],
    pt: ['Chame uma ambulância', 'SHA-me OO-ma am-boo-LAN-sya'], ja: ['救急車を呼んでください', 'kyū-kyū-sha o yon-de ku-da-sai'],
    zh: ['叫救护车', 'jiào jiù-hù-chē'], th: ['เรียกรถพยาบาล', 'rîak rót-pá-yaa-baan'] } },
  { cat: 'Emergencies', en: "I'm allergic to…", t: {
    es: ['Soy alérgico/a a…', 'soy a-LER-hee-ko a'], fr: ['Je suis allergique à…', 'zhuh swee a-ler-ZHEEK a'],
    de: ['Ich bin allergisch gegen…', 'ikh bin a-LER-gish GAY-gen'], it: ['Sono allergico/a a…', 'SO-no a-LER-jee-ko a'],
    pt: ['Sou alérgico/a a…', 'soh a-LER-zhee-ko a'], ja: ['…アレルギーです', '…a-re-ru-gī des'],
    zh: ['我对…过敏', 'wǒ duì … guò-mǐn'], th: ['ฉันแพ้…', 'chǎn pháe …'] } },

  { cat: 'Shopping', en: 'Too expensive', t: {
    es: ['Muy caro', 'mwee KA-ro'], fr: ['Trop cher', 'troh shair'], de: ['Zu teuer', 'tsoo TOY-er'],
    it: ['Troppo caro', 'TROP-po KA-ro'], pt: ['Muito caro', 'MWEE-too KA-ro'], ja: ['高すぎます', 'ta-ka-su-gi-mas'],
    zh: ['太贵了', 'tài guì le'], th: ['แพงไป', 'phaeng pai'] } },
  { cat: 'Shopping', en: 'Can I pay by card?', t: {
    es: ['¿Puedo pagar con tarjeta?', 'PWE-do pa-GAR kon tar-HEH-ta'], fr: ['Je peux payer par carte?', 'zhuh puh pay-YAY par kart'],
    de: ['Kann ich mit Karte zahlen?', 'kan ikh mit KAR-teh TSA-len'], it: ['Posso pagare con la carta?', 'POS-so pa-GA-reh kon la KAR-ta'],
    pt: ['Posso pagar com cartão?', 'POS-so pa-GAR kong kar-TOWNG'], ja: ['カードで払えますか', 'kā-do de ha-ra-e-mas ka'],
    zh: ['可以刷卡吗', 'kě-yǐ shuā-kǎ ma'], th: ['จ่ายบัตรได้ไหม', 'jàai bàt dâai mǎi'] } },
];
