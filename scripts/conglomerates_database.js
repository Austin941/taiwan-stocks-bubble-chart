/**
 * 台灣權威上市上櫃企業集團完整分類對照資料庫
 * 完全對照台灣重要集團股分類表 (涵蓋台塑、台積電、聯電、宏碁、光寶、日月光、金仁寶、台南幫、統一、裕隆、鴻海、亞東/遠東、長榮、中信、和信、力晶、東元、永豐餘、大眾、國巨、正隆、威盛、新光、神達、華新、聯華神通、大同、中鋼、矽品、錸德、茂迪、富邦、潤泰、力麗、耐斯、三商行、威京、友訊、明基佳世達、遠雄、士紙、霖園國泰、中纖、聯發科、能率、仰德、龍邦、東陽、偉聯、萬華、大億、力山、美吾華、泰山、義聯、國產、茂矽、台達電、台聚等 65+ 大集團)
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
      { code: "1434", name: "福懋", role: "紡織/長纖" },
      { code: "2408", name: "南科/南亞科", role: "DRAM記憶體" },
      { code: "6505", name: "台塑化", role: "煉油/烯烴" },
      { code: "8046", name: "南電", role: "ABF載板" },
      { code: "3474", name: "華亞科", role: "DRAM" },
      { code: "3532", name: "台勝科", role: "矽晶圓" },
      { code: "8131", name: "福懋科", role: "IC封測" }
    ]
  },
  "台積電集團": {
    name: "台積電集團",
    description: "全球晶圓代工霸主及其核心生態系與轉投資",
    leader: "2330",
    stocks: [
      { code: "2330", name: "台積電", role: "晶圓代工龍頭" },
      { code: "5347", name: "世界", role: "成熟製程代工" },
      { code: "3443", name: "創意", role: "ASIC設計服務" },
      { code: "3374", name: "精材", role: "先進封裝/3D" },
      { code: "3131", name: "弘塑", role: "CoWoS設備" },
      { code: "3583", name: "辛耘", role: "CoWoS設備" },
      { code: "6187", name: "萬潤", role: "點膠設備" }
    ]
  },
  "聯電集團": {
    name: "聯電集團",
    description: "晶圓代工與多角化IC設計/封測生態系",
    leader: "2303",
    stocks: [
      { code: "2303", name: "聯電", role: "晶圓代工" },
      { code: "2363", name: "矽統", role: "IC設計/觸控" },
      { code: "3014", name: "聯陽", role: "I/O控制IC" },
      { code: "3034", name: "聯詠", role: "驅動IC/SoC" },
      { code: "3035", name: "智原", role: "ASIC/IP設計服務" },
      { code: "3037", name: "欣興", role: "ABF載板龍頭" },
      { code: "3227", name: "原相", role: "CMOS感測IC" },
      { code: "5467", name: "聯福生", role: "生技/轉投資" },
      { code: "6147", name: "頎邦", role: "驅動IC封測" },
      { code: "6202", name: "盛群", role: "MCU微控制器" },
      { code: "6182", name: "合晶", role: "矽晶圓" }
    ]
  },
  "宏碁集團": {
    name: "宏碁集團",
    description: "電腦品牌、緯創、啟碁與「小金虎」艦隊",
    leader: "2353",
    stocks: [
      { code: "2353", name: "宏碁", role: "品牌筆電/母公司" },
      { code: "3041", name: "揚智", role: "STB/晶片" },
      { code: "3046", name: "建碁", role: "工業電腦/充電樁" },
      { code: "3231", name: "緯創", role: "AI伺服器代工巨擘" },
      { code: "6281", name: "全國電", role: "3C通路" },
      { code: "6285", name: "啟碁", role: "網通/衛星/車用" },
      { code: "6690", name: "安碁資訊", role: "資安服務" },
      { code: "6862", name: "宏碁資訊", role: "雲端服務" }
    ]
  },
  "光寶集團": {
    name: "光寶集團",
    description: "光電元件、電源供應器與半導體",
    leader: "2301",
    stocks: [
      { code: "2301", name: "光寶科", role: "電源供應器/光電" },
      { code: "5305", name: "敦南", role: "二極體/半導體" },
      { code: "8008", name: "建興電", role: "光碟機/SSD" }
    ]
  },
  "日月光集團": {
    name: "日月光集團",
    description: "全球半導體封測龍頭、環電與不動產",
    leader: "2311",
    stocks: [
      { code: "2311", name: "日月光/日月光投控", role: "全球封測龍頭" },
      { code: "2350", name: "環電/環旭", role: "EMS/SiP模組" },
      { code: "2527", name: "宏璟", role: "營建/建案" },
      { code: "3264", name: "欣銓", role: "測試" },
      { code: "2449", name: "京元電子", role: "測試" }
    ]
  },
  "金仁寶集團": {
    name: "金仁寶集團",
    description: "筆電代工、網通、電源、康舒與智易",
    leader: "2324",
    stocks: [
      { code: "1312", name: "金寶", role: "消費電子/網通" },
      { code: "2324", name: "仁寶", role: "筆電/AI伺服器代工" },
      { code: "3063", name: "飛信", role: "驅動IC封測" },
      { code: "5340", name: "建榮", role: "玻纖布" },
      { code: "6282", name: "康舒", role: "電源供應器/車用" },
      { code: "8078", name: "華寶", role: "手機/通訊" },
      { code: "9105", name: "泰金寶", role: "TDR/泰國代工" },
      { code: "3157", name: "威寶", role: "電信" },
      { code: "3195", name: "統寶", role: "面板" },
      { code: "3590", name: "時緯", role: "觸控" },
      { code: "3596", name: "智易", role: "網通設備龍頭" }
    ]
  },
  "台南幫集團": {
    name: "台南幫集團",
    description: "傳統紡織、民生食品、水泥與營建百貨",
    leader: "1216",
    stocks: [
      { code: "1104", name: "環泥", role: "水泥建材" },
      { code: "1216", name: "統一", role: "食品民生龍頭" },
      { code: "1440", name: "南紡", role: "紡織化纖" },
      { code: "2108", name: "南帝", role: "合成橡膠" },
      { code: "2511", name: "太子", role: "建設營建" },
      { code: "2855", name: "統一證", role: "證券" },
      { code: "2912", name: "統一超", role: "7-11便利商店" },
      { code: "9907", name: "統一實", role: "馬口鐵罐" },
      { code: "9919", name: "康那香", role: "不織布/衛材" }
    ]
  },
  "統一集團": {
    name: "統一集團",
    description: "食品加工、超商通路、零售與物流巨擘",
    leader: "1216",
    stocks: [
      { code: "1216", name: "統一", role: "集團核心/食品" },
      { code: "1232", name: "大統益", role: "沙拉油/大豆" },
      { code: "2434", name: "統懋", role: "二極體" },
      { code: "2855", name: "統一證", role: "綜合證券" },
      { code: "2912", name: "統一超", role: "超商通路" },
      { code: "8905", name: "裕國", role: "冷凍倉儲" },
      { code: "9907", name: "統一實", role: "包材" },
      { code: "9919", name: "康那香", role: "衛材" },
      { code: "5902", name: "德記", role: "洋行代理/飲料" }
    ]
  },
  "裕隆集團": {
    name: "裕隆集團",
    description: "汽車製造、銷售、車用半導體與金融租賃",
    leader: "2201",
    stocks: [
      { code: "1417", name: "嘉裕", role: "成衣紡織" },
      { code: "1525", name: "江申", role: "車架/底盤" },
      { code: "2201", name: "裕隆", role: "汽車製造/鴻華" },
      { code: "2204", name: "中華", role: "商用車" },
      { code: "2227", name: "裕日車", role: "日產代理" },
      { code: "2338", name: "光罩", role: "光罩代工" },
      { code: "3016", name: "嘉晶", role: "磊晶/化合物半導體" },
      { code: "3059", name: "華晶科", role: "車用鏡頭/影像" },
      { code: "9941", name: "裕融", role: "融資租賃" }
    ]
  },
  "鴻海集團": {
    name: "鴻海集團",
    description: "全球電子代工巨擘、AI伺服器與面板電動車生態圈",
    leader: "2317",
    stocks: [
      { code: "2317", name: "鴻海", role: "集團核心/EMS" },
      { code: "2328", name: "廣宇", role: "連接線材" },
      { code: "6121", name: "新普", role: "電池模組" },
      { code: "2354", name: "鴻準", role: "機殼/散熱" },
      { code: "2392", name: "正崴", role: "連接器/通路" },
      { code: "3062", name: "建漢", role: "網通" },
      { code: "3481", name: "群創", role: "面板" },
      { code: "6298", name: "威強/威強電", role: "工業電腦" },
      { code: "3413", name: "京鼎", role: "半導體設備" },
      { code: "6451", name: "訊芯-KY", role: "CPO/SiP" },
      { code: "4958", name: "臻鼎-KY", role: "PCB" },
      { code: "6414", name: "樺漢", role: "IPC" },
      { code: "6669", name: "緯穎", role: "AI伺服器(夥伴)" }
    ]
  },
  "亞東/遠東集團": {
    name: "亞東/遠東集團",
    description: "石化、化纖、水泥、百貨、電信與金融",
    leader: "1402",
    stocks: [
      { code: "1102", name: "亞泥", role: "水泥" },
      { code: "1402", name: "遠東新/遠紡", role: "化纖/紡織/母公司" },
      { code: "1460", name: "宏遠", role: "機能布料" },
      { code: "1710", name: "東聯", role: "特化EG" },
      { code: "2606", name: "裕民", role: "散裝航運" },
      { code: "2845", name: "遠東銀", role: "商業銀行" },
      { code: "2903", name: "遠東百", role: "百貨公司" },
      { code: "4904", name: "遠傳", role: "電信" }
    ]
  },
  "長榮集團": {
    name: "長榮集團",
    description: "全球貨櫃海運、航空與鋼鐵陸運",
    leader: "2603",
    stocks: [
      { code: "2603", name: "長榮", role: "貨櫃海運龍頭" },
      { code: "2607", name: "榮運", role: "陸運/物流" },
      { code: "2618", name: "長榮航", role: "航空" },
      { code: "5009", name: "榮剛", role: "特殊鋼" },
      { code: "5506", name: "長鴻", role: "營建" },
      { code: "2851", name: "中再保", role: "再保險" }
    ]
  },
  "中信銀/中信集團": {
    name: "中信銀/中信集團",
    description: "消金與信用卡龍頭、人壽與證券",
    leader: "2891",
    stocks: [
      { code: "2823", name: "中壽/凱基人壽", role: "人壽" },
      { code: "2891", name: "中信金", role: "金控核心" },
      { code: "6008", name: "中信證", role: "綜合證券" }
    ]
  },
  "和信集團": {
    name: "和信集團",
    description: "水泥、石化、橡膠與被動元件",
    leader: "1101",
    stocks: [
      { code: "1101", name: "台泥", role: "水泥/綠能" },
      { code: "1312", name: "國喬", role: "石化SM" },
      { code: "2104", name: "中橡", role: "碳黑/碳素" },
      { code: "6173", name: "信昌電", role: "被動元件" },
      { code: "4725", name: "信昌化", role: "酚酚酮特化" }
    ]
  },
  "力晶集團": {
    name: "力晶集團",
    description: "晶圓代工力積電、記憶體與封測",
    leader: "6770",
    stocks: [
      { code: "2348", name: "力廣", role: "記憶體" },
      { code: "3051", name: "力特", role: "偏光片" },
      { code: "5202", name: "力新", role: "軟體" },
      { code: "5346", name: "力晶/力積電", role: "晶圓代工" },
      { code: "6239", name: "力成", role: "記憶體封測龍頭" }
    ]
  },
  "東元集團": {
    name: "東元集團",
    description: "重電馬達、家電、機電工程與資訊",
    leader: "1504",
    stocks: [
      { code: "1504", name: "東元", role: "重電/馬達" },
      { code: "2321", name: "東訊", role: "通訊" },
      { code: "2431", name: "聯昌", role: "電源供應器" },
      { code: "5438", name: "東友", role: "印表機/掃描器" },
      { code: "8249", name: "菱光", role: "影像感測器CIS" }
    ]
  },
  "永豐餘集團": {
    name: "永豐餘集團",
    description: "造紙、永豐金控、元太電子紙與生技",
    leader: "1907",
    stocks: [
      { code: "1905", name: "華紙", role: "紙漿/文化紙" },
      { code: "1907", name: "永豐餘", role: "造紙/投控" },
      { code: "2890", name: "永豐金", role: "金控" },
      { code: "5349", name: "先豐", role: "PCB" },
      { code: "8069", name: "元太", role: "全球電子紙龍頭" }
    ]
  },
  "大眾集團": {
    name: "大眾集團",
    description: "電腦系統、工業電腦與金融",
    leader: "3701",
    stocks: [
      { code: "3701", name: "大眾控", role: "電腦系統/抬頭顯示" },
      { code: "5410", name: "國眾", role: "系統整合" },
      { code: "6022", name: "大眾證", role: "證券" }
    ]
  },
  "國巨集團": {
    name: "國巨集團",
    description: "全球被動元件巨擘與電阻電容",
    leader: "2327",
    stocks: [
      { code: "2327", name: "國巨", role: "被動元件龍頭" },
      { code: "2375", name: "智寶/凱美", role: "電解電容" },
      { code: "2456", name: "奇力新", role: "電感" }
    ]
  },
  "金錸集團": {
    name: "金錸集團",
    description: "印刷電路板、金融與金屬",
    leader: "2367",
    stocks: [
      { code: "2367", name: "耀華", role: "PCB/軟硬結合板" },
      { code: "6012", name: "金鼎證", role: "證券" },
      { code: "8933", name: "愛地雅", role: "自行車" },
      { code: "1815", name: "富喬", role: "玻纖布" }
    ]
  },
  "寶來集團": {
    name: "寶來集團",
    description: "金融期貨與金融科技",
    leader: "2854",
    stocks: [
      { code: "2854", name: "寶來證", role: "證券" },
      { code: "5210", name: "寶碩", role: "金融軟體" },
      { code: "6023", name: "寶來期", role: "期貨" }
    ]
  },
  "正隆集團": {
    name: "正隆集團",
    description: "造紙、紙業與汽電共生",
    leader: "1904",
    stocks: [
      { code: "1904", name: "正隆", role: "工紙/紙器" },
      { code: "2616", name: "山隆", role: "加油站/運輸" },
      { code: "8931", name: "大汽電", role: "汽電共生" }
    ]
  },
  "威盛集團": {
    name: "威盛集團",
    description: "IC設計、宏達電VR/元宇宙與感測器",
    leader: "2388",
    stocks: [
      { code: "2388", name: "威盛", role: "IC設計/AI感測" },
      { code: "2498", name: "宏達電", role: "VR/元宇宙" },
      { code: "5344", name: "立衛", role: "測試" },
      { code: "6118", name: "建達", role: "通路" },
      { code: "8068", name: "全達", role: "IC通路" }
    ]
  },
  "新光集團": {
    name: "新光集團",
    description: "紡織、保險、新光金控、瓦斯與保全",
    leader: "2888",
    stocks: [
      { code: "1409", name: "新纖", role: "化纖" },
      { code: "1419", name: "新紡", role: "紡織" },
      { code: "2850", name: "新產", role: "產險" },
      { code: "2887", name: "台新金/台新新光金", role: "金控" },
      { code: "2888", name: "新光金", role: "金控" },
      { code: "9908", name: "大台北", role: "瓦斯" },
      { code: "9925", name: "新保", role: "新光保全" },
      { code: "9926", name: "新海", role: "瓦斯" }
    ]
  },
  "神達集團": {
    name: "神達集團",
    description: "神達伺服器、聯華氣體、聯強通路與神基",
    leader: "3706",
    stocks: [
      { code: "1229", name: "聯華", role: "特化/食品" },
      { code: "1313", name: "聯成", role: "可塑劑石化" },
      { code: "2315", name: "神達", role: "AI伺服器/IPC" },
      { code: "2347", name: "聯強", role: "亞太最大3C通路" },
      { code: "3005", name: "神基", role: "強固型電腦" }
    ]
  },
  "華新集團": {
    name: "華新集團",
    description: "電線電纜、華邦電記憶體、華新科被動元件與彩晶",
    leader: "1605",
    stocks: [
      { code: "1605", name: "華新", role: "電纜/不銹鋼" },
      { code: "2344", name: "華邦電", role: "記憶體" },
      { code: "2492", name: "華新科", role: "MLCC" },
      { code: "5469", name: "瀚宇博", role: "PCB" },
      { code: "6116", name: "彩晶", role: "面板" },
      { code: "8110", name: "華東", role: "封測" }
    ]
  },
  "聯華神通集團": {
    name: "聯華神通集團",
    description: "聯華、神達、聯強、神基與正文網通",
    leader: "1229",
    stocks: [
      { code: "1229", name: "聯華", role: "特化/麵粉" },
      { code: "1313", name: "聯成", role: "可塑劑" },
      { code: "2315", name: "神達", role: "伺服器" },
      { code: "2347", name: "聯強", role: "3C通路" },
      { code: "2471", name: "資通", role: "軟體" },
      { code: "3005", name: "神基", role: "強固電腦" },
      { code: "4906", name: "正文", role: "網通" }
    ]
  },
  "大同集團": {
    name: "大同集團",
    description: "重電、家電、華映、福華與大世科",
    leader: "2371",
    stocks: [
      { code: "2371", name: "大同", role: "重電/電力" },
      { code: "2442", name: "美齊", role: "顯示器" },
      { code: "2475", name: "華映", role: "面板" },
      { code: "8085", name: "福華", role: "光電/背光" },
      { code: "8099", name: "大世科", role: "系統整合" }
    ]
  },
  "中鋼集團": {
    name: "中鋼集團",
    description: "台灣鋼鐵霸主、中碳、中鴻與工程",
    leader: "2002",
    stocks: [
      { code: "1535", name: "中宇", role: "環工/工程" },
      { code: "1723", name: "中碳", role: "煤焦油化學/負極材" },
      { code: "2002", name: "中鋼", role: "鋼鐵龍頭" },
      { code: "2013", name: "中鋼構", role: "鋼結構" },
      { code: "2014", name: "中鴻", role: "熱軋鋼捲" },
      { code: "9930", name: "中聯資", role: "水淬高爐水泥" }
    ]
  },
  "矽品集團": {
    name: "矽品集團",
    description: "半導體封測矽品、全懋、京元電與矽格",
    leader: "2325",
    stocks: [
      { code: "2325", name: "矽品", role: "IC封測" },
      { code: "2446", name: "全懋", role: "載板" },
      { code: "2449", name: "京元電", role: "測試" },
      { code: "6257", name: "矽格", role: "測試" }
    ]
  },
  "錸德集團": {
    name: "錸德集團",
    description: "光碟儲存、國碩太陽能與鈺德",
    leader: "2349",
    stocks: [
      { code: "2349", name: "錸德", role: "光碟儲存/光電" },
      { code: "2406", name: "國碩", role: "太陽能/矽晶圓" },
      { code: "3050", name: "鈺德", role: "預錄光碟/綠能" }
    ]
  },
  "茂迪集團": {
    name: "茂迪集團",
    description: "太陽能電池與模組茂迪、茂綸",
    leader: "6244",
    stocks: [
      { code: "6227", name: "茂綸", role: "IC通路" },
      { code: "6244", name: "茂迪", role: "太陽能電池" }
    ]
  },
  "富邦集團": {
    name: "富邦集團",
    description: "富邦金控、台灣大電信與momo富邦媒",
    leader: "2881",
    stocks: [
      { code: "2881", name: "富邦金", role: "金控核心" },
      { code: "3045", name: "台灣大", role: "電信" },
      { code: "8454", name: "富邦媒", role: "電商" }
    ]
  },
  "潤泰集團": {
    name: "潤泰集團",
    description: "潤泰創新、潤泰全球、凱基金控與生技",
    leader: "9945",
    stocks: [
      { code: "2915", name: "潤泰全", role: "紡織/投資" },
      { code: "9945", name: "潤泰新", role: "營建/商場" },
      { code: "2883", name: "凱基金", role: "金控/壽險" }
    ]
  },
  "力麗集團": {
    name: "力麗集團",
    description: "化纖紡織力麗、力鵬與力麒建設",
    leader: "1444",
    stocks: [
      { code: "1444", name: "力麗", role: "聚酯纖維" },
      { code: "1447", name: "力鵬", role: "尼龍粒" },
      { code: "5512", name: "力麒", role: "營建建設" }
    ]
  },
  "耐斯集團": {
    name: "耐斯集團",
    description: "食品愛之味、劍湖山世界與國票金控",
    leader: "1217",
    stocks: [
      { code: "1217", name: "愛之味", role: "食品飲料" },
      { code: "5701", name: "劍湖山", role: "休閒觀光" },
      { code: "2889", name: "國票金", role: "票券/金控" }
    ]
  },
  "三商行集團": {
    name: "三商行集團",
    description: "三商巧福、三商美邦、三商電與旭富",
    leader: "2905",
    stocks: [
      { code: "2427", name: "三商電", role: "金融ATM系統" },
      { code: "2905", name: "三商行/三商", role: "民生百貨/餐飲" },
      { code: "4119", name: "旭富", role: "原料藥" }
    ]
  },
  "威京集團": {
    name: "威京集團",
    description: "中石化、中華工程與京華城百貨",
    leader: "1314",
    stocks: [
      { code: "1314", name: "中石化", role: "CPL/AN石化" },
      { code: "2515", name: "中工", role: "營造工程" },
      { code: "2537", name: "春池", role: "建設" }
    ]
  },
  "友訊集團": {
    name: "友訊集團",
    description: "友訊網通D-Link、友旺、明泰與友勁",
    leader: "2332",
    stocks: [
      { code: "2332", name: "友訊", role: "品牌網通" },
      { code: "2444", name: "友旺", role: "網通" },
      { code: "3380", name: "明泰", role: "網通代工" },
      { code: "6142", name: "友勁", role: "網通設備" }
    ]
  },
  "宏泰集團": {
    name: "宏泰集團",
    description: "宏泰建設、宏盛建設與安泰銀行",
    leader: "2534",
    stocks: [
      { code: "2534", name: "宏盛", role: "帝寶營建" },
      { code: "2849", name: "安泰銀", role: "商業銀行" }
    ]
  },
  "明基集團": {
    name: "明基集團",
    description: "佳世達、友達面板、均豪與達方",
    leader: "2352",
    stocks: [
      { code: "2352", name: "佳世達", role: "資訊/代工/醫療" },
      { code: "2409", name: "友達", role: "面板" },
      { code: "5443", name: "均豪", role: "半導體設備" },
      { code: "3080", name: "威力盟", role: "背光" },
      { code: "8163", name: "達方", role: "被動元件/鍵盤" }
    ]
  },
  "遠雄集團": {
    name: "遠雄集團",
    description: "遠雄建設、遠雄自由貿易港區",
    leader: "5522",
    stocks: [
      { code: "5522", name: "遠雄", role: "建設營建" },
      { code: "5607", name: "遠雄港", role: "航空港口物流" }
    ]
  },
  "士林紙業集團": {
    name: "士林紙業集團",
    description: "士紙與萬海航運",
    leader: "1903",
    stocks: [
      { code: "1903", name: "士紙", role: "造紙/濕紙巾" },
      { code: "2615", name: "萬海", role: "貨櫃海運" }
    ]
  },
  "霖園/國泰集團": {
    name: "霖園/國泰集團",
    description: "國泰金控、國泰建設與金融物流",
    leader: "2882",
    stocks: [
      { code: "2501", name: "國建", role: "營建" },
      { code: "2882", name: "國泰金", role: "金融/壽險龍頭" }
    ]
  },
  "華榮集團": {
    name: "華榮集團",
    description: "華榮電纜與第一銅",
    leader: "1608",
    stocks: [
      { code: "1608", name: "華榮", role: "電線電纜" },
      { code: "2009", name: "第一銅", role: "銅片/金屬" }
    ]
  },
  "中纖集團": {
    name: "中纖集團",
    description: "中國人造纖維、台中銀行與磐亞特化",
    leader: "1718",
    stocks: [
      { code: "1718", name: "中纖", role: "化纖EG" },
      { code: "2812", name: "台中銀", role: "商業銀行" },
      { code: "4707", name: "磐亞", role: "特化" }
    ]
  },
  "聯發科集團": {
    name: "聯發科集團",
    description: "手機晶片聯發科、揚智與曜鵬",
    leader: "2454",
    stocks: [
      { code: "2454", name: "聯發科", role: "IC設計龍頭" },
      { code: "3041", name: "揚智", role: "晶片" },
      { code: "3538", name: "曜鵬", role: "影像IC" }
    ]
  },
  "能率集團": {
    name: "能率集團",
    description: "應華精密金屬與上奇科技",
    leader: "5392",
    stocks: [
      { code: "5392", name: "應華", role: "金屬機殼/車用" },
      { code: "6123", name: "上奇", role: "雲端服務/軟體" }
    ]
  },
  "仰德集團": {
    name: "仰德集團",
    description: "士林電機與國賓大飯店",
    leader: "1503",
    stocks: [
      { code: "1503", name: "士電", role: "重電/變壓器龍頭" },
      { code: "2704", name: "國賓", role: "飯店餐飲" }
    ]
  },
  "龍邦集團": {
    name: "龍邦集團",
    description: "龍邦開發與台灣人壽",
    leader: "2514",
    stocks: [
      { code: "2514", name: "龍邦", role: "建設營造" },
      { code: "2833", name: "台壽保", role: "人壽" }
    ]
  },
  "東陽集團": {
    name: "東陽集團",
    description: "汽車塑膠保險桿東陽與開億金屬件",
    leader: "1319",
    stocks: [
      { code: "1319", name: "東陽", role: "汽車保險桿AM龍頭" },
      { code: "1523", name: "開億", role: "車用衝壓件" }
    ]
  },
  "偉聯集團": {
    name: "偉聯集團",
    description: "中航航運與偉聯科技",
    leader: "2612",
    stocks: [
      { code: "2612", name: "中航", role: "散裝航運" },
      { code: "9912", name: "偉聯", role: "顯示器/電腦" }
    ]
  },
  "萬華集團": {
    name: "萬華集團",
    description: "萬華企業與第一大飯店",
    leader: "2701",
    stocks: [
      { code: "2701", name: "萬企", role: "百貨資產" },
      { code: "2706", name: "第一店", role: "飯店" }
    ]
  },
  "大億交通集團": {
    name: "大億交通集團",
    description: "大億車燈、堤維西車燈與大億科",
    leader: "1521",
    stocks: [
      { code: "1521", name: "大億", role: "車燈OEM" },
      { code: "1522", name: "堤維西", role: "車燈AM龍頭" },
      { code: "8107", name: "大億科", role: "車用導光板" }
    ]
  },
  "廣達集團": {
    name: "廣達集團",
    description: "廣達AI伺服器、廣明儲存與鼎天衛星",
    leader: "2382",
    stocks: [
      { code: "2382", name: "廣達", role: "AI伺服器/筆電" },
      { code: "6188", name: "廣明", role: "達明機器人/儲存" },
      { code: "3306", name: "鼎天", role: "GPS衛星導航" }
    ]
  },
  "永大機電集團": {
    name: "永大機電集團",
    description: "永大電梯與永彰機電",
    leader: "1507",
    stocks: [
      { code: "1507", name: "永大", role: "電梯" },
      { code: "4523", name: "永彰", role: "車用冷氣/機電" }
    ]
  },
  "力山集團": {
    name: "力山集團",
    description: "力山工具機、福裕與力武",
    leader: "1515",
    stocks: [
      { code: "1515", name: "力山", role: "電動工具/健身器材" },
      { code: "4513", name: "福裕", role: "磨床機床" },
      { code: "4529", name: "力武", role: "馬達工具" }
    ]
  },
  "美吾華集團": {
    name: "美吾華集團",
    description: "美吾華染髮髮品與懷特生技新藥",
    leader: "1731",
    stocks: [
      { code: "1731", name: "美吾華", role: "髮品民生" },
      { code: "4108", name: "懷特", role: "植物新藥" }
    ]
  },
  "泰山集團": {
    name: "泰山集團",
    description: "泰山企業食品與全家便利商店投資",
    leader: "1218",
    stocks: [
      { code: "1218", name: "泰山", role: "油脂/食品" },
      { code: "5903", name: "全家", role: "便利商店" }
    ]
  },
  "義聯集團": {
    name: "義聯集團",
    description: "燁輝不銹鋼、燁興與燁聯鋼鐵",
    leader: "2023",
    stocks: [
      { code: "2023", name: "燁輝", role: "鍍鋅鋼板" },
      { code: "2007", name: "燁興", role: "盤元鋼鐵" },
      { code: "9957", name: "燁聯", role: "不銹鋼" }
    ]
  },
  "國產集團": {
    name: "國產集團",
    description: "國產預拌混凝土與中興保全",
    leader: "2504",
    stocks: [
      { code: "2504", name: "國產", role: "預拌混凝土龍頭" },
      { code: "9917", name: "中保/中興保全", role: "保全/智慧城市" }
    ]
  },
  "茂矽集團": {
    name: "茂矽集團",
    description: "茂矽晶圓代工與茂德記憶體",
    leader: "2342",
    stocks: [
      { code: "2342", name: "茂矽", role: "晶圓代工" },
      { code: "5387", name: "茂德", role: "DRAM" }
    ]
  },
  "南亞集團": {
    name: "南亞集團",
    description: "南亞塑膠、南科與台塑化",
    leader: "1303",
    stocks: [
      { code: "1303", name: "南亞", role: "電子材料/塑膠" },
      { code: "2408", name: "南科/南亞科", role: "DRAM" },
      { code: "6505", name: "台塑化", role: "石化" }
    ]
  },
  "台達電集團": {
    name: "台達電集團",
    description: "全球電源供應器與工業自動化龍頭、乾坤與茂達",
    leader: "2308",
    stocks: [
      { code: "2308", name: "台達電", role: "電源供應/綠能/自動化" },
      { code: "2452", name: "乾坤", role: "電感/被動元件" },
      { code: "6138", name: "茂達", role: "電源管理IC" }
    ]
  },
  "台聚集團": {
    name: "台聚集團",
    description: "台聚、華夏塑膠、台達化與亞聚",
    leader: "1304",
    stocks: [
      { code: "1305", name: "華夏", role: "PVC塑膠" },
      { code: "1309", name: "台達化", role: "ABS/PS塑膠" },
      { code: "1304", name: "台聚", role: "PE/EVA塑膠" },
      { code: "1308", name: "亞聚", role: "PE/EVA塑膠" },
      { code: "8121", name: "越峰", role: "電感鐵芯/被動元件" }
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
