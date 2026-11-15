export type LangCode = "zh" | "en" | "ja";

interface LangPair {
  en: string;
  ja: string;
}

const EXACT_PHRASES: Record<string, LangPair> = {
  // Brand & Topbar
  "绝区零 v3.3 战术配队 · 合轴排轴 · UID 展柜精算台": {
    en: "ZZZ v3.3 Tactical Team · Swap Timeline · UID Studio",
    ja: "ゼンレスゾーンゼロ v3.3 戦術編成・合軸・UID精算スタジオ"
  },
  "绝区零 v3.3 战术配队与合轴精算台": {
    en: "ZZZ v3.3 Tactical Team & Swap Studio",
    ja: "ゼンレスゾーンゼロ v3.3 戦術編成・合軸精算スタジオ"
  },
  "绝区零战术配队与合轴精算台": {
    en: "ZZZ Tactical Squad & Swap Studio",
    ja: "ゼンレス 戦術編成・合軸精算スタジオ"
  },
  "62 代理人 · 103 音擎 · 31 驱动盘 · 支持 UID 展柜同步、Worker 盘库寻优与可视化多轨合轴": {
    en: "62 Agents · 103 W-Engines · 31 Drive Sets · Enka UID Sync, Worker Optimizer & Multi-Track Swap Sequencer",
    ja: "62エージェント・103音動機・31ドライバディスク · UID同期・Worker最適化・マルチトラック合軸対応"
  },
  "TS 引擎就绪": { en: "TS Engine Ready", ja: "TSエンジン準備完了" },
  "UID 展柜同步": { en: "UID Sync", ja: "UIDショーケース同期" },
  "UID展柜同步": { en: "UID Sync", ja: "UID同期" },
  "一键优盘": { en: "Auto Discs", ja: "最適ディスク自動" },
  "自定义工坊": { en: "Data Workshop", ja: "カスタム工房" },
  "全量自定义工坊": { en: "Data Workshop", ja: "カスタム工房" },
  "快捷工具 ▾": { en: "Tools ▾", ja: "ツール ▾" },
  "快速练度基准": { en: "Quick Investment Baselines", ja: "育成基準プリセット" },
  "全队设为 0+1 基准": { en: "Set Team to M0W1 Baseline", ja: "全員 無凸+モチーフ完凸なし(M0W1)" },
  "全队设为 M6R5 顶配": { en: "Set Team to M6W5 Whale Max", ja: "全員 完凸+音動機完凸(M6W5)" },
  "1号位单人裸测": { en: "Slot 1 Solo Baseline", ja: "1番枠 ソロ単騎計測" },
  "仅看 1号位吃拐直伤": { en: "Slot 1 Hypercarry Only", ja: "1番枠 キャリー火力のみ表示" },
  "工作区与外观": { en: "Workspace & Appearance", ja: "ワークスペースと外観" },
  "切换亮色主题": { en: "Switch to Light Theme", ja: "ライトテーマに切替" },
  "切换暗色主题": { en: "Switch to Dark Theme", ja: "ダークテーマに切替" },
  "切换亮色": { en: "Switch to Light Theme", ja: "ライトモードへ" },
  "切换暗色": { en: "Switch to Dark Theme", ja: "ダークモードへ" },
  "导出全盘配置 JSON": { en: "Export Workspace JSON", ja: "設定JSONをエクスポート" },
  "导入配置 JSON": { en: "Import Workspace JSON", ja: "設定JSONをインポート" },
  "重置全部默认参数": { en: "Reset All to Defaults", ja: "すべて初期値にリセット" },

  // Telemetry Stage & Snapshot Bank
  "合轴压帧后真实每秒伤害 (DPS)": {
    en: "Swap-Compressed True Damage Per Second (DPS)",
    ja: "合軸フレーム短縮後の実質秒間ダメージ (DPS)"
  },
  "单轮完整爆发总伤害 (DPR)": {
    en: "Full Single-Rotation Burst Damage (DPR)",
    ja: "1ローテーション完全バースト総ダメージ (DPR)"
  },
  "每秒 DPS": { en: "True DPS", ja: "秒間 DPS" },
  "单轮 DPR": { en: "Cycle DPR", ja: "総傷 DPR" },
  "单轮总伤 DPR": { en: "Rotation DPR", ja: "1ローテ DPR" },
  "真实每秒 DPS": { en: "True DPS", ja: "実質秒間 DPS" },
  "合轴实轴周期": { en: "Compressed Cycle", ja: "合軸ローテ周期" },
  "危局3分钟预估": { en: "3m Deadly Assault", ja: "危局3分間予測" },
  "暂无上阵代理人": { en: "No Active Agents", ja: "編成キャラなし" },
  "切换编队 / 搜队 ▾": { en: "Switch Squad / Box Finder ▾", ja: "編成切替 / Box検索 ▾" },
  "当前未上阵角色": { en: "No Agents Deployed", ja: "エージェント未編成" },
  "方案横评记忆槽 (点击空槽存档 · 点击已存槽回档对比)": {
    en: "Build Memory Bank (Click empty slot to save · Click saved slot to restore & compare)",
    ja: "編成メモリバンク (空き枠で保存・保存枠クリックで復元比較)"
  },
  "点击存入当前配装": { en: "Save Current Build", ja: "現在の編成を保存" },
  "热门速切编队": { en: "Quick Meta Squads", ja: "定番クイック編成" },
  "自由选人 / Box智能搜队 ▸": { en: "Free Roster / Smart Box Finder ▸", ja: "自由選択 / 所持Box検索 ▸" },

  // Operator Channel Strips
  "4号位邦布": { en: "Slot 4 Bangboo", ja: "4番枠ボンプ" },
  "精改邦布": { en: "Edit Bangboo", ja: "ボンプ編集" },
  "01 // 主力核心输出": { en: "01 // Main Carry", ja: "01 // メインアタッカー" },
  "02 // 副C · 击破 · 支援拐": { en: "02 // Sub-DPS · Stun · Support", ja: "02 // サブ火力・撃破・支援" },
  "03 // 副C · 击破 · 支援拐": { en: "03 // Sub-DPS · Stun · Support", ja: "03 // サブ火力・撃破・支援" },
  "当前空置": { en: "Empty Slot", ja: "空きスロット" },
  "选择上阵代理人": { en: "Select Agent", ja: "エージェント選択" },
  "-- 点击选择角色上阵 --": { en: "-- Select Agent to Deploy --", ja: "-- キャラを選択して編成 --" },
  "UID实盘": { en: "UID Live", ja: "UID実装備" },
  "● 额外能力激活": { en: "● Core Passive ON", ja: "● 追加能力発動" },
  "○ 额外能力未满": { en: "○ Core Passive OFF", ja: "○ 追加能力未発動" },
  "展柜实盘": { en: "Use Showcase", ja: "実データ適用" },
  "盘库寻优": { en: "Pool Opt", ja: "プール最適" },
  "工坊": { en: "Edit", ja: "工房" },
  "局内贯穿": { en: "Combat Sheer", ja: "戦闘中貫通力" },
  "局内防御": { en: "Combat DEF", ja: "戦闘中防御力" },
  "局内攻击": { en: "Combat ATK", ja: "戦闘中攻撃力" },
  "精通 / 掌控": { en: "AP / AM", ja: "精通 / 掌握" },
  "局内双暴": { en: "Combat CRIT", ja: "戦闘中会心" },
  "期望贡献": { en: "Weighted Out", ja: "期待貢献値" },
  "全队占比": { en: "Squad Share", ja: "チーム比率" },
  "更换角色": { en: "Switch Agent", ja: "キャラ変更" },
  "影画阶数 (M0~M6)": { en: "Mindscape (M0–M6)", ja: "心象映画 (M0〜M6)" },
  "装备音擎": { en: "W-Engine", ja: "装備音動機" },
  "精改音擎": { en: "Edit W-Engine", ja: "音動機編集" },
  "音擎精炼": { en: "Overclock", ja: "音動機凸数" },
  "4件套驱动盘": { en: "4-Piece Drive Set", ja: "4セットディスク" },
  "2件套驱动盘": { en: "2-Piece Drive Set", ja: "2セットディスク" },
  "自动毕业寻优": { en: "Auto Roll BiS", ja: "自動最適配分" },
  "1-6号逐盘精调": { en: "Slot 1–6 Discs", ja: "1〜6番個別編集" },
  "局外面板直填": { en: "Direct Stats", ja: "ステ直接入力" },
  "自动寻优[4][5][6]主词条": { en: "Auto-Optimize [4][5][6] Mains", ja: "[4][5][6]メイン自動最適" },
  "自动配平": { en: "Auto Substats", ja: "サブ自動配分" },
  "重置6盘": { en: "Reset 6", ja: "6枚初期化" },
  "同步自动初值": { en: "Sync Auto Stats", ja: "自動値を同期" },
  "展开高阶调参 (等级/核心技/动作占比/覆盖率/额外Buff注入)": {
    en: "Advanced Tuning (Levels / Core / Action Shares / Uptime / Extra Buffs)",
    ja: "詳細パラメータ調整 (Lv/コア/技比率/稼働率/追加バフ)"
  },
  "点击上阵 ↗": { en: "Deploy ↗", ja: "編成する ↗" },

  // Studio Navigation Tabs
  "编队与配装": { en: "Squad & Builds", ja: "編成・ビルド" },
  "UID 展柜": { en: "UID Showcase", ja: "UIDショーケース" },
  "合轴与排轴器": { en: "Swap & Timeline", ja: "合軸・タイムライン" },
  "乘区与体检": { en: "Multipliers & Audit", ja: "乗算区・ビルド診断" },
  "专武 · 影画 · ROI": { en: "W-Engine · Mindscape · ROI", ja: "音動機・心象映画・ROI" },
  "首领环境": { en: "Boss & Stage Env", ja: "ボス耐性・ステージ環境" },
  "全景展开": { en: "Show All Panels", ja: "全パネル展開" },
  "收起选人台 ▲": { en: "Collapse Picker ▲", ja: "キャラ選択を折りたたむ ▲" },
  "展开选人台 ▼": { en: "Expand Picker ▼", ja: "キャラ選択を展開 ▼" },

  // Section Headers & Descriptions
  "展柜练度同步 & 本地驱动盘库寻优": {
    en: "UID Showcase Sync & Local Drive Disc Optimizer",
    ja: "UIDショーケース同期＆ローカルディスク最適化"
  },
  "拉取游戏个人名片公开展柜的 6 名角色与 1–6 号驱动盘（增量合并缓存），或在后台线程一键算出当前配队最优实盘组合": {
    en: "Fetch all 6 showcase agents & Slot 1–6 Drive Discs from Enka.Network (incremental local merge) and run Web Worker disc optimization",
    ja: "ゲーム内名刺ショーケースの6名と1〜6番ディスクを取得（差分マージ保存）し、Web Workerで最適装備を自動探索します"
  },
  "编队选人台": { en: "Squad Selector & Box Finder", ja: "編成セレクター＆所持Box検索" },
  "24 套热门公式配队、全图鉴点选、万能二人底盘与 Web Worker 智能 Box 搜队": {
    en: "24 meta team presets, full roster picker, universal 2-support shells, and Web Worker Box team finder",
    ja: "24種の定番編成プリセット、全キャラ自由選択、汎用サポ2名コア、Web Worker最適編成検索"
  },
  "代理人配装与词条工作台": { en: "Agent Loadout & Substat Workbench", ja: "エージェント装備・サブステ調整台" },
  "支持「自动毕业寻优 / 1–6 号逐盘精调 / 局外面板直填」三模式切换，以及 4 号位邦布协同": {
    en: "Switch freely between Auto Roll Optimizer, Slot 1–6 Disc Editor, and Direct Stat Sheet Override, plus Bangboo synergy",
    ja: "「自動最適配分 / 1〜6番個別ディスク編集 / ステータス直接入力」の3モード切替とボンプ連携"
  },
  "八维合轴物理控制台 & 多轨排轴器": {
    en: "8D Swap-Cancel Physics & Multi-Track Gantt Sequencer",
    ja: "8次元スワップ物理演算＆マルチトラック排軸シーケンサー"
  },
  "实时推演脱手帧并行压缩、无敌帧安全合轴、手动双连携、支援点循环与短轴拐覆盖率": {
    en: "Simulate off-field frame overlap, i-frame safe swaps, manual double chain attacks, assist point economy & short-buff uptime",
    ja: "控え並列フレーム圧縮、無敵フレーム安全スワップ、手動ダブル連携、支援ポイント循環、短時間バフ稼働率をリアルタイム推演"
  },
  "双口径输出看板 · 乘区透视与防呆体检": {
    en: "Dual-Metric Output · 6-Multiplier Breakdown & Build Audit",
    ja: "DPS/DPR出力ボード・6大乗算区解析＆ビルド診断"
  },
  "每秒真实 DPS、单轮总伤 DPR、危局 3 分钟预估、六大独立乘区拆解与面板转模达标检测": {
    en: "True DPS, single-rotation DPR, 3-min Deadly Assault projection, 6-zone multiplier audit & stat conversion threshold checks",
    ja: "実質DPS、1ローテ総ダメージDPR、危局強襲戦3分予測、6大乗算区内訳、ステータス変換閾値チェック"
  },
  "专武 · 影画 · 下一金 ROI 评测中心": {
    en: "W-Engine · Mindscape · Next-Gold ROI Center",
    ja: "モチーフ音動機・心象映画・1凸/餅ROI評価センター"
  },
  "基于当前真实阵容、合轴手法与首领抗性，实时测算每把音擎、每颗影画与驱动盘套装的边际收益": {
    en: "Live marginal gain rankings for every W-Engine, Mindscape tier, next limited pull, and Drive Set under your exact squad & boss",
    ja: "現在の編成・合軸操作・ボス耐性に基づき、全音動機・心象映画・次ガチャ1金の限界利益をリアルタイム算出"
  },
  "式舆 / 危局天气词条 & 首领抗性环境": {
    en: "Shiyu / Deadly Assault Stage Buffs & Boss Resistances",
    ja: "式輿防衛戦 / 危局強襲戦バフ＆ボス属性耐性環境"
  },
  "七属性独立弱点与抗性矩阵、破韧失衡条上限、秽盾系数及高压受击打断校验": {
    en: "7-element weakness/resistance matrix, daze bar threshold, miasma shield factor & high-aggro interruption simulation",
    ja: "7属性別の弱点・耐性マトリクス、ブレイク値上限、穢れシールド係数、高圧被弾中断チェック"
  },

  // Common labels & Swap Presets
  "我的Box智能搜队器": { en: "Smart Box Team Finder", ja: "所持Box自動編成検索" },
  "四大体系与八维合轴百科": { en: "Combat Archetypes & 8D Swap Guide", ja: "4大編成体系＆8次元合軸ガイド" },
  "全部流派": { en: "All Archetypes", ja: "全アーキタイプ" },
  "+ 将当前编队存为自定义公式队": { en: "+ Save Current Squad as Custom Preset", ja: "+ 現在の編成をカスタム保存" },
  "站场轮切 (顺序出招)": { en: "Sequential Rotation (No Cancel)", ja: "順番ローテ (キャンセルなし)" },
  "安全合轴 (高塔无伤)": { en: "Safe i-Frame Swap (Tower Zero-Hit)", ja: "安全合軸 (無敵フレーム限定)" },
  "主流合轴 (快支乒乓)": { en: "Standard Swap (Quick Assist Ping-Pong)", ja: "標準合軸 (クイック支援ループ)" },
  "进阶合轴 (双连携+闪A振刀)": { en: "Advanced Swap (Double Chain + Parry)", ja: "上級合軸 (2連携＋パリィ支援)" },
  "极限竞速 (零帧贪刀压条)": { en: "Speedrun Max (0-Frame Dual On-Field)", ja: "極限TA (0フレーム同時攻撃)" },
  "新手保底": { en: "Casual", ja: "初心者向け" },
  "高压爬塔": { en: "Safe Tower", ja: "高難度塔" },
  "实战标准": { en: "Standard", ja: "実戦標準" },
  "深度手法": { en: "Advanced", ja: "上級操作" },
  "竞速上限": { en: "Speedrun", ja: "TA上限" },
  "按当前手法重排标准轴": { en: "Rebuild Standard Rotation", ja: "現在の手法で標準軸を再生成" },
  "+ 追加招式块": { en: "+ Add Action Block", ja: "+ アクション追加" },
  "前移顺序": { en: "Move Left", ja: "前へ移動" },
  "后移顺序": { en: "Move Right", ja: "後ろへ移動" },
  "复制此块": { en: "Duplicate", ja: "複製" },
  "删除此块": { en: "Delete", ja: "削除" },
  "如 100123456 或 1300123456": {
    en: "e.g. 100123456 or 1300123456",
    ja: "例: 100123456 / 1300123456"
  },
  "无需联网，立即载入内置 6 名满级角色与 36 张驱动盘示例体验完整工坊与寻优流程": {
    en: "Offline-ready: load 6 Lv.60 demo agents & 36 Drive Discs to test the full optimizer workflow",
    ja: "通信不要：内蔵のLv.60キャラ6名＆ディスク36枚のサンプルを即座に読み込みます"
  },

  // Showcase Cards, Radar & Substat Priority Additions
  "点击选择上阵代理人": { en: "Click to Deploy Agent", ja: "クリックしてキャラ編成" },
  "更换 ▾": { en: "Switch ▾", ja: "変更 ▾" },
  "精改": { en: "Tune", ja: "調整" },
  "+1 词条边际收益优先级": { en: "+1 Substat Roll Gain Priority", ja: "+1 サブステ限界上昇率優先度" },
  "全队实轴口径": { en: "Squad DPS Basis", ja: "チームDPS基準" },
  "个人伤害口径": { en: "Personal DMG Basis", ja: "個人火力基準" },
  "基础区": { en: "Base", ja: "基礎区" },
  "双暴区": { en: "CRIT", ja: "会心区" },
  "精通区": { en: "AP", ja: "精通区" },
  "增伤区": { en: "DMG%", ja: "ダメバフ" },
  "防御穿透": { en: "DEF/PEN", ja: "防御貫通" },
  "抗性削减": { en: "RES", ja: "耐性ダウン" },
  "失衡易伤": { en: "Stun", ja: "ブレイク" },
  "大攻%": { en: "ATK%", ja: "攻撃%" }
};

