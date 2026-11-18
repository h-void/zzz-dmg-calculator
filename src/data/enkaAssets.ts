import { escHtml } from "../engine/constants";

export const ENKA_CDN = "https://enka.network";

export interface AgentVisualAsset {
  /** Full half-body / splash portrait path on Enka CDN */
  s: string;
  /** Circular avatar icon path on Enka CDN */
  c: string;
  /** Curated accent hex (zero purple on dark theme) */
  a: string;
}

/**
 * 100% v3.3 Agent Visual Registry (62/62 matched with Enka.Network ZZZ store)
 */
export const AGENT_ASSETS: Record<string, AgentVisualAsset> = {
  "1011": { s: "/ui/zzz/IconRole01.png", c: "/ui/zzz/IconRoleCircle01.png", a: "#aece32" },
  "1021": { s: "/ui/zzz/IconRole11.png", c: "/ui/zzz/IconRoleCircle11.png", a: "#ca4b3d" },
  "1031": { s: "/ui/zzz/IconRole12.png", c: "/ui/zzz/IconRoleCircle12.png", a: "#e06b8b" },
  "1041": { s: "/ui/zzz/IconRole05.png", c: "/ui/zzz/IconRoleCircle05.png", a: "#ffc300" },
  "1051": { s: "/ui/zzz/IconRole52.png", c: "/ui/zzz/IconRoleCircle52.png", a: "#ab373e" },
  "1061": { s: "/ui/zzz/IconRole09.png", c: "/ui/zzz/IconRoleCircle09.png", a: "#b2b2b2" },
  "1071": { s: "/ui/zzz/IconRole25.png", c: "/ui/zzz/IconRoleCircle25.png", a: "#ffdd4f" },
  "1081": { s: "/ui/zzz/IconRole10.png", c: "/ui/zzz/IconRoleCircle10.png", a: "#c94b3d" },
  "1091": { s: "/ui/zzz/IconRole13.png", c: "/ui/zzz/IconRoleCircle13.png", a: "#22bdcc" },
  "1101": { s: "/ui/zzz/IconRole14.png", c: "/ui/zzz/IconRoleCircle14.png", a: "#d4d4d4" },
  "1111": { s: "/ui/zzz/IconRole15.png", c: "/ui/zzz/IconRoleCircle15.png", a: "#d4d4d4" },
  "1121": { s: "/ui/zzz/IconRole16.png", c: "/ui/zzz/IconRoleCircle16.png", a: "#d4d4d4" },
  "1131": { s: "/ui/zzz/IconRole17.png", c: "/ui/zzz/IconRoleCircle17.png", a: "#22bdcc" },
  "1141": { s: "/ui/zzz/IconRole18.png", c: "/ui/zzz/IconRoleCircle18.png", a: "#b2b2b2" },
  "1151": { s: "/ui/zzz/IconRole27.png", c: "/ui/zzz/IconRoleCircle27.png", a: "#ffdd4f" },
  "1161": { s: "/ui/zzz/IconRole26.png", c: "/ui/zzz/IconRoleCircle26.png", a: "#ffdd4f" },
  "1171": { s: "/ui/zzz/IconRole32.png", c: "/ui/zzz/IconRoleCircle32.png", a: "#ffdd4f" },
  "1181": { s: "/ui/zzz/IconRole20.png", c: "/ui/zzz/IconRoleCircle20.png", a: "#d4d4d4" },
  "1191": { s: "/ui/zzz/IconRole21.png", c: "/ui/zzz/IconRoleCircle21.png", a: "#b2b2b2" },
  "1201": { s: "/ui/zzz/IconRole35.png", c: "/ui/zzz/IconRoleCircle35.png", a: "#22bdcc" },
  "1211": { s: "/ui/zzz/IconRole22.png", c: "/ui/zzz/IconRoleCircle22.png", a: "#b2b2b2" },
  "1221": { s: "/ui/zzz/IconRole31.png", c: "/ui/zzz/IconRoleCircle31.png", a: "#22bdcc" },
  "1241": { s: "/ui/zzz/IconRole23.png", c: "/ui/zzz/IconRoleCircle23.png", a: "#3a89d9" },
  "1251": { s: "/ui/zzz/IconRole29.png", c: "/ui/zzz/IconRoleCircle29.png", a: "#3a89d9" },
  "1261": { s: "/ui/zzz/IconRole24.png", c: "/ui/zzz/IconRoleCircle24.png", a: "#91daed" },
  "1271": { s: "/ui/zzz/IconRole30.png", c: "/ui/zzz/IconRoleCircle30.png", a: "#3a89d9" },
  "1281": { s: "/ui/zzz/IconRole28.png", c: "/ui/zzz/IconRoleCircle28.png", a: "#ffdd4f" },
  "1291": { s: "/ui/zzz/IconRole42.png", c: "/ui/zzz/IconRoleCircle42.png", a: "#cc6677" },
  "1301": { s: "/ui/zzz/IconRole49.png", c: "/ui/zzz/IconRoleCircle49.png", a: "#db602a" },
  "1311": { s: "/ui/zzz/IconRole36.png", c: "/ui/zzz/IconRoleCircle36.png", a: "#dbb368" },
  "1321": { s: "/ui/zzz/IconRole37.png", c: "/ui/zzz/IconRoleCircle37.png", a: "#e69055" },
  "1331": { s: "/ui/zzz/IconRole41.png", c: "/ui/zzz/IconRoleCircle41.png", a: "#cc6677" },
  "1341": { s: "/ui/zzz/IconRole56.png", c: "/ui/zzz/IconRoleCircle56.png", a: "#56c3c1" },
  "1351": { s: "/ui/zzz/IconRole38.png", c: "/ui/zzz/IconRoleCircle38.png", a: "#ff8916" },
  "1361": { s: "/ui/zzz/IconRole39.png", c: "/ui/zzz/IconRoleCircle39.png", a: "#ffc300" },
  "1371": { s: "/ui/zzz/IconRole44.png", c: "/ui/zzz/IconRoleCircle44.png", a: "#f1cc4d" },
  "1381": { s: "/ui/zzz/IconRole40.png", c: "/ui/zzz/IconRoleCircle40.png", a: "#ffbc2e" },
  "1391": { s: "/ui/zzz/IconRole43.png", c: "/ui/zzz/IconRoleCircle43.png", a: "#ffbf16" },
  "1401": { s: "/ui/zzz/IconRole46.png", c: "/ui/zzz/IconRoleCircle46.png", a: "#d54553" },
  "1411": { s: "/ui/zzz/IconRole47.png", c: "/ui/zzz/IconRoleCircle47.png", a: "#d54553" },
  "1421": { s: "/ui/zzz/IconRole45.png", c: "/ui/zzz/IconRoleCircle45.png", a: "#ffbf16" },
  "1431": { s: "/ui/zzz/IconRole55.png", c: "/ui/zzz/IconRoleCircle55.png", a: "#f5b42e" },
  "1441": { s: "/ui/zzz/IconRole51.png", c: "/ui/zzz/IconRoleCircle51.png", a: "#ab373e" },
  "1451": { s: "/ui/zzz/IconRole50.png", c: "/ui/zzz/IconRoleCircle50.png", a: "#4bbbc0" },
  "1461": { s: "/ui/zzz/IconRole48.png", c: "/ui/zzz/IconRoleCircle48.png", a: "#6fa6cc" },
  "1471": { s: "/ui/zzz/IconRole53.png", c: "/ui/zzz/IconRoleCircle53.png", a: "#d66556" },
  "1481": { s: "/ui/zzz/IconRole54.png", c: "/ui/zzz/IconRoleCircle54.png", a: "#d6a24a" },
  "1491": { s: "/ui/zzz/IconRole58.png", c: "/ui/zzz/IconRoleCircle58.png", a: "#57ddca" },
  "1501": { s: "/ui/zzz/IconRole57.png", c: "/ui/zzz/IconRoleCircle57.png", a: "#65dcc9" },
  "1511": { s: "/ui/zzz/IconRole59.png", c: "/ui/zzz/IconRoleCircle59.png", a: "#57ddca" },
  "1521": { s: "/ui/zzz/IconRole60.png", c: "/ui/zzz/IconRoleCircle60.png", a: "#da5b74" },
  "1531": { s: "/ui/zzz/IconRole62.png", c: "/ui/zzz/IconRoleCircle62.png", a: "#c94b3d" },
  "1541": { s: "/ui/zzz/IconRole61.png", c: "/ui/zzz/IconRoleCircle61.png", a: "#78b4d6" },
  "1551": { s: "/ui/zzz/IconRole63.png", c: "/ui/zzz/IconRoleCircle63.png", a: "#d6a24a" },
  "1561": { s: "/ui/zzz/IconRole64.png", c: "/ui/zzz/IconRoleCircle64.png", a: "#58b08c" },
  "1571": { s: "/ui/zzz/IconRole65.png", c: "/ui/zzz/IconRoleCircle65.png", a: "#d66556" },
  "1581": { s: "/ui/zzz/IconRole67.png", c: "/ui/zzz/IconRoleCircle67.png", a: "#e0c167" },
  "1591": { s: "/ui/zzz/IconRole66.png", c: "/ui/zzz/IconRoleCircle66.png", a: "#78b4d6" },
  "1611": { s: "/ui/zzz/IconRole1611.png", c: "/ui/zzz/IconRoleCircle1611.png", a: "#5789c7" },
  "1621": { s: "/ui/zzz/IconRole68.png", c: "/ui/zzz/IconRoleCircle68.png", a: "#58b08c" },
  "1631": { s: "/ui/zzz/IconRole1631.png", c: "/ui/zzz/IconRoleCircle1631.png", a: "#58b08c" },
  "1641": { s: "/ui/zzz/IconRole1641.png", c: "/ui/zzz/IconRoleCircle1641.png", a: "#d66556" }
};

