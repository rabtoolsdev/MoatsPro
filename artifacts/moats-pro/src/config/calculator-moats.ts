export interface CalculatorMoatConfig {
  id: string;
  name: string;
  symbol: string;
  contractAddress: string;
  tokenAddress: string;
  description?: string;
}

export const CALCULATOR_MOATS: CalculatorMoatConfig[] = [
  { id: "hefe", name: "Hefe Moat", symbol: "HEFE", contractAddress: "0xcf65744c955a292d11de2a4184e9fabedbfc7b40", tokenAddress: "0x18E3605B13F10016901eAC609b9E188CF7c18973" },
  { id: "bensi", name: "Bensi Box Moat", symbol: "BENSI", contractAddress: "0x3399d03566bb6db0cb4f1e13047589a1499cebbc", tokenAddress: "0x00697F5F6dc2CA0A17e6c89bCcd1173A61eA24a6" },
  { id: "freak", name: "FREAK Anon Moat", symbol: "FREAK", contractAddress: "0x020c73b55d139d5e259bad89b126f2a446c22ac6", tokenAddress: "0x201d04f88Bc9B3bdAcdf0519a95E117f25062D38" },
  { id: "dish", name: "Dimish Moat", symbol: "DISH", contractAddress: "0x93d8cc111233f8c5b9a019df7c159b6f9be7b44b", tokenAddress: "0x40146E96EE5297187022D1ca62A3169B5e45B0a4" },
  { id: "supercycle", name: "supercycle real Moat", symbol: "SUPERCYCLE", contractAddress: "0x464b2817f16f6117602ad05bae446c2fc5ba6fb7", tokenAddress: "0xCA2e0f72653337d05B1ABceBEA5718A4A3E57a0b" },
  { id: "lil", name: "LIL Moat", symbol: "LIL", contractAddress: "0x7a4d20261a765bd9ba67d49fbf8189843eec3393", tokenAddress: "0x22683BbaDD01473969F23709879187705a253763" },
  { id: "discloser", name: "Discloser Moat", symbol: "DISCLOSER", contractAddress: "0xb3fcc83669d96934dee361e897f9ec33c911deaf", tokenAddress: "0x36D982E00B2dce5435Ef65e4266896B261fA3393" },
];