// Ordered phrase/entity replacements (sorted longest-first at module init)
const RAW_TOKENS: Array<[string, string, string]> = [
  // Multi-word UI & Mechanics Phrases
  ["主口径: 每秒真实DPS (计入合轴缩轴)", "Metric: True DPS (Swap-Compressed)", "基準: 実質DPS (合軸短縮込み)"],
  ["主口径: 单轮总伤DPR (固定单轮)", "Metric: Rotation DPR (Per Cycle)", "基準: 1ローテ総傷DPR"],
  ["口径: 每秒 DPS", "Mode: True DPS", "基準: 秒間DPS"],
  ["口径: 单轮 DPR", "Mode: Cycle DPR", "基準: 総傷DPR"],
  ["方案快照横评 (点击空位记录当前配装与合轴，点击已存方案一键回档对比)：", "Build Snapshots (Click empty slot to save, click saved slot to restore & compare):", "編成スナップショット比較 (空き枠で保存、保存済み枠クリックで復元比較)："],
  ["可视化多轨合轴排轴工作台 (Interactive Gantt Action Sequencer)", "Interactive Multi-Track Gantt Action Sequencer", "マルチトラック合軸タイムライン (Interactive Gantt Sequencer)"],
  ["实心条=前台操作帧，斜纹尾段=切人后后台脱手并行帧，红框尾段=裸露危险帧或早切截断警告。", "Solid = Active on-field frames · Hatched = Off-field parallel frames · Rose = Exposed/truncated warning.", "実線＝表操作フレーム・斜線＝交代後の控え並列フレーム・赤枠＝無防備/早切り警告"],
  ["八维合轴底层物理参数精调矩阵", "8D Swap-Cancel Physics Fine-Tuning Matrix", "8次元合軸物理パラメータ微調整マトリクス"],
  ["调切人点自动顺延后续动作", "Auto-ripple subsequent blocks", "交代点変更時に後続を自動シフト"],
  ["[已开启] 实轴直接驱动主计算器", "[ON] Timeline Drives Main Sim", "[ON] タイムラインで本体演算を駆動"],
  ["[点击开启] 用此实轴驱动主计算器", "[Click] Drive Sim from Timeline", "[切替] このタイムラインで本体駆動"],
  ["失衡爆发窗口", "Stun Burst Window", "ブレイク爆発ウィンドウ"],
  ["失衡外破韧期", "Out-of-Stun Daze Phase", "非ブレイク削りフェーズ"],
  ["失衡爆发期内", "In-Stun Burst Phase", "ブレイク中バースト"],
  ["短轴拐覆盖窗", "Short-Buff Uptime", "短期バフ稼働窓"],
  ["选中动作块精调：", "Selected Block Inspector: ", "選択アクション編集："],
  ["完整保留脱手判定", "Full Off-Field Follow-Through", "控え判定を完全維持"],
  ["载入真实展柜示例 (6角色/36盘)", "Load Live Demo Showcase (6 Agents / 36 Discs)", "実データ例を読込 (6名/36枚)"],
  ["一键同步 UID 展柜", "Sync UID Showcase", "UIDショーケース同期"],
  ["正在拉取展柜...", "Syncing Showcase...", "ショーケース取得中..."],
  ["粘贴 Enka / 导入扫描器 JSON", "Paste Enka / Scanner JSON", "Enka / スキャナーJSON貼付"],
  ["前3名整队上阵", "Deploy Top 3 Agents", "上位3名を編成へ"],
  ["设为我的Box", "Sync to My Box", "所持Boxに反映"],
  ["清空练度柜", "Clear Vault", "保管庫をクリア"],
  ["驱动盘库 Web Worker 后台配装寻优", "Web Worker Drive Pool Optimizer", "Web Worker ディスクプール最適化"],
  ["排除当前队友已穿同张盘(防抢盘)", "Exclude discs equipped by teammates", "味方装備中の同一ディスクを除外"],
  ["绝区零 UID (国服/B服/国际服通用)", "ZZZ UID (CN / Bilibili / Global)", "ZZZ UID (全サーバー対応)"],
  ["热门与自定义公式配队", "Meta & Custom Team Presets", "定番＆カスタム編成プリセット"],
  ["自由选人 + 万能双拐底盘", "Free Roster + Dual-Support Shells", "自由選択＋汎用2サポ基盤"],
  ["不携带邦布 (纯3人基准)", "No Bangboo (3-Agent Baseline)", "ボンプなし (3人のみ基準)"],
  ["额外能力全激活", "All Core Passives Active", "追加能力 すべて発動"],
  ["额外能力未满", "Core Passive Inactive", "追加能力 未発動あり"],
  ["有效副词条预算:", "Substat Budget:", "有効サブステ予算:"],
  ["最优解:", "Optimal:", "最適解:"],
  ["分配:", "Substats:", "配分:"],
  ["循环充沛", "Assist OK", "支援Pt十分"],
  ["透支警告", "Assist Deficit", "支援Pt不足"],
  ["无敌帧安全脱手", "i-Frame Safe Swap", "無敵フレーム安全離脱"],
  ["快支/招架保护脱手", "Assist/Parry Protected", "クイック/パリィ保護離脱"],
  ["无保护裸露脱手(危险合轴)", "Unprotected Exposed Swap", "無防備スワップ(被弾注意)"],
  ["长动画脱手爆发", "Long-Commit Burst Swap", "長モーション控え爆発"],
  ["后台驻场协同", "Off-Field Aftershock", "控え追撃・協同"],
  ["速切短轴拐/破韧", "Quick-Swap Buff / Daze", "クイックスワップ支援/撃破"],
  ["站场目押/闪A取消", "On-Field Cancel Carry", "表立ち回り・回避キャンセル"],
  ["持续引导禁早切", "Channeled (No Early Swap)", "継続チャネリング(早切り厳禁)"],

  // 31 Drive Disc Sets (Full Names first, then short keys)
  ["啄木鸟电音", "Woodpecker Electro", "ウッドペッカー・エレクトロ"],
  ["河豚电音", "Puffer Electro", "パファー・エレクトロ"],
  ["激素朋克", "Hormone Punk", "ホルモン・パンク"],
  ["沧浪行歌", "White Water Ballad", "滄浪の詩"],
  ["折枝剑歌", "Branch & Blade Song", "折枝の刀歌"],
  ["如影相随", "Shadow Harmony", "シャドウ・ハーモニー"],
  ["拂晓生花", "Dawn's Bloom", "暁に咲く花"],
  ["拂晓行纪", "Dawn's Chronicle", "暁のクロニクル"],
  ["云岿如我", "Yunkui Tales", "雲巋が如く"],
  ["荆棘玫瑰", "Thorned Rose", "荊棘のローズ"],
  ["炎狱重金属", "Inferno Metal", "インフェルノ・メタル"],
  ["雷暴重金属", "Thunder Metal", "サンダー・メタル"],
  ["极地重金属", "Polar Metal", "ポーラー・メタル"],
  ["獠牙重金属", "Fanged Metal", "ファング・メタル"],
  ["混沌重金属", "Chaos Metal", "カオス・メタル"],
  ["谶羽之誓", "Oath of Feather", "預言の羽の誓い"],
  ["呼啸沙龙", "Howling Salon", "ハウリング・サロン"],
  ["囚徒手记", "Prisoner's Note", "囚人の手記"],
  ["流光咏叹", "Shining Aria", "流光のアリア"],
  ["法厄同之歌", "Phaethon's Melody", "パエトーンの歌"],
  ["混沌爵士", "Chaos Jazz", "カオス・ジャズ"],
  ["自由蓝调", "Freedom Blues", "フリーダム・ブルース"],
  ["月光骑士颂", "Moonlight Lullaby", "月光騎士の讃歌"],
  ["静听嘉音", "Astral Voice", "静寂のアストラ"],
  ["雪兔梦游仙境", "Snow Rabbit Wonderland", "雪兎ワンダーランド"],
  ["原始朋克", "Proto Punk", "プロト・パンク"],
  ["摇摆爵士", "Swing Jazz", "スイング・ジャズ"],
  ["震星迪斯科", "Shockstar Disco", "ショックスター・ディスコ"],
  ["灵魂摇滚", "Soul Rock", "ソウル・ロック"],
  ["2+2+2散搭", "2+2+2 Rainbow", "2+2+2 キメラ"],
  ["山大王", "King of the Summit", "山の王"],

  // 62 Agents (Longest strings first to avoid partial collisions like 星徽·比利 vs 比利, 零号·安比 vs 安比)
  ["奥菲丝&「鬼火」", "Orphie & Magus", "オルフィス＆「鬼火」"],
  ["零号·安比", "Soldier 0 - Anby", "0号・アンビー"],
  ["星徽·比利", "Starlight Billy", "スターライト・ビリー"],
  ["「11号」", "Soldier 11", "「11号」"],
  ["「扳机」", "Trigger", "「トリガー」"],
  ["「席德」", "Seed", "「シード」"],
  ["伊德海莉", "Yidhari", "イドハイリ"],
  ["普罗米娅", "Promia", "プロミア"],
  ["蕾米埃尔", "Remiel", "レミエル"],
  ["赛维里安", "Severian", "セヴェリアン"],
  ["希格莉德", "Sigrid", "シグリッド"],
  ["佩洛伊斯", "Pelois", "ペロイス"],
  ["叶瞬光", "Ye Shunguang", "葉瞬光"],
  ["耀嘉音", "Astra Yao", "アストラ・ヤオ"],
  ["伊芙琳", "Evelyn", "イヴリン"],
  ["薇薇安", "Vivian", "ビビアン"],
  ["爱丽丝", "Alice", "アリス"],
  ["柏妮思", "Burnice", "バーニス"],
  ["格莉丝", "Grace", "グレース"],
  ["珂蕾妲", "Koleda", "クレタ"],
  ["莱卡恩", "Lycaon", "ライカン"],
  ["橘福福", "Ju Fufu", "橘福福"],
  ["潘引壶", "Pan Yinhu", "潘引壺"],
  ["南宫羽", "Nangong Yu", "南宮羽"],
  ["卢西娅", "Lucia", "ルシア"],
  ["希希芙", "Sissif", "シシフ"],
  ["维琳娜", "Verina", "ヴェリーナ"],
  ["菲欧妮", "Fione", "フィオネ"],
  ["克拉蕾", "Claret", "クラレット"],
  ["洛克茜", "Roxy", "ロキシー"],
  ["波可娜", "Pulchra", "プルクラ"],
  ["猫又", "Nekomata", "猫又"],
  ["艾莲", "Ellen", "エレン"],
  ["悠真", "Harumasa", "悠真"],
  ["朱鸢", "Zhu Yuan", "朱鳶"],
  ["雨果", "Hugo", "ヒューゴ"],
  ["可琳", "Corin", "カリン"],
  ["比利", "Billy", "ビリー"],
  ["安东", "Anton", "アンドー"],
  ["派派", "Piper", "パイパー"],
  ["仪玄", "Yixuan", "儀玄"],
  ["般岳", "Banyue", "般岳"],
  ["真斗", "Manato", "真斗"],
  ["莱特", "Lighter", "ライト"],
  ["青衣", "Qingyi", "青衣"],
  ["琉音", "Dialyn", "ダイアリン"],
  ["诺姆", "Norm", "ノーム"],
  ["安比", "Anby", "アンビー"],
  ["丽娜", "Rina", "リナ"],
  ["柚叶", "Yuzuha", "柚葉"],
  ["千夏", "Chinatsu", "千夏"],
  ["妮可", "Nicole", "ニコ"],
  ["苍角", "Soukaku", "蒼角"],
  ["露西", "Lucy", "ルーシー"],
  ["凯撒", "Caesar", "シーザー"],
  ["赛斯", "Seth", "セス"],
  ["爱芮", "Airi", "愛芮"],
  ["雅", "Miyabi", "雅"],
  ["柳", "Yanagi", "柳"],
  ["简", "Jane", "ジェーン"],
  ["照", "Zhao", "照"],
  ["本", "Ben", "ベン"],

  // 20 Bangboos
  ["格列佛探员", "Agent Gulliver", "ガリバー隊員"],
  ["艾米莉安", "Amillion", "アミリオン"],
  ["阿崔巡查", "Officer Cui", "ツェイ巡査"],
  ["咔嚓仔", "Snap", "カチャコ"],
  ["巴特勒", "Butler", "バトラー"],
  ["共鸣布", "Resonaboo", "レゾナンボンプ"],
  ["鲨牙布", "Sharkboo", "ガブットボンプ"],
  ["插头布", "Plugboo", "プラグボンプ"],
  ["飚速布", "Rocketboo", "ロケットボンプ"],
  ["左轮布", "Revolverboo", "リボルバーボンプ"],
  ["疾风布", "Zephyrboo", "ゼファーボンプ"],
  ["棱镜布", "Prismboo", "プリズムボンプ"],
  ["骑士布", "Knightboo", "ナイトボンプ"],
  ["扑击布", "Sumoboo", "ズモウボンプ"],
  ["果核布", "Avocaboo", "アボカボンプ"],
  ["墨丘利", "Mercury", "マーキュリー"],
  ["罗宾", "Robin", "ロビン"],
  ["狮耶", "Belion", "シシヤ"],
  ["赤赤", "Red Moccus", "モックス"],

  // Action Sequencer Move Labels & Combat Terms
  ["手动取消重击点连携", "Manual Cancel Chain", "手動重撃キャンセル連携"],
  ["完美格挡反击", "Defensive Assist Parry", "パリィ支援突撃"],
  ["闪A振刀双反", "Dodge-Counter Double Parry", "回避反撃ダブルパリィ"],
  ["落霜六段拔刀", "Shimotsuki Lv.3 Slash", "霜月六段抜刀"],
  ["聚宝黑洞", "Ether Energy Field", "エネルギー場"],
  ["强化特殊技", "EX Special", "強化特殊スキル"],
  ["快速支援", "Quick Assist", "クイック支援"],
  ["凯旋归来", "Encore Chain", "アンコール連携"],
  ["连携技", "Chain Attack", "連携スキル"],
  ["终结技", "Ultimate", "終結スキル"],
  ["强化E", "EX Special", "強化特殊"],
  ["闪反/振刀", "Dodge / Parry", "回避反撃/パリィ"],
  ["普攻/蓄力", "Basic / Charge", "通常/チャージ"],

  // Stats, Elements & Specialties
  ["暴击伤害", "CRIT DMG", "会心ダメージ"],
  ["暴击率", "CRIT Rate", "会心率"],
  ["异常精通", "Anomaly Prof.", "異常マスタリー"],
  ["异常掌控", "Anomaly Mastery", "異常掌握"],
  ["能量回复%", "Energy Regen%", "エネルギー自動回復%"],
  ["属性伤害%", "Elemental DMG%", "属性ダメージ%"],
  ["穿透率", "PEN Ratio", "貫通率"],
  ["穿透值", "FLAT PEN", "貫通値"],
  ["冲击力%", "Impact%", "衝撃力%"],
  ["大攻击%", "ATK%", "攻撃力%"],
  ["大生命%", "HP%", "HP%"],
  ["大防御%", "DEF%", "防御力%"],
  ["固定攻击", "Flat ATK", "固定攻撃"],
  ["固定生命", "Flat HP", "固定HP"],
  ["固定防御", "Flat DEF", "固定防御"],
  ["直伤双暴", "Direct CRIT", "直撃会心"],
  ["属性异常", "Anomaly DMG", "属性異常"],
  ["紊乱结算", "Disorder DMG", "混沌ダメージ"],
  ["命破贯穿", "Sheer DMG", "命破貫通"],
  ["锋御撕裂", "Armorer Lacerate", "鋒御裂傷"],
  ["异放协同", "Abloom DMG", "異放追撃"],
  ["流明耀化", "Lumiflux DMG", "流明耀化"],
  ["风化涡流", "Wind Vortex", "風化渦流"],
  ["以太", "Ether", "エーテル"],
  ["物理", "Physical", "物理"],
  ["流明", "Lumiflux", "流明"],
  ["强攻", "Attack", "強攻"],
  ["异常", "Anomaly", "異常"],
  ["命破", "Rupture", "命破"],
  ["锋御", "Armorer", "鋒御"],
  ["击破", "Stun", "撃破"],
  ["支援", "Support", "支援"],
  ["防护", "Defense", "防護"],

  // High-frequency Workbench UI tokens
  ["真实DPS", "True DPS", "実質DPS"],
  ["单轮DPR", "Cycle DPR", "1ローテDPR"],
  ["危局3分钟", "3m Deadly Assault", "危局3分間総傷"],
  ["总动作块", "Blocks", "総ブロック"],
  ["顺序总耗时", "Sequential", "順列合計"],
  ["合轴压缩后实轴", "Compressed Cycle", "合軸圧縮後"],
  ["并行省帧", "Saved Overlap", "並列短縮"],
  ["安全合轴", "Safe Swaps", "安全合軸"],
  ["裸露合轴", "Exposed Swaps", "無防備合軸"],
  ["破韧期", "Daze Phase", "ブレイク前"],
  ["失衡期", "Stun Phase", "ブレイク中"],
  ["实轴", "Cycle", "実ローテ"],
  ["轴长", "Cycle", "周期"],
  ["练度柜角色", "Vault Agents", "保管キャラ"],
  ["驱动盘池", "Disc Pool", "ディスクプール"],
  ["自动毕业", "Auto BiS", "自動最適"],
  ["逐盘精调", "6-Disc Edit", "個別ディスク"],
  ["面板直填", "Direct Stats", "ステ直入力"],
  ["音擎", "W-Engine", "音動機"],
  ["影画", "Mindscape", "心象映画"],
  ["驱动盘", "Drive Disc", "ディスク"],
  ["邦布", "Bangboo", "ボンプ"],
  ["攻击力%", "ATK%", "攻撃力%"],
  ["生命值%", "HP%", "HP%"],
  ["防御力%", "DEF%", "防御力%"],
  ["小攻击", "Flat ATK", "実数攻撃"],
  ["小生命", "Flat HP", "実数HP"],
  ["小防御", "Flat DEF", "実数防御"],
  ["属伤加成%", "ELEM DMG%", "属性ダメ%"],
  ["局外生命", "Sheet HP", "ステータスHP"],
  ["局外攻击", "Sheet ATK", "ステータス攻撃"],
  ["局外防御", "Sheet DEF", "ステータス防御"],
  ["属伤%", "ELEM%", "属性%"],
  ["攻击%", "ATK%", "攻撃%"],
  ["生命%", "HP%", "HP%"],
  ["防御%", "DEF%", "防御%"],
  ["穿透%", "PEN%", "貫通%"],
  ["掌控%", "AM%", "掌握%"],
  ["回能%", "ER%", "回復%"],
  ["暴击%", "CR%", "会心%"],
  ["暴伤%", "CD%", "会心ダメ%"],
  ["暴击", "CRIT", "会心率"],
  ["暴伤", "CDMG", "会心ダメ"],
  ["精通", "AP", "精通"],
  ["穿透", "PEN", "貫通"],
  ["冲击", "IMP", "衝撃力"],
  ["回能", "ER", "回復"],
  ["生命", "HP", "HP"],
  ["攻击", "ATK", "攻撃"],
  ["防御", "DEF", "防御"],
  ["火", "Fire", "炎"],
  ["冰", "Ice", "氷"],
  ["电", "Electric", "電気"],
  ["风", "Wind", "風"]
];

