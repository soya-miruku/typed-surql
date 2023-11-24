import "npm:reflect-metadata";

import { Class, Constructor } from "npm:type-fest";
import { IFieldParams, ITable, Idx } from "./decerators.ts";
import { AsBasicModel, CreateInput, IModel, LengthGreaterThanOne, ModelKeysDot, OnlyFields, TransformSelected, UnionToArray } from "./types.ts";
import { TypedSurQL } from "./index.ts";
import { Surreal } from "https://deno.land/x/surrealdb/mod.ts";
import { field, val, ql, SQLType, Instance, FnBody, queryModel } from "./query.ts";
import { ActionResult, LiveQueryResponse, Patch } from "./surreal-types.ts";
import { floatJSONReplacer } from "./parsers.ts";

export type InfoForTable = {
  events: Record<string, string>;
  fields: Record<string, string>;
  indexes: Record<string, string>;
  lives: Record<string, string>;
  tables: Record<string, string>;
}

export class Model implements IModel {
  @Idx() public id!: string;

  constructor(props?: Partial<IModel>) {
    this.id = props?.id ?? "";
    Object.assign(this, props);
  }

  public get tableName(): string {
    return Reflect.getMetadata("table", this.constructor)?.name ?? this.constructor.name;
  }

  public static getTableName<SubModel extends Model>(ctor: Class<SubModel>): string {
    return Reflect.getMetadata("table", ctor).name;
  }

  public static getTable<SubModel extends Model>(ctor: Class<SubModel>): ITable<SubModel> {
    return Reflect.getMetadata("table", ctor) as ITable<SubModel>;
  }

  public get table() {
    return Reflect.getMetadata("table", this.constructor) as ITable<Model>;
  }

  public get fields() {
    const fields = (Reflect.getMetadata("fields", this.constructor, this.constructor.name) || []) as IFieldParams<Model>[];
    const id = Reflect.getMetadata("Idx", this.constructor) as IFieldParams<Model>;
    if (id) fields.unshift(id);
    return fields;
  }

  public field(name: keyof this) {
    if (name === "id") return Reflect.getMetadata("Idx", this.constructor) as IFieldParams<Model>;
    return Reflect.getMetadata("field", this.constructor, name.toString()) as IFieldParams<Model>;
  }

  public static async migrate<SubModel extends Model>(this: { new(): SubModel }) {
    const instance = new this();
    const queries: string[] = [];

    const info = await instance.info();
    const fields = instance.fields;
    const table = instance.table;
    const tableName = table.name;

    const tableIndexes = table?.indexes;
    if (tableIndexes) {
      const columns = tableIndexes.columns.map((column) => field(column as string));
      const index = field(`DEFINE INDEX ${columns.at(0)}_${columns.at(-1)}_${tableIndexes.suffix ?? "idx"} ON TABLE ${tableName} COLUMNS ${columns.join(", ")} ${tableIndexes.unique ? val("UNIQUE") : ""} ${tableIndexes.search ? "SEARCH ANALYZER ascii BM25 HIGHLIGHTS" : ""};`);
      queries.push(index.toString());
    }

    for (const field of fields) {
      if (field.index && !info.indexes[field.index.name]) {
        const query = ql`DEFINE INDEX ${val(field.index.name)} ON TABLE ${val(tableName)} COLUMNS ${val(field.name)} ${field.index.unique ? val("UNIQUE") : ""} ${field.index.search ? "SEARCH ANALYZER ascii BM25 HIGHLIGHTS" : ""};`;
        queries.push(query[0] + query[1]);
      }
    }

    const fullQuery = queries.join("\n");
    await TypedSurQL.SurrealDB.query(fullQuery);
  }

  public async info() {
    return (await TypedSurQL.SurrealDB.query<InfoForTable[]>(`INFO FOR TABLE ${this.tableName};`))[0];
  }

