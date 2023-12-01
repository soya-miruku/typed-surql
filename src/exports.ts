import { type Static as TStatic, TSchema } from 'https://esm.sh/@sinclair/typebox@0.31.28';
export { Type } from 'https://esm.sh/@sinclair/typebox@0.31.28'
import { OnlyFields, IModel } from "./types/types.ts";
export type Static<T extends IModel | TSchema> = T extends TSchema ? TStatic<T> : OnlyFields<T>;

export * from './model.ts';
export * from "./decerators.ts";
export * from "./permissions.ts";
export * from './scope.ts';
export * from "./token.ts";
export * from "./utils/query.ts";