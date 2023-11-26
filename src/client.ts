import type { Class, Constructor } from "npm:type-fest";
import { Surreal } from "https://deno.land/x/surrealdb/mod.ts";
import { IFieldParams, ITable, Idx } from "./decerators.ts";
import type { AsBasicModel, CreateInput, IModel, LengthGreaterThanOne, ModelKeysDot, OnlyFields, TransformSelected, UnionToArray } from "./types.ts";
import { TypedSurQL } from "./index.ts";
import { val, ql, SQL, Instance, FnBody, magic } from "./query.ts";
import { ActionResult, LiveQueryResponse, Patch } from "./surreal-types.ts";
import { floatJSONReplacer } from "./parsers.ts";

export type InfoForTable = {
  events: Record<string, string>;
  fields: Record<string, string>;
  indexes: Record<string, string>;
  lives: Record<string, string>;
  tables: Record<string, string>;
}

export function getTableName<SubModel extends Model>(ctor: Class<SubModel>): string {
  return Reflect.getMetadata("table", ctor)?.name ?? ctor.name;
}

export function getTable<SubModel extends Model>(ctor: Class<SubModel>): ITable<SubModel> | undefined {
  const res = Reflect.getMetadata("table", ctor);
  return res ? res as ITable<SubModel> : undefined
}

export function getFields<SubModel extends Model>(ctor: Class<SubModel>): IFieldParams<SubModel>[] {
  const fields = Reflect.getMetadata("fields", ctor, ctor.name) as IFieldParams<SubModel>[];
  const id = Reflect.getMetadata("Idx", ctor) as IFieldParams<SubModel>;
  return id ? fields.concat(id) : fields;
}

export function getField<SubModel extends Model>(ctor: Class<SubModel>, name: keyof SubModel): IFieldParams<SubModel> {
  if (name === "id") return Reflect.getMetadata("Idx", ctor) as IFieldParams<SubModel>;
  return Reflect.getMetadata("field", ctor, name.toString()) as IFieldParams<SubModel>;
}

export function transform(key: string, value: object | Model) {
  if (Array.isArray(value)) {
    const results = value.map((val) => transform(key, val)).filter((val) => val !== undefined) as string[];
    return results;
  }

  if (typeof value === 'object' && !(value instanceof Date) && !(value instanceof Model)) {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const obj: any = {};
    if (!value) return undefined;
    for (const [k, v] of Object.entries(value)) {
      const result = transform(k, v);
      if (result !== undefined)
        obj[k] = result;
    }
    return obj;
  }

  return value instanceof Model ? `${getTableName(value.constructor as Class<Model>)}:${value.id}` : value;
}

export class Model implements IModel {
  @Idx() public id!: string;

  public get tableName() {
    return (Reflect.getMetadata("table", this.constructor)?.name ?? this.constructor.name) as string;
  }

  constructor(props?: Partial<IModel>) {
    this.id = props?.id ?? "";
    Object.assign(this, props);
  }

  public static async migrate<SubModel extends Model>(this: { new(): SubModel }) {
    const table = getTable(this);
    const tableName = table?.name ?? this.constructor.name;
    const queries: string[] = [];

    const info = (await TypedSurQL.SurrealDB.query<InfoForTable[]>(`INFO FOR TABLE ${tableName};`))[0];
    const fields = getFields(this);

    const tableIndexes = table?.indexes;
    if (tableIndexes) {
      const columns = tableIndexes.columns.map((column) => val(column as string));
      const index = val(`DEFINE INDEX ${columns.at(0)}_${columns.at(-1)}_${tableIndexes.suffix ?? "idx"} ON TABLE ${tableName} COLUMNS ${columns.join(", ")} ${tableIndexes.unique ? val("UNIQUE") : ""} ${tableIndexes.search ? "SEARCH ANALYZER ascii BM25 HIGHLIGHTS" : ""};`);
      queries.push(index.toString());
    }

    for (const field of fields) {
      if (field.index && !info.indexes[field.index.name]) {
        const query = ql`DEFINE INDEX ${val(field.index.name)} ON TABLE ${val(tableName)} COLUMNS ${val(field.name as string)} ${field.index.unique ? val("UNIQUE") : ""} ${field.index.search ? "SEARCH ANALYZER ascii BM25 HIGHLIGHTS" : ""};`;
        queries.push(query.toString());
      }
    }

    const fullQuery = queries.join("\n");
    await TypedSurQL.SurrealDB.query(fullQuery);
  }

