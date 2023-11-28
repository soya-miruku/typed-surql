import type { Constructor, Simplify } from "npm:type-fest";
import { qlFn } from "./functions/index.ts";
import { DotNestedKeys, IModel, OnlyFields } from "./types.ts";
import { alias, arrays, count, cryptos, durations, http, math, meta, operations, parse, rands, search, session, strings, time } from "./functions/mod.ts";
import { TypedSurQL } from "./index.ts";
import { Model, getField, getTableName } from "./client.ts";
import { RawQueryResult } from "./surreal-types.ts";

export type StringContains<T extends string, U extends string> = T extends `${string}${U}${string}` ? true : false;
export type SQLInput<T extends string> = StringContains<T, "'"> extends true ? "USE VARS, INSTEAD OF '" : T;
export class SQL {
  constructor(protected readonly q: string[]) { }
  static Create(q: [string, string]) {
    return new SQL(q);
  }

  toString() {
    return this.q.join("\n");
  }
} 

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


export function ql<T>(strings: TemplateStringsArray, ...values: unknown[]): SQL {
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
  return SQL.Create([letStatements, finalQuery]);
}

export async function raw<T>(strings: TemplateStringsArray, ...value: unknown[]) {
  const q = ql(strings, ...value);
  const full = q.toString()
  return (await TypedSurQL.SurrealDB.query(full)).at(-1) as T;
}

export function magic<M extends Constructor<Model>, T, Ins = Instance<M>>(m: M, fn: (q: typeof ql<T>, field: FnBody<Ins>) => SQL, currentSql = "") {
  const baseFn = (k: DotNestedKeys<Ins> | Ins | Ins[]) => {
    const f = getField(m, k as keyof Model);
    if (f && f.type === "Relation" && f.params) {
      const viaTableName = getTableName(f.params.via as Constructor<Model>);
      const toTableName = f.params?.to ? getTableName(f.params.to as Constructor<Model>) : undefined;
      const toPath = toTableName ? `${f.params.select}${toTableName}` : f.params.select ? `${f.params.select}` : "";
      const viaPath = `${f.params.dirVia}${viaTableName}`;
      return val(`${viaPath}${toPath} as ${f.name as string}`);
    }
    if (typeof k === "string") return val(k as string);
    return val(JSON.stringify(k));
  }

  const fnBody = Object.assign(baseFn, context, operations, { TABLE: val(getTableName(m)), ql: ql<T>, field: baseFn }) as FnBody<Ins>;

  const sql = fn(ql<T>, fnBody);
  currentSql += sql.toString() + ";";
  return {
    pipe: <NewModel extends Constructor<Model>>(newModel: NewModel, fn: (q: typeof ql<T>, field: FnBody<Instance<NewModel>>) => SQL) => magic(newModel, fn, currentSql),
    exec: async <TResponse extends RawQueryResult[]>() => {
      if (!currentSql) throw new Error("No query was provided")
      return (await TypedSurQL.SurrealDB.query<TResponse>(currentSql)).at(-1) as TResponse
    }
  }
}
