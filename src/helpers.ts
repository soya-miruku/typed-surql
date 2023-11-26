import { type Static as TStatic, TSchema } from 'npm:@sinclair/typebox';
export { Type } from 'npm:@sinclair/typebox'
import { OnlyFields, IModel } from "./types.ts";

export type Static<T extends IModel | TSchema> = T extends TSchema ? TStatic<T> : OnlyFields<T>;
export * from "./decerators.ts";
