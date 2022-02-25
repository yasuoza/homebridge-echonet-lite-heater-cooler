/// <reference types="node" />
declare type ELEDT = {
    [key: string]: boolean | number;
} | null;
export declare type ELProp = {
    epc: number;
    edt: ELEDT;
    buffer?: Buffer;
};
export {};
//# sourceMappingURL=types.d.ts.map