  public static async info<SubModel extends Model>(this: { new(): SubModel }) {
    return (await TypedSurQL.SurrealDB.query<InfoForTable[]>(`INFO FOR TABLE ${getTableName(this)};`))[0];
  }

  public static async live<SubModel extends Model>(this: { new(): SubModel }, callback?: (data: LiveQueryResponse<OnlyFields<SubModel>>) => unknown, diff?: boolean): Promise<string> {
    if (TypedSurQL.STRATEGY === "HTTP") throw new Error("Live queries are not supported in HTTP mode");
    return await (TypedSurQL.SurrealDB as Surreal).live<Record<string, OnlyFields<SubModel>>>(getTableName(this), callback as any, diff);
  }

  public static async select<SubModel extends Model, Key extends keyof OnlyFields<SubModel>, Fetch extends ModelKeysDot<Pick<SubModel, Key> & Model> = never, WithValue extends boolean | undefined = undefined>(
    this: { new(props?: Partial<SubModel>): SubModel },
    keys: Key[] | "*",
    options?: {
      fetch?: Fetch[],
      id?: string,
      value?: WithValue extends LengthGreaterThanOne<UnionToArray<Key>> ? false : WithValue,
      where?: SQL
      logQuery?: boolean
    }
  ): Promise<TransformSelected<SubModel, Key, Fetch, WithValue>[]> {
    const tableName = getTableName(this);
    const fields = keys === "*" ? getFields(this)
      : keys.map((key) => {
        const field = getField(this, key);
        if (!field) throw new Error(`Field ${key.toString()} does not exist on ${tableName}`);
        return field;
      });

    const selections = fields.map((field) => {
      const specifier = field.name.toString().includes(":") ? field.name.toString().split(":") : undefined;
      const [name, id] = specifier ? specifier : [field.name, undefined];
      if (field.type === "Relation" && field.params) {
        const viaTableName = getTableName(field.params.via as Constructor<Model>);
        const toTableName = getTableName(field.params.to as Constructor<Model>);
        return `${field.params.dirVia}${viaTableName}${id ? `:${id}` : ""}${field.params.dirTo}${toTableName} as ${name as string}`;
      }
      return `${field.name as string}`;
    });


    const from = options?.id ? options?.id.includes(":") ? `${tableName}:${options?.id.split(":")[1]}` : `${tableName}:${options?.id}` : tableName;
    const query = `SELECT${options?.value ? " VALUE" : ""} ${selections.join(", ")} FROM ${from}${options?.where ? ` WHERE ${options?.where.toString()}` : ""}${options?.fetch && options?.fetch.length > 0 ? ` FETCH ${options?.fetch.join(", ")}` : ""}`;
    options?.logQuery && console.log(query);
    return (await TypedSurQL.SurrealDB.query(query)).at(-1) as TransformSelected<SubModel, Key, Fetch, WithValue>[];
  }

  public static async create<SubModel extends Model>(this: { new(props?: CreateInput<SubModel>): SubModel }, props: CreateInput<SubModel>) {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const transformedProps: any = {};
    for (const [key, value] of Object.entries(props))
      transformedProps[key] = transform(key, value as object | Model);

    return await TypedSurQL.SurrealDB.query(`CREATE ${getTableName(this)} CONTENT ${JSON.stringify(transformedProps, floatJSONReplacer, 2)}`, { value: transformedProps }) as ActionResult<OnlyFields<SubModel>, CreateInput<SubModel>>[];
  }

