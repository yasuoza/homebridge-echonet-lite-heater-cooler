/// <reference types="node" />
/// <reference types="node" />
type ELEDT = {
    [key: string]: boolean | number;
} | null;
export type ELProp = {
    epc: number;
    edt: ELEDT;
    buffer?: Buffer;
};
export {};
//# sourceMappingURL=types.d.ts.map