const SORTED_TOKENS = [...RAW_TOKENS].sort((a, b) => b[0].length - a[0].length);

// Short Drive Set codes when followed by 4 / 2 (e.g. "静听4 + 折枝2")
const SHORT_SET_MAP: Record<string, LangPair> = {
  啄木: { en: "Woodpecker ", ja: "ウッドペッカー" },
  河豚: { en: "Puffer ", ja: "パファー" },
  激素: { en: "Hormone ", ja: "ホルモン" },
  沧浪: { en: "WhiteWater ", ja: "滄浪" },
  折枝: { en: "Branch ", ja: "折枝" },
  如影: { en: "Shadow ", ja: "シャドウ" },
  拂晓: { en: "Dawn ", ja: "暁" },
  云岿: { en: "Yunkui ", ja: "雲巋" },
  荆棘: { en: "Thorn ", ja: "荊棘" },
  炎狱: { en: "Inferno ", ja: "インフェルノ" },
  雷暴: { en: "Thunder ", ja: "サンダー" },
  极地: { en: "Polar ", ja: "ポーラー" },
  獠牙: { en: "Fanged ", ja: "ファング" },
  混沌重: { en: "ChaosMetal ", ja: "カオスメタル" },
  谶羽: { en: "Feather ", ja: "預言羽" },
  呼啸: { en: "Salon ", ja: "サロン" },
  囚徒: { en: "Prisoner ", ja: "囚人" },
  流光: { en: "Aria ", ja: "流光" },
  法厄同: { en: "Phaethon ", ja: "パエトーン" },
  混沌爵士: { en: "ChaosJazz ", ja: "カオスジャズ" },
  自由: { en: "Freedom ", ja: "フリーダム" },
  月光: { en: "Moonlight ", ja: "月光" },
  山大王: { en: "Summit ", ja: "山の王" },
  静听: { en: "Astral ", ja: "アストラ" },
  雪兔: { en: "SnowRabbit ", ja: "雪兎" },
  原始: { en: "Proto ", ja: "プロト" },
  摇摆: { en: "Swing ", ja: "スイング" },
  震星: { en: "Shockstar ", ja: "ショックスター" },
  灵魂: { en: "SoulRock ", ja: "ソウル" }
};