/**
 * 100% v3.3 W-Engine Icon Registry (103/103 matched with Enka.Network ZZZ store)
 */
export const WEAPON_ICONS: Record<string, string> = {
  "12001": "/ui/zzz/Weapon_B_Common_01.png",
  "12002": "/ui/zzz/Weapon_B_Common_02.png",
  "12003": "/ui/zzz/Weapon_B_Common_03.png",
  "12004": "/ui/zzz/Weapon_B_Common_04.png",
  "12005": "/ui/zzz/Weapon_B_Common_05.png",
  "12006": "/ui/zzz/Weapon_B_Common_06.png",
  "12007": "/ui/zzz/Weapon_B_Common_07.png",
  "12008": "/ui/zzz/Weapon_B_Common_08.png",
  "12009": "/ui/zzz/Weapon_B_Common_09.png",
  "12010": "/ui/zzz/Weapon_B_Common_10.png",
  "12011": "/ui/zzz/Weapon_B_Common_11.png",
  "12012": "/ui/zzz/Weapon_B_Common_12.png",
  "12013": "/ui/zzz/Weapon_B_Common_13.png",
  "12014": "/ui/zzz/Weapon_B_Common_14.png",
  "12015": "/ui/zzz/Weapon_B_Common_15.png",
  "12016": "/ui/zzz/Weapon_B_Common_16.png",
  "13001": "/ui/zzz/Weapon_A_Common_01.png",
  "13002": "/ui/zzz/Weapon_A_Common_02.png",
  "13003": "/ui/zzz/Weapon_A_Common_03.png",
  "13004": "/ui/zzz/Weapon_A_Common_04.png",
  "13005": "/ui/zzz/Weapon_A_Common_05.png",
  "13006": "/ui/zzz/Weapon_A_Common_06.png",
  "13007": "/ui/zzz/Weapon_A_Common_07.png",
  "13008": "/ui/zzz/Weapon_A_Common_08.png",
  "13009": "/ui/zzz/Weapon_A_Common_09.png",
  "13010": "/ui/zzz/Weapon_A_Common_10.png",
  "13011": "/ui/zzz/Weapon_A_Common_11.png",
  "13012": "/ui/zzz/Weapon_A_Common_12.png",
  "13013": "/ui/zzz/Weapon_A_Common_13.png",
  "13014": "/ui/zzz/Weapon_A_Common_14.png",
  "13015": "/ui/zzz/Weapon_A_Common_15.png",
  "13016": "/ui/zzz/Weapon_A_Common_16.png",
  "13017": "/ui/zzz/Weapon_A_Common_17.png",
  "13018": "/ui/zzz/Weapon_A_Common_18.png",
  "13019": "/ui/zzz/Weapon_A_Common_19.png",
  "13020": "/ui/zzz/Weapon_A_Common_20.png",
  "13021": "/ui/zzz/Weapon_A_Common_21.png",
  "13022": "/ui/zzz/Weapon_A_Common_22.png",
  "13101": "/ui/zzz/Weapon_A_1011.png",
  "13103": "/ui/zzz/Weapon_A_1031.png",
  "13106": "/ui/zzz/Weapon_A_1061.png",
  "13108": "/ui/zzz/Weapon_A_1081.png",
  "13111": "/ui/zzz/Weapon_A_1111.png",
  "13112": "/ui/zzz/Weapon_A_1121.png",
  "13113": "/ui/zzz/Weapon_A_1131.png",
  "13115": "/ui/zzz/Weapon_A_1151.png",
  "13127": "/ui/zzz/Weapon_A_1271.png",
  "13128": "/ui/zzz/Weapon_A_1281.png",
  "13135": "/ui/zzz/Weapon_A_1351.png",
  "13142": "/ui/zzz/Weapon_A_1421.png",
  "13144": "/ui/zzz/Weapon_A_1441.png",
  "14001": "/ui/zzz/Weapon_S_Common_01.png",
  "14002": "/ui/zzz/Weapon_S_Common_02.png",
  "14003": "/ui/zzz/Weapon_S_Common_03.png",
  "14102": "/ui/zzz/Weapon_S_1021.png",
  "14104": "/ui/zzz/Weapon_S_1041.png",
  "14105": "/ui/zzz/Weapon_S_1051.png",
  "14107": "/ui/zzz/Weapon_S_1071.png",
  "14109": "/ui/zzz/Weapon_S_1091.png",
  "14110": "/ui/zzz/Weapon_S_1101.png",
  "14114": "/ui/zzz/Weapon_S_1141.png",
  "14116": "/ui/zzz/Weapon_S_1161.png",
  "14117": "/ui/zzz/Weapon_S_1171.png",
  "14118": "/ui/zzz/Weapon_S_1181.png",
  "14119": "/ui/zzz/Weapon_S_1191.png",
  "14120": "/ui/zzz/Weapon_S_1201.png",
  "14121": "/ui/zzz/Weapon_S_1211.png",
  "14122": "/ui/zzz/Weapon_S_1221.png",
  "14124": "/ui/zzz/Weapon_S_1241.png",
  "14125": "/ui/zzz/Weapon_S_1251.png",
  "14126": "/ui/zzz/Weapon_S_1261.png",
  "14129": "/ui/zzz/Weapon_S_1291.png",
  "14130": "/ui/zzz/Weapon_S_1301.png",
  "14131": "/ui/zzz/Weapon_S_1311.png",
  "14132": "/ui/zzz/Weapon_S_1321.png",
  "14133": "/ui/zzz/Weapon_S_1331.png",
  "14134": "/ui/zzz/Weapon_S_1341.png",
  "14136": "/ui/zzz/Weapon_S_1361.png",
  "14137": "/ui/zzz/Weapon_S_1371.png",
  "14138": "/ui/zzz/Weapon_S_1381.png",
  "14139": "/ui/zzz/Weapon_S_1391.png",
  "14140": "/ui/zzz/Weapon_S_1401.png",
  "14141": "/ui/zzz/Weapon_S_1411.png",
  "14143": "/ui/zzz/Weapon_S_1431.png",
  "14145": "/ui/zzz/Weapon_S_1451.png",
  "14146": "/ui/zzz/Weapon_S_1461.png",
  "14147": "/ui/zzz/Weapon_S_1471.png",
  "14148": "/ui/zzz/Weapon_S_1481.png",
  "14149": "/ui/zzz/Weapon_S_1491.png",
  "14150": "/ui/zzz/Weapon_S_1501.png",
  "14151": "/ui/zzz/Weapon_S_1511.png",
  "14152": "/ui/zzz/Weapon_S_1521.png",
  "14153": "/ui/zzz/Weapon_S_1531.png",
  "14154": "/ui/zzz/Weapon_S_1541.png",
  "14155": "/ui/zzz/Weapon_S_Common_04.png",
  "14156": "/ui/zzz/Weapon_S_1561.png",
  "14157": "/ui/zzz/Weapon_S_1571.png",
  "14158": "/ui/zzz/Weapon_S_1581.png",
  "14159": "/ui/zzz/Weapon_S_1591.png",
  "14161": "/ui/zzz/Weapon_S_1611.png",
  "14162": "/ui/zzz/Weapon_S_1621.png",
  "14163": "/ui/zzz/Weapon_S_1631.png",
  "14164": "/ui/zzz/Weapon_S_1641.png"
};

