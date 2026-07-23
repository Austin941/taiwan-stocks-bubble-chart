/**
 * 台灣核心上市上櫃企業集團對照資料庫
 * 涵蓋台塑、中美晶、鴻海、聯電、華新麗華、明基佳世達、華碩、金仁寶、廣達、宏碁、富邦、國泰、中信、遠東等 40+ 大核心集團
 */

export const CONGLOMERATES = {
  "台塑集團": {
    name: "台塑集團",
    description: "台灣石化與半導體材料龍頭集團",
    leader: "1301",
    stocks: [
      { code: "1301", name: "台塑", role: "集團核心/石化" },
      { code: "1303", name: "南亞", role: "石化/電子材料" },
      { code: "1326", name: "台化", role: "石化/纖維" },
      { code: "6505", name: "台塑化", role: "煉油/烯烴" },
      { code: "2408", name: "南亞科", role: "DRAM記憶體" },
      { code: "1434", name: "福懋", role: "紡織/長纖" },
      { code: "8131", name: "福懋科", role: "IC封測" },
      { code: "3532", name: "台勝高", role: "矽晶圓(合資)" },
      { code: "6582", name: "申豐", role: "乳膠/化學" },
      { code: "6753", name: "龍德造船", role: "造船(投資)" }
    ]
  },
  "中美晶集團": {
    name: "中美晶集團",
    description: "全球半導體矽晶圓與化合物半導體集團",
    leader: "5483",
    stocks: [
      { code: "5483", name: "中美晶", role: "母公司/綠能/太陽能" },
      { code: "6488", name: "環球晶", role: "全球矽晶圓龍頭" },
      { code: "8086", name: "宏捷科", role: "PA砷化鎵代工" },
      { code: "5475", name: "兆遠", role: "藍寶石基板" },
      { code: "4772", name: "台特化", role: "半導體特殊氣體" },
      { code: "6806", name: "森崴能源", role: "綠能(投資關聯)" },
      { code: "3016", name: "嘉晶", role: "化合物半導體(投資)" }
    ]
  },
  "鴻海集團": {
    name: "鴻海集團",
    description: "全球電子代工巨擘與電動車/AI伺服器生態圈",
    leader: "2317",
    stocks: [
      { code: "2317", name: "鴻海", role: "集團母公司/EMS龍頭" },
      { code: "2354", name: "鴻準", role: "金屬機殼/機熱" },
      { code: "2328", name: "廣宇", role: "連接線器/車用" },
      { code: "3413", name: "京鼎", role: "半導體設備" },
      { code: "6451", name: "訊芯-KY", role: "CPO矽光子/SiP封測" },
      { code: "5243", name: "乙盛-KY", role: "車用衝壓/機構件" },
      { code: "4958", name: "臻鼎-KY", role: "PCB軟板龍頭" },
      { code: "6414", name: "樺漢", role: "工業電腦/IPC" },
      { code: "3149", name: "正達", role: "光電玻璃" },
      { code: "8011", name: "台揚", role: "網通/衛星" },
      { code: "3665", name: "貿聯-KY", role: "連接線材(策略合作)" },
      { code: "6805", name: "富世達", role: "樞紐(投資關聯)" },
      { code: "6669", name: "緯穎", role: "AI伺服器(關鍵夥伴)" }
    ]
  },
  "聯電集團": {
    name: "聯電集團",
    description: "晶圓代工與多角化IC設計/封測生態系",
    leader: "2303",
    stocks: [
      { code: "2303", name: "聯電", role: "晶圓代工" },
      { code: "3035", name: "智原", role: "ASIC/IP設計服務" },
      { code: "3037", name: "欣興", role: "ABF載板龍頭" },
      { code: "3034", name: "聯詠", role: "驅動IC/SoC" },
      { code: "3014", name: "聯陽", role: "I/O控制IC" },
      { code: "6202", name: "盛群", role: "MCU微控制器" },
      { code: "3227", name: "原相", role: "CMOS感測IC" },
      { code: "6182", name: "合晶", role: "矽晶圓" },
      { code: "3545", name: "敦泰", role: "觸控驅動IC" },
      { code: "8150", name: "南茂", role: "驅動IC封測" },
      { code: "6269", name: "台郡", role: "軟板(投資合作)" },
      { code: "6799", name: "來頡", role: "電源管理IC" }
    ]
  },
  "華新麗華集團": {
    name: "華新麗華集團",
    description: "電線電纜、不銹鋼、被動元件與半導體集團",
    leader: "1605",
    stocks: [
      { code: "1605", name: "華新", role: "集團核心/電纜/不銹鋼" },
      { code: "2344", name: "華邦電", role: "Memory記憶體" },
      { code: "4919", name: "新唐", role: "MCU/車用晶片" },
      { code: "6116", name: "彩晶", role: "面板" },
      { code: "2492", name: "華新科", role: "MLCC被動元件" },
      { code: "6284", name: "佳邦", role: "天線/被動元件" },
      { code: "5469", name: "瀚宇博", role: "硬板PCB" },
      { code: "8155", name: "博智", role: "伺服器PCB" },
      { code: "2405", name: "浩鑫", role: "迷你電腦/醫療" },
      { code: "3653", name: "健策", role: "均熱片(投資關聯)" }
    ]
  },
  "明基佳世達集團": {
    name: "明基佳世達集團",
    description: "資訊產品、醫療健康、網通與顯示器集團",
    leader: "2352",
    stocks: [
      { code: "2352", name: "佳世達", role: "集團核心/代工/醫療" },
      { code: "8215", name: "明基材", role: "偏光片/醫療生技" },
      { code: "2409", name: "友達", role: "Display面板" },
      { code: "4977", name: "眾達-KY", role: "CPO/光收發模組" },
      { code: "4915", name: "致伸", role: "電聲/聲學機構" },
      { code: "3583", name: "辛耘", role: "半導體設備(投資)" },
      { code: "6152", name: "百一", role: "網通" },
      { code: "3374", name: "精材", role: "封測(投資關聯)" }
    ]
  },
  "華碩集團": {
    name: "華碩集團",
    description: "全球品牌電腦、主機板、工業電腦與AI伺服器",
    leader: "2357",
    stocks: [
      { code: "2357", name: "華碩", role: "品牌筆電/主機板/AI" },
      { code: "4938", name: "和碩", role: "代工/車用/iPhone" },
      { code: "2393", name: "億光", role: "LED/光電" },
      { code: "6414", name: "樺漢", role: "工業電腦(聯手)" },
      { code: "3515", name: "華擎", role: "伺服器/主機板" },
      { code: "6561", name: "是方", role: "機房數據中心" },
      { code: "6805", name: "富世達", role: "樞紐軸承" },
      { code: "6756", name: "威鋒電子", role: "USB控制IC" }
    ]
  },
  "金仁寶集團": {
    name: "金仁寶集團",
    description: "筆電代工、網通、電源供應器與電源管理",
    leader: "2324",
    stocks: [
      { code: "2324", name: "仁寶", role: "筆電/AI伺服器代工" },
      { code: "2312", name: "金寶", role: "網通/消費電子代工" },
      { code: "2371", name: "大同", role: "重電/資產(股權入主)" },
      { code: "2383", name: "台光電", role: "CCL銅箔基板" },
      { code: "8078", name: "華寶", role: "通訊" },
      { code: "6285", name: "進泰電子", role: "音響" }
    ]
  },
  "廣達集團": {
    name: "廣達集團",
    description: "全球AI伺服器龍頭與雲端運態代工",
    leader: "2382",
    stocks: [
      { code: "2382", name: "廣達", role: "AI伺服器/筆電代工龍頭" },
      { code: "2388", name: "威盛", role: "處理器/IC設計" },
      { code: "3030", name: "德律", role: "自動光學檢測AOI" },
      { code: "5388", name: "中磊", role: "網通設備" }
    ]
  },
  "宏碁集團": {
    name: "宏碁集團",
    description: "電腦品牌與「小金虎」多角化上市櫃艦隊",
    leader: "2353",
    stocks: [
      { code: "2353", name: "宏碁", role: "品牌筆電/母公司" },
      { code: "6776", name: "展碁國際", role: "通路代理" },
      { code: "6690", name: "安碁資訊", role: "資安服務" },
      { code: "6854", name: "智聯服務", role: "系統整合" },
      { code: "6862", name: "宏碁資訊", role: "雲端服務" },
      { code: "6942", name: "宏碁智醫", role: "醫療AI" },
      { code: "6874", name: "倍力", role: "軟體(投資)" }
    ]
  },
  "台積電生態圈/創投": {
    name: "台積電生態圈/創投",
    description: "全球晶圓代工霸主及其核心供應鏈與轉投資",
    leader: "2330",
    stocks: [
      { code: "2330", name: "台積電", role: "晶圓代工龍頭" },
      { code: "5347", name: "世界", role: "成熟製程代工" },
      { code: "3374", name: "精材", role: "先進封裝/3D" },
      { code: "3443", name: "創意", role: "ASIC設計服務" },
      { code: "3131", name: "弘塑", role: "CoWoS濕製程設備" },
      { code: "3583", name: "辛耘", role: "CoWoS濕製程設備" },
      { code: "6187", name: "萬潤", role: "CoWoS點膠/自動化" },
      { code: "6683", name: "雍智科技", role: "IC測試載板" }
    ]
  },
  "富邦集團": {
    name: "富邦集團",
    description: "台灣金控龍頭、電信、電商與媒體集團",
    leader: "2881",
    stocks: [
      { code: "2881", name: "富邦金", role: "金控核心" },
      { code: "3045", name: "台灣大", role: "電信" },
      { code: "8454", name: "富邦媒", role: "momo電商" },
      { code: "2816", name: "旺旺保", role: "產險(投資關聯)" }
    ]
  },
  "國泰集團": {
    name: "國泰集團",
    description: "台灣壽險與金融巨擘、建設與物流",
    leader: "2882",
    stocks: [
      { code: "2882", name: "國泰金", role: "金控核心" },
      { code: "2501", name: "國建", role: "營建" },
      { code: "9941", name: "裕融", role: "租賃(合作)" }
    ]
  },
  "凱基金集團": {
    name: "凱基金集團",
    description: "創投、凱基證券、壽險與全方位金融金控集團",
    leader: "2883",
    stocks: [
      { code: "2883", name: "凱基金", role: "金控母公司/證券壽險" },
      { code: "6005", name: "群益證", role: "證券(戰略合作)" },
      { code: "2915", name: "潤泰全", role: "壽險/投資(關聯)" }
    ]
  },
  "中信集團": {
    name: "中信集團",
    description: "消金與信用卡龍頭、彩券、飯店與人壽",
    leader: "2891",
    stocks: [
      { code: "2891", name: "中信金", role: "金控核心" },
      { code: "2514", name: "龍邦", role: "營建/殯葬" },
      { code: "2610", name: "華航", role: "航空(投資)" }
    ]
  },
  "遠東集團": {
    name: "遠東集團",
    description: "石化、化纖、水泥、百貨、電信與金融",
    leader: "1402",
    stocks: [
      { code: "1402", name: "遠東新", role: "集團母公司/化纖" },
      { code: "1102", name: "亞泥", role: "水泥" },
      { code: "2903", name: "遠東百", role: "百貨" },
      { code: "4904", name: "遠傳", role: "電信" },
      { code: "2845", name: "遠東銀", role: "銀行" },
      { code: "1710", name: "東聯", role: "特化" },
      { code: "1445", name: "大華", role: "金屬罐" },
      { code: "2606", name: "裕民", role: "散裝航運" }
    ]
  },
  "潤泰集團": {
    name: "潤泰集團",
    description: "營建、量販、壽險、生技與紡織",
    leader: "9945",
    stocks: [
      { code: "9945", name: "潤泰新", role: "營建/商場" },
      { code: "2915", name: "潤泰全", role: "紡織/投資" },
      { code: "2883", name: "凱基金", role: "金控人壽" },
      { code: "4174", name: "浩鼎", role: "生技新藥" },
      { code: "4147", name: "中裕", role: "愛滋病新藥" }
    ]
  },
  "威盛集團": {
    name: "威盛集團",
    description: "IC設計、宏達電元宇宙與感測晶片",
    leader: "2388",
    stocks: [
      { code: "2388", name: "威盛", role: "IC設計/AI感測" },
      { code: "2498", name: "宏達電", role: "VR/元宇宙" },
      { code: "2387", name: "精元", role: "鍵盤/機構件" },
      { code: "6142", name: "友勁", role: "網通" },
      { code: "6756", name: "威鋒電子", role: "USB傳輸晶片" }
    ]
  },
  "長榮集團": {
    name: "長榮集團",
    description: "全球貨櫃海運與航空交通運輸巨擘",
    leader: "2603",
    stocks: [
      { code: "2603", name: "長榮", role: "貨櫃海運龍頭" },
      { code: "2618", name: "長榮航", role: "航空運輸" },
      { code: "2607", name: "榮運", role: "陸運/倉儲" },
      { code: "2612", name: "中航", role: "散裝航運" },
      { code: "2634", name: "漢翔", role: "軍工航太(合作)" }
    ]
  },
  "裕隆集團": {
    name: "裕隆集團",
    description: "台灣汽車製造、自有品牌納智捷與金融租賃",
    leader: "2201",
    stocks: [
      { code: "2201", name: "裕隆", role: "汽車組裝/鴻華" },
      { code: "2204", name: "中華", role: "商用車/商旅" },
      { code: "9941", name: "裕融", role: "車貸/租賃" },
      { code: "2231", name: "為升", role: "TPMS胎壓感測" }
    ]
  },
  "和泰集團": {
    name: "和泰集團",
    description: "台灣汽車銷售龍頭、Toyota代理與車用零件",
    leader: "2207",
    stocks: [
      { code: "2207", name: "和泰車", role: "車商龍頭" },
      { code: "2227", name: "裕日車", role: "日產代理" },
      { code: "2233", name: "宇隆", role: "精密金屬加工" }
    ]
  }
};

export function getConglomeratesByStockCode(code) {
  const matched = [];
  for (const [groupName, groupObj] of Object.entries(CONGLOMERATES)) {
    if (groupObj.stocks.some(s => String(s.code) === String(code))) {
      matched.push(groupName);
    }
  }
  return matched.length > 0 ? matched[0] : "獨立/未歸類";
}

export function getAllConglomerates() {
  return CONGLOMERATES;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONGLOMERATES,
    getConglomeratesByStockCode,
    getAllConglomerates
  };
}