  public static async insert<SubModel extends Model, U extends Partial<CreateInput<SubModel>>>(this: { new(): SubModel }, data: U | U[] | undefined): Promise<ActionResult<OnlyFields<SubModel>, U>[]> {
    let transformedData: U | U[] | undefined;
    if (!data) return [];
    if (Array.isArray(data)) {
      transformedData = data.map((val) => {
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        const transformedProps: any = {};
        for (const [key, value] of Object.entries(val))
          transformedProps[key] = transform(key, value as object | Model);
        return transformedProps;
      });
    } else {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const transformedProps: any = {};
      for (const [key, value] of Object.entries(data))
        transformedProps[key] = transform(key, value as object | Model);
      transformedData = transformedProps;
    }

    if (!transformedData) {
      throw new Error("transformedData is undefined");
    }
    if (TypedSurQL.STRATEGY === "HTTP") {
      if (Array.isArray(transformedData)) {
        if (!transformedData.length) return [];
        return await TypedSurQL.SurrealDB.query(`INSERT INTO ${getTableName(this)} ${JSON.stringify(transformedData, floatJSONReplacer, 2)}`)
      } else {
        return await TypedSurQL.SurrealDB.query(`INSERT INTO ${getTableName(this)} ${JSON.stringify(transformedData, floatJSONReplacer, 2)}`)
      }
    }

    return await (TypedSurQL.SurrealDB as Surreal).insert<OnlyFields<SubModel>, U>(getTableName(this), transformedData);
  }

  public static async update<SubModel extends Model, U extends AsBasicModel<SubModel>>(this: { new(): SubModel }, data?: U | undefined): Promise<ActionResult<AsBasicModel<SubModel>, U>[]> {
    return await TypedSurQL.SurrealDB.update<AsBasicModel<SubModel>, U>(getTableName(this), data);
  }

  public static async merge<SubModel extends Model, U extends Partial<AsBasicModel<SubModel>>>(this: { new(): SubModel }, data?: U | undefined): Promise<ActionResult<AsBasicModel<SubModel>, U>[]> {
    return await TypedSurQL.SurrealDB.merge<AsBasicModel<SubModel>, U>(getTableName(this), data);
  }

  public static async patch<SubModel extends Model>(this: { new(): SubModel }, data?: Patch[] | undefined): Promise<Patch[]> {
    if (TypedSurQL.STRATEGY === "HTTP") throw new Error("Patch queries are not supported in HTTP mode")
    return await (TypedSurQL.SurrealDB as Surreal).patch(getTableName(this), data);
  }

  public static async delete<SubModel extends Model>(this: { new(): SubModel }, id?: string): Promise<ActionResult<AsBasicModel<SubModel>>[]> {
    const thing = id ? id.includes(":") ? id : `${getTableName(this)}:${id}` : getTableName(this);
    return await TypedSurQL.SurrealDB.delete<AsBasicModel<SubModel>>(thing);
  }

  public static async relate<SubModel extends Model, Via extends Constructor<Model>, To extends Constructor<Model>>(this: { new(props?: Partial<Model>): SubModel }, id: string, via: [Via, string] | Via, to: [To, string]): Promise<ActionResult<AsBasicModel<SubModel>>[]> {
    const viaCtor = Array.isArray(via) ? via[0] : via;
    const toCtor = Array.isArray(to) ? to[0] : to;
    const viaTableName = getTableName(viaCtor)
    const toTableName = getTableName(toCtor)

    const viaName = Array.isArray(via) ? `${viaTableName}:${via[1]}` : viaTableName;
    return await TypedSurQL.SurrealDB.query(`RELATE ${`${getTableName(this)}:${id}`}->${viaName}->${`${toTableName}:${to[1]}`};`);
  }

  public static query<SubModel extends Model, T, Ins = Instance<Constructor<SubModel>>>(this: { new(): SubModel }, fn: (q: typeof ql<T>, field: FnBody<Ins>) => SQL) {
    return magic(this, fn);
  }
}

export class RelationEdge<In extends IModel, Out extends IModel> extends Model {
  public in!: In | string;
  public out!: Out | string;
}