/**
 * 100% v3.3 Drive Disc Suit Vinyl Artwork Registry (30/30 matched with Enka.Network ZZZ store)
 */
export const DISC_SET_ICONS: Record<string, string> = {
  "啄木": "/ui/zzz/SuitWoodpeckerElectro.png",
  "河豚": "/ui/zzz/SuitPufferElectro.png",
  "震星": "/ui/zzz/SuitShockstarDisco.png",
  "自由": "/ui/zzz/SuitFreedomBlues.png",
  "激素": "/ui/zzz/SuitHormonePunk.png",
  "灵魂": "/ui/zzz/SuitSoulRock.png",
  "摇摆": "/ui/zzz/SuitSwingJazz.png",
  "混沌爵士": "/ui/zzz/SuitChaosJazz.png",
  "原始": "/ui/zzz/SuitProtoPunk.png",
  "炎狱": "/ui/zzz/SuitInfernoMetal.png",
  "混沌重": "/ui/zzz/SuitChaosMetal.png",
  "雷暴": "/ui/zzz/SuitThunderMetal.png",
  "极地": "/ui/zzz/SuitPolarMetal.png",
  "獠牙": "/ui/zzz/SuitFangedMetal.png",
  "折枝": "/ui/zzz/SuitBranch&BladeSong.png",
  "静听": "/ui/zzz/SuitAstralVoice.png",
  "如影": "/ui/zzz/SuitShadow.png",
  "法厄同": "/ui/zzz/SuitSavior.png",
  "云岿": "/ui/zzz/SuitYunkuiTales.png",
  "山大王": "/ui/zzz/SuitKingoftheSummit.png",
  "拂晓": "/ui/zzz/SuitDawnsBloom.png",
  "月光": "/ui/zzz/SuitMoonlightLullaby.png",
  "沧浪": "/ui/zzz/SuitWhiteWaterBallad.png",
  "流光": "/ui/zzz/SuitShiningAria.png",
  "雪兔": "/ui/zzz/SuitBunnyinWonderland.png",
  "囚徒": "/ui/zzz/SuitNotesFromtheChained.png",
  "呼啸": "/ui/zzz/SuitWutheringSalon.png",
  "拂晓行纪": "/ui/zzz/SuitTheSkyAblaze.png",
  "谶羽": "/ui/zzz/SuitFeatheredFate.png",
  "荆棘": "/ui/zzz/SuitThornedRose.png"
};

