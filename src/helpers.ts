import { OnlyFields, IModel } from "./types.ts";
import { type Static as TStatic, TSchema } from 'npm:@sinclair/typebox';
export { Type } from 'npm:@sinclair/typebox'
export type Static<T extends IModel | TSchema> = T extends TSchema ? TStatic<T> : OnlyFields<T>;

export * from "./decerators.ts";