let currentLang: LangCode = "zh";

export function getLang(): LangCode {
  return currentLang;
}

export function setLang(lang: LangCode): void {
  currentLang = lang;
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang === "en" ? "en" : lang === "ja" ? "ja" : "zh-CN";
  }
}

export function translateText(raw: string, lang: LangCode = currentLang): string {
  if (lang === "zh" || !raw) return raw;
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  // Fast skip if purely ASCII numbers/punctuation/symbols
  if (!/[\u4e00-\u9fff]/.test(trimmed)) return raw;

  const exact = EXACT_PHRASES[trimmed];
  if (exact) {
    const out = lang === "en" ? exact.en : exact.ja;
    return raw.replace(trimmed, out);
  }

  let s = raw;

  // Pattern: TS精算: 1.2 ms
  s = s.replace(/TS精算:\s*([\d.]+)\s*ms/g, (_m, t) =>
    lang === "en" ? `TS Sim: ${t} ms` : `TS演算: ${t} ms`
  );

  // Pattern: 展开全部配队与选人 (24队 / 62人) ▼
  s = s.replace(/展开全部配队与选人\s*\((\d+)队\s*\/\s*(\d+)人\)\s*▼/g, (_m, pCount, cCount) =>
    lang === "en"
      ? `Expand Presets & Roster (${pCount} Teams / ${cCount} Agents) ▼`
      : `全プリセット・キャラ展開 (${pCount}編成 / ${cCount}名) ▼`
  );

  // Pattern: Telemetry & badges
  s = s.replace(/(\d+)\s*限定金/g, (_m, g) =>
    lang === "en" ? `${g} Lim. Gold` : `限定${g}金`
  );
  s = s.replace(/额外能力\s*(\d+)\/(\d+)\s*激活/g, (_m, a, b) =>
    lang === "en" ? `Core Passive ${a}/${b} ON` : `追加能力 ${a}/${b} 発動`
  );
  s = s.replace(/额外能力\s*(\d+)\/(\d+)\s*未满/g, (_m, a, b) =>
    lang === "en" ? `Core Passive ${a}/${b} Warn` : `追加能力 ${a}/${b} 未満`
  );
  s = s.replace(/较单人放大\s*([\d.]+)×/g, (_m, p) =>
    lang === "en" ? `Team Mult ${p}×` : `ソロ比 ${p}×`
  );
  s = s.replace(/省帧\s*-([\d.]+)s/g, (_m, t) =>
    lang === "en" ? `Saved -${t}s` : `短縮 -${t}s`
  );
  s = s.replace(/约\s*([\d.]+)\s*轮循环/g, (_m, n) =>
    lang === "en" ? `~${n} Rotations` : `約 ${n} ローテ`
  );
  s = s.replace(/计入直伤\s*\(\+([^)]+)\)/g, (_m, dmg) =>
    lang === "en" ? `Include DMG (+${dmg})` : `直撃加算 (+${dmg})`
  );
  s = s.replace(/盘池寻优\((\d+)\)/g, (_m, cnt) =>
    lang === "en" ? `Pool Opt (${cnt})` : `プール最適(${cnt})`
  );
  s = s.replace(/影画\s*M0\s*\(本体\)/g, () =>
    lang === "en" ? `M0 (Base)` : `M0 (無凸)`
  );
  s = s.replace(/影画\s*M([1-6])/g, (_m, m) =>
    lang === "en" ? `Mindscape M${m}` : `心象映画 M${m}`
  );
  s = s.replace(/R([1-5])星/g, (_m, r) =>
    lang === "en" ? `W${r}` : `R${r}`
  );

  // Pattern: (+ 记录至方案 A) / 方案A: / 当前 +4.5%
  s = s.replace(/\[\+\s*记录至方案\s*([A-D])\]/g, (_m, lb) =>
    lang === "en" ? `[+ Save Slot ${lb}]` : `[+ 案${lb}に保存]`
  );
  s = s.replace(/方案([A-D]):/g, (_m, lb) =>
    lang === "en" ? `Snap ${lb}:` : `案${lb}:`
  );
  s = s.replace(/当前高?\s*\+([\d.]+)%/g, (_m, p) =>
    lang === "en" ? `+${p}% vs Snap` : `現在 +${p}%`
  );
  s = s.replace(/当前低?\s*(-[\d.]+)%/g, (_m, p) =>
    lang === "en" ? `${p}% vs Snap` : `現在 ${p}%`
  );

  // Pattern: Short Drive Set + 4/2 (e.g. 静听4, 折枝2)
  s = s.replace(
    /(啄木|河豚|激素|沧浪|折枝|如影|拂晓|云岿|荆棘|炎狱|雷暴|极地|獠牙|混沌重|谶羽|呼啸|囚徒|流光|法厄同|混沌爵士|自由|月光|山大王|静听|雪兔|原始|摇摆|震星|灵魂)([24])/g,
    (_m, key, num) => {
      const pair = SHORT_SET_MAP[key];
      if (!pair) return `${key}${num}`;
      return lang === "en" ? `${pair.en}${num}pc` : `${pair.ja}${num}セット`;
    }
  );

  // Pattern: 1号位 / 1号 ·
  s = s.replace(/([1-4])号位/g, (_m, n) => (lang === "en" ? `Slot ${n}` : `${n}番枠`));
  s = s.replace(/([1-4])号\s*·/g, (_m, n) => (lang === "en" ? `#${n} ·` : `${n}番 ·`));

  // Pattern: 有效 31.5 词 / 31.0词 / 词条
  s = s.replace(/有效\s*([\d.]+)\s*词/g, (_m, n) =>
    lang === "en" ? `${n} Eff. Rolls` : `有効 ${n} スコア`
  );
  s = s.replace(/([\d.]+)词(?![条])/g, (_m, n) =>
    lang === "en" ? `${n}r` : `${n}点`
  );
  s = s.replace(/基础(\d+)/g, (_m, n) =>
    lang === "en" ? `Base ${n}` : `基礎${n}`
  );
  s = s.replace(/六维乘区雷达透视\s*&\s*队友转模达标表/g, () =>
    lang === "en" ? "6-Axis Multiplier Radar & Stat Thresholds" : "6軸乗算区レーダー＆変換閾値チェック"
  );
  s = s.replace(/词条/g, () => (lang === "en" ? "rolls" : "スコア"));

  // Pattern: 13.9万 -> 139.0k / 1.39M in English (keep 万 in Japanese!)
  if (lang === "en") {
    s = s.replace(/(-?\d+(?:\.\d+)?)万/g, (_m, numStr) => {
      const val = parseFloat(numStr) * 10000;
      if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
      return `${(val / 1_000).toFixed(1)}k`;
    });
  }

  // Apply longest-first token replacements
  for (let i = 0; i < SORTED_TOKENS.length; i++) {
    const [zh, en, ja] = SORTED_TOKENS[i];
    if (s.includes(zh)) {
      s = s.split(zh).join(lang === "en" ? en : ja);
    }
  }

  // Remaining micro units
  if (lang === "en") {
    s = s
      .replace(/(\d+)\s*名角色/g, "$1 Agents")
      .replace(/(\d+)\s*张/g, "$1 pcs")
      .replace(/(\d+)\s*次/g, "$1x")
      .replace(/\(已改(\d+)项\)/g, "($1 edited)")
      .replace(/散搭/g, "Mixed")
      .replace(/散件/g, "Rainbow")
      .replace(/当前/g, "Current ");
  } else {
    s = s
      .replace(/(\d+)\s*名角色/g, "$1名")
      .replace(/(\d+)\s*张/g, "$1枚")
      .replace(/(\d+)\s*次/g, "$1回")
      .replace(/\(已改(\d+)项\)/g, "($1件変更)")
      .replace(/散搭/g, "キメラ")
      .replace(/散件/g, "自由枠")
      .replace(/当前/g, "現在");
  }

  return s;
}