export function getAgentSplashUrl(cid: string | undefined): string | null {
  if (!cid) return null;
  const rec = AGENT_ASSETS[cid];
  if (!rec) return null;
  // Convert /ui/zzz/IconRoleXX.png -> /ui/zzz/IconRoleSelectXX.png (official 256x250 slanted bust, 12x faster & face-centered)
  return `${ENKA_CDN}${rec.s.replace("/IconRole", "/IconRoleSelect")}`;
}

export function getAgentFullArtUrl(cid: string | undefined): string | null {
  if (!cid) return null;
  const rec = AGENT_ASSETS[cid];
  return rec ? `${ENKA_CDN}${rec.s}` : null;
}

export function getAgentCircleUrl(cid: string | undefined): string | null {
  if (!cid) return null;
  const rec = AGENT_ASSETS[cid];
  return rec ? `${ENKA_CDN}${rec.c}` : null;
}

export const ELEM_ACCENT_HEX: Record<string, string> = {
  Physical: "#f0c419",
  Fire: "#ff5a1f",
  Ice: "#6fdcf2",
  Electric: "#2f9dff",
  Ether: "#ff3d8b",
  Wind: "#3fe0a0",
  Lumiflux: "#ffe98a"
};

export function getAgentAccentHex(cid: string | undefined, fallback = "#dbb368"): string {
  if (!cid) return fallback;
  return AGENT_ASSETS[cid]?.a || fallback;
}