  public static async live<SubModel extends Model>(this: { new(): SubModel }, callback?: (data: LiveQueryResponse<OnlyFields<SubModel>>) => unknown, diff?: boolean): Promise<string> {
    const instance = new this();
    if (TypedSurQL.STRATEGY === "HTTP") throw new Error("Live queries are not supported in HTTP mode");
    return (TypedSurQL.SurrealDB as Surreal).live<Record<string, OnlyFields<SubModel>>>(instance.tableName, callback as any, diff);
  }

  public static async select<SubModel extends Model, Key extends keyof OnlyFields<SubModel>, Fetch extends ModelKeysDot<Pick<SubModel, Key> & Model> = never, WithValue extends boolean | undefined = undefined>(
    this: { new(props?: Partial<SubModel>): SubModel },
    keys: Key[] | "*",
    options?: {
      fetch?: Fetch[],
      id?: string,
      value?: WithValue extends LengthGreaterThanOne<UnionToArray<Key>> ? false : WithValue,
      where?: SQLType
    }
  ): Promise<TransformSelected<SubModel, Key, Fetch, WithValue>[]> {
    const instance = new this();
    const tableName = instance.tableName;
    const fields = keys === "*" ? instance.fields
      : keys.map((key) => {
        const field = instance.field(key);
        if (!field) throw new Error(`Field ${key.toString()} does not exist on ${tableName}`);
        return field;
      });

    const selections = fields.map((field) => {
      const specifier = field.name.toString().includes(":") ? field.name.toString().split(":") : undefined;
      const [name, id] = specifier ? specifier : [field.name, undefined];
      if (field.type === "Relation" && field.params) {
        const viaTableName = Model.getTableName(field.params.via as Constructor<Model>);
        const toTableName = Model.getTableName(field.params.to as Constructor<Model>);
        return `${field.params.dirVia}${viaTableName}${id ? `:${id}` : ""}${field.params.dirTo}${toTableName} as ${name as string}`;
      }
      return `${field.name as string}`;
    });

    const from = options?.id ? options?.id.includes(":") ? `${tableName}:${options?.id.split(":")[1]}` : `${tableName}:${options?.id}` : tableName;
    const query = `SELECT${options?.value ? " VALUE" : ""} ${selections.join(", ")} FROM ${from}${options?.where ? ` WHERE ${options?.where}` : ""}${options?.fetch && options?.fetch.length > 0 ? ` FETCH ${options?.fetch.join(", ")}` : ""}`;
    return (await TypedSurQL.SurrealDB.query(query)).at(-1) as TransformSelected<SubModel, Key, Fetch, WithValue>[];
  }

  public static async create<SubModel extends Model>(this: { new(props?: CreateInput<SubModel>): SubModel }, props: CreateInput<SubModel>) {
    const instance = new this(props);
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const transformedProps: any = {};
    for (const [key, value] of Object.entries(props))
      transformedProps[key] = instance.transform(key, value as object | Model);

    return await TypedSurQL.SurrealDB.query(`CREATE ${instance.tableName} CONTENT ${JSON.stringify(transformedProps, floatJSONReplacer, 2)}`, { value: transformedProps }) as ActionResult<OnlyFields<SubModel>, CreateInput<SubModel>>[];
  }

  private transform(key: string, value: object | Model) {
    if (Array.isArray(value)) {
      const results = value.map((val) => this.transform(key, val)).filter((val) => val !== undefined) as string[];
      return results;
    }

    if (typeof value === 'object' && !(value instanceof Date) && !(value instanceof Model)) {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const obj: any = {};
      if (!value) return undefined;
      for (const [k, v] of Object.entries(value)) {
        const result = this.transform(k, v);
        if (result !== undefined)
          obj[k] = result;
      }
      return obj;
    }

    return value instanceof Model ? `${value.tableName}:${value.id}` : value;
  }

