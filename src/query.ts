import { Constructor, Simplify } from "npm:type-fest";
import { qlFn } from "./functions/index.ts";
import { DotNestedKeys, IModel, OnlyFields } from "./types.ts";
import { alias, arrays, count, cryptos, durations, http, math, meta, operations, parse, rands, search, session, strings, time } from "./functions/mod.ts";
import { TypedSurQL } from "./index.ts";
import { Model } from "./client.ts";
import { RawQueryResult } from "./surreal-types.ts";

export type StringContains<T extends string, U extends string> = T extends `${string}${U}${string}` ? true : false;
export type SQLInput<T extends string> = StringContains<T, "'"> extends true ? "USE VARS, INSTEAD OF '" : T;
export type SQLType = [string, string];
export type Instance<SubModel extends Constructor<IModel>> = Simplify<OnlyFields<InstanceType<SubModel>>>
export interface FnBody<InstanceType> extends Context, Operation {
  (k: DotNestedKeys<InstanceType> | InstanceType | InstanceType[]): qlFn;
  TABLE: qlFn;
  ql: typeof ql;
  field: (k: DotNestedKeys<InstanceType> | InstanceType | InstanceType[]) => qlFn;
}

export const context = {
  VALUE: qlFn.create("VALUE"),
  LIMIT: (limit: number) => qlFn.create(`LIMIT ${limit}`),
  val: val,
  string: strings,
  array: arrays,
  count: count,
  crypto: cryptos,
  duration: durations,
  http: http,
  math: math,
  parse: parse,
  rand: rands,
  session: session,
  search: search,
  time: time,
  meta: meta,
  ...alias
}

export type Context = typeof context;
export type Operation = typeof operations;

export function val(value: string) {
  return qlFn.create(`${value}`);
}

export function field(value: string, addcomma?: boolean) {
  return qlFn.create(`${value}${addcomma ? "," : ""}`);
}

export function ql<T>(strings: TemplateStringsArray, ...values: unknown[]): [string, string] {
  let finalQuery = '';
  let letStatements = '';

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value instanceof qlFn) {
      finalQuery += strings[i] + value;
      continue;
    }
    if (typeof value === "object" && !Array.isArray(value) && value !== null) {
      const [varName, obj] = Object.entries(value)[0];
      letStatements += `LET $${varName} = ${obj instanceof qlFn ? obj.toString() : typeof obj === "string" ? obj.includes(":") ? obj : JSON.stringify(obj) : JSON.stringify(obj)};\n`;
      finalQuery += strings[i] + `$${varName}`;
    } else {
      finalQuery += strings[i] + (typeof value === "string" ? `'${value}'` : `${value}`);
    }
  }

  finalQuery += strings[strings.length - 1];
  return [letStatements, finalQuery];
}

export async function raw<T>(strings: TemplateStringsArray, ...value: unknown[]) {
  const q = ql(strings, ...value);
  const full = q[0] + q[1];
  return (await TypedSurQL.SurrealDB.query(full)).at(-1) as T;
}

export function queryModel<M extends Constructor<Model>, T, Ins = Instance<M>>(m: M, fn: (q: typeof ql<T>, field: FnBody<Ins>) => [string, string]) {
  const instance = new m();

  const baseFn = (k: DotNestedKeys<Ins> | Ins | Ins[]) => {
    const f = instance.field(k as keyof Model);
    if (f && f.type === "Relation" && f.params) return field(`${f.params.dirVia}${f.params.via.name}${f.params.dirTo}${f.params.to.name} as ${f.name}`, false);
    if (typeof k === "string") return field(k as string, false);
    return field(JSON.stringify(k), false);
  }

  const fnBody = Object.assign(baseFn, context, operations, { TABLE: field(instance.tableName), ql: ql<T>, field: baseFn }) as FnBody<Ins>;

  const [letStatements, finalQuery] = fn(ql<T>, fnBody);
  const full = letStatements + finalQuery;
  return {
    exec: async <TResponse extends RawQueryResult[]>() => (await TypedSurQL.SurrealDB.query<TResponse>(full)).at(-1) as TResponse,
  }
}

export function rawFn() {
  let full = "";
  return function inner<M extends Model, Ins = Simplify<OnlyFields<InstanceType<Constructor<M>>>>>(fn: (q: typeof ql, field: ((k: DotNestedKeys<Ins> | Ins | Ins[]) => qlFn), context: Context, op: Operation) => [string, string]) {
    const [letStatements, finalQuery] = fn(ql, (k) => {
      if (typeof k === "string") return field(k as string, false);
      return field(JSON.stringify(k), false);
    }, context, operations);

    full += letStatements + finalQuery;
    return {
      pipe: inner,
      exec: async <TResponse extends RawQueryResult[]>() => {
        return (await TypedSurQL.SurrealDB.query<TResponse>(full)).at(-1) as TResponse
      },
    };
  }
}