export function getElemAccentHex(
  eb: string | undefined,
  cid?: string,
  fallback = "#ffe01b"
): string {
  if (eb && ELEM_ACCENT_HEX[eb]) return ELEM_ACCENT_HEX[eb];
  return getAgentAccentHex(cid, fallback);
}

export function getWeaponIconUrl(wid: string | undefined): string | null {
  if (!wid) return null;
  const p = WEAPON_ICONS[wid];
  return p ? `${ENKA_CDN}${p}` : null;
}

export function getDiscSetIconUrl(setId: string | undefined): string | null {
  if (!setId || setId === "无") return null;
  const p = DISC_SET_ICONS[setId];
  return p ? `${ENKA_CDN}${p}` : null;
}

const IMG_ONERROR =
  "this.style.display='none';this.parentElement&&this.parentElement.classList.add('asset-fallback');";

/**
 * Renders a circular Agent avatar with graceful monogram fallback
 */
export function renderAgentAvatar(
  cid: string | undefined,
  name: string,
  eb = "Physical",
  sizeCls = "av-sm"
): string {
  const url = getAgentCircleUrl(cid);
  const initial = (name || "?").trim().slice(0, 1);
  return `<span class="agent-av ${sizeCls} elem-ring-${escHtml(eb)} ${url ? "" : "asset-fallback"}" data-no-i18n="1"><span class="av-fallback-txt">${escHtml(initial)}</span>${
    url
      ? `<img src="${escHtml(url)}" alt="${escHtml(name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="${IMG_ONERROR}">`
      : ""
  }</span>`;
}

/**
 * Renders a spherical W-Engine socket icon with rarity accent & fallback
 */
export function renderWeaponThumb(
  wid: string | undefined,
  name: string,
  rarity = "S",
  sizeCls = "wep-md"
): string {
  const url = getWeaponIconUrl(wid);
  return `<span class="wep-thumb ${sizeCls} wep-r-${escHtml(rarity)} ${url ? "" : "asset-fallback"}" data-no-i18n="1"><span class="wep-fallback-txt">${escHtml(rarity)}</span>${
    url
      ? `<img src="${escHtml(url)}" alt="${escHtml(name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="${IMG_ONERROR}">`
      : ""
  }</span>`;
}

/**
 * Renders a grooved Drive Disc Vinyl icon with spindle center & fallback
 */
export function renderDiscVinyl(
  setId: string | undefined,
  name: string,
  sizeCls = "disc-sm"
): string {
  const url = getDiscSetIconUrl(setId);
  const shortTxt = !setId || setId === "无" ? "—" : setId.slice(0, 1);
  return `<span class="disc-vinyl ${sizeCls} ${url ? "" : "asset-fallback"}" data-no-i18n="1"><span class="disc-fallback-txt">${escHtml(shortTxt)}</span>${
    url
      ? `<img src="${escHtml(url)}" alt="${escHtml(name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="${IMG_ONERROR}">`
      : ""
  }</span>`;
}