  public static async insert<SubModel extends Model, U extends Partial<CreateInput<SubModel>>>(this: { new(): SubModel }, data: U | U[] | undefined): Promise<ActionResult<OnlyFields<SubModel>, U>[]> {
    let transformedData: U | U[] | undefined;
    const instance = new this();
    if (!data) return [];
    if (Array.isArray(data)) {
      transformedData = data.map((val) => {
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        const transformedProps: any = {};
        for (const [key, value] of Object.entries(val))
          transformedProps[key] = instance.transform(key, value as object | Model);
        return transformedProps;
      });
    } else {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const transformedProps: any = {};
      for (const [key, value] of Object.entries(data))
        transformedProps[key] = instance.transform(key, value as object | Model);
      transformedData = transformedProps;
    }

    if (!transformedData) {
      throw new Error("transformedData is undefined");
    }
    if (TypedSurQL.STRATEGY === "HTTP") {
      if (Array.isArray(transformedData)) {
        if (!transformedData.length) return [];
        return await TypedSurQL.SurrealDB.query(`INSERT INTO ${instance.tableName} ${JSON.stringify(transformedData, floatJSONReplacer, 2)}`)
      } else {
        return await TypedSurQL.SurrealDB.query(`INSERT INTO ${instance.tableName} ${JSON.stringify(transformedData, floatJSONReplacer, 2)}`)
      }
    }

    return await (TypedSurQL.SurrealDB as Surreal).insert<OnlyFields<SubModel>, U>(instance.tableName, transformedData);
  }

  public static async update<SubModel extends Model, U extends AsBasicModel<SubModel>>(this: { new(): SubModel }, data?: U | undefined): Promise<ActionResult<AsBasicModel<SubModel>, U>[]> {
    const instance = new this();
    return await TypedSurQL.SurrealDB.update<AsBasicModel<SubModel>, U>(instance.tableName, data);
  }

  public static async merge<SubModel extends Model, U extends Partial<AsBasicModel<SubModel>>>(this: { new(): SubModel }, data?: U | undefined): Promise<ActionResult<AsBasicModel<SubModel>, U>[]> {
    const instance = new this();
    return await TypedSurQL.SurrealDB.merge<AsBasicModel<SubModel>, U>(instance.tableName, data);
  }

  public static async patch<SubModel extends Model>(this: { new(): SubModel }, data?: Patch[] | undefined): Promise<Patch[]> {
    const instance = new this();
    if (TypedSurQL.STRATEGY === "HTTP") throw new Error("Patch queries are not supported in HTTP mode")
    return await (TypedSurQL.SurrealDB as Surreal).patch(instance.tableName, data);
  }

  public static async delete<SubModel extends Model>(this: { new(): SubModel }, id?: string): Promise<ActionResult<AsBasicModel<SubModel>>[]> {
    const instance = new this();
    return await TypedSurQL.SurrealDB.delete<AsBasicModel<SubModel>>(instance.tableName + (id ? `:${id}` : ''));
  }

  public static async relate<SubModel extends Model, Via extends Constructor<Model>, To extends Constructor<Model>>(this: { new(props?: Partial<Model>): SubModel }, id: string, via: [Via, string] | Via, to: [To, string]): Promise<ActionResult<AsBasicModel<SubModel>>[]> {
    const viaInstance = new (Array.isArray(via) ? via[0] : via)();
    const toInstance = new (Array.isArray(to) ? to[0] : to)();
    const instance = new this();
    const viaTableName = viaInstance.tableName;
    const toTableName = toInstance.tableName;

    const viaName = Array.isArray(via) ? `${viaTableName}:${via[1]}` : viaTableName;
    return await TypedSurQL.SurrealDB.query(`RELATE ${`${instance.tableName}:${id}`}->${viaName}->${`${toTableName}:${to[1]}`};`);
  }

  public static query<SubModel extends Model, T, Ins = Instance<Constructor<SubModel>>>(this: { new(): SubModel }, fn: (q: typeof ql<T>, field: FnBody<Ins>) => [string, string]) {
    return queryModel(this, fn);
  }
}

export class RelationEdge<In extends IModel, Out extends IModel> extends Model {
  public in!: In | string;
  public out!: Out | string;
}