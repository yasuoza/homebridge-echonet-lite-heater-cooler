type ELEDT = { [key: string]: boolean | number } | null;

export type ELProp = {
  epc: number;
  edt: ELEDT;
  buffer?: Buffer;
};