interface CachedNodeRecord {
  orig: string;
  lastOut: string;
}

const TEXT_NODE_CACHE = new WeakMap<Node, CachedNodeRecord>();
const ATTR_NODE_CACHE = new WeakMap<Element, Record<string, CachedNodeRecord>>();
const TRANSLATABLE_ATTRS = ["title", "placeholder", "aria-label"] as const;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA"]);

export function localizeDOM(root: ParentNode = document.body, lang: LangCode = currentLang): void {
  if (typeof document === "undefined" || !root) return;
  setLang(lang);

  // Localize document title
  const docTitle = "绝区零 v3.3 战术配队 · 合轴排轴 · UID 展柜精算台";
  document.title = lang === "zh" ? docTitle : translateText(docTitle, lang);

  // Walk text nodes
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    if (parent && !SKIP_TAGS.has(parent.tagName) && !parent.hasAttribute("data-no-i18n")) {
      const val = node.nodeValue || "";
      const rec = TEXT_NODE_CACHE.get(node);
      let zhSource: string;
      if (!rec || val !== rec.lastOut) {
        zhSource = val;
      } else {
        zhSource = rec.orig;
      }
      if (zhSource.trim()) {
        const nextOut = lang === "zh" ? zhSource : translateText(zhSource, lang);
        TEXT_NODE_CACHE.set(node, { orig: zhSource, lastOut: nextOut });
        if (val !== nextOut) {
          node.nodeValue = nextOut;
        }
      }
    }
    node = walker.nextNode();
  }

  // Walk translatable attributes
  if ("querySelectorAll" in root) {
    const elems = root.querySelectorAll("[title],[placeholder],[aria-label]");
    elems.forEach((el) => {
      if (el.hasAttribute("data-no-i18n")) return;
      let attrMap = ATTR_NODE_CACHE.get(el);
      if (!attrMap) {
        attrMap = {};
        ATTR_NODE_CACHE.set(el, attrMap);
      }
      for (const attr of TRANSLATABLE_ATTRS) {
        const cur = el.getAttribute(attr);
        if (!cur) continue;
        const rec = attrMap[attr];
        const zhSource = !rec || cur !== rec.lastOut ? cur : rec.orig;
        const nextOut = lang === "zh" ? zhSource : translateText(zhSource, lang);
        attrMap[attr] = { orig: zhSource, lastOut: nextOut };
        if (cur !== nextOut) {
          el.setAttribute(attr, nextOut);
        }
      }
    });
  }
}
