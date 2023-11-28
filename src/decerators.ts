import "npm:reflect-metadata";
import { Kind, Optional, TObject, TRecord, TSchema, Type } from "npm:@sinclair/typebox";
import type { OnlyFields, StaticModel, Constructor, IModel, DotNestedKeys } from "./types.ts";

export type ITable<SubModel extends IModel, K extends keyof SubModel = keyof SubModel, P = keyof OnlyFields<SubModel> & K> = {
  name: string;
  indexes?: { columns: P[], suffix?: string, unique?: boolean, search?: boolean };
};
export type DirViaOptions<Via extends StaticModel> = "->" | "<-" | ".*" | `.*.${DotNestedKeys<Via extends Constructor<infer V> ? OnlyFields<V> : never>}`;
export type DirToOptions<DirTo extends any> = DirTo extends "->" | "<-" ? StaticModel : never;

export type IRelationParams<From extends IModel, Via extends StaticModel, To extends StaticModel> = {
  from: From;
  via: Via;
  to?: To;
  dirVia: DirViaOptions<Via>;
  select?: DirViaOptions<Via> | "->" | "<-";
};

export type ObjType = Record<string, { type: ObjType, required: boolean, name: string, isObject: boolean }>;

export type IFieldParams<SubModel extends IModel> = {
  name: keyof SubModel;
  type: string | ObjType;
  isArray: boolean;
  isObject: boolean;
  index?: { name: string, unique?: boolean, search?: boolean };
  params?: IRelationParams<SubModel, StaticModel, StaticModel>;
};

export interface IFieldProps<SubModel extends IModel, Types> {
  index?: { name: string, unique?: boolean, search?: boolean }
  type?: ((t: typeof Type) => Types) | Types;
}

export function Table<SubModel extends IModel>(props?: ITable<SubModel, keyof SubModel>) {
  return function (ctor: Constructor<SubModel>) {
    Reflect.defineMetadata('table', { name: props?.name ?? ctor.name, indexes: props?.indexes }, ctor);
  }
}

function parseTObject<T extends TObject | TRecord>(t: T) {
  const properties: ObjType | Record<string, any> = {};
  const kind = t[Kind] === "Record" ? "Record" : "Object";
  for (const [k, v] of Object.entries(kind === "Record" ? t.patternProperties as T['properties'] : t.properties as T['properties'])) {
    const val = v as any;
    if (val.type === "object") {
      properties[k] = { type: parseTObject(v as TObject), required: val[Optional] !== "Optional", name: k, isObject: true, isArray: false };
      continue;
    }
    properties[k] = { type: val.type, required: val[Optional] !== "Optional", name: k, isObject: val.type === "object", isArray: val.type === "array" };
  }

  return properties;
}

export function Field<SubModel extends IModel, Types extends TObject | TRecord>(fieldProps?: IFieldProps<SubModel, Types>) {
  return function (target: SubModel, propertyKey: keyof SubModel) {
    const name = propertyKey;
    const fields: IFieldParams<SubModel>[] = Reflect.getMetadata("fields", target.constructor, target.constructor.name) || [];
    let type = Reflect.getMetadata("design:type", target, propertyKey.toString());
    type = type ?? { name: "unknown" }
    const isObject = type.name === "Object";
    const field = {
      name,
      isObject,
      isArray: type.name === "Array",
      type: fieldProps?.type ? parseTObject(typeof fieldProps?.type === "function" ? fieldProps?.type(Type) : fieldProps.type) : type.name,
      index: fieldProps?.index,
    }
    fields.push(field);
    Reflect.defineMetadata("fields", fields, target.constructor, target.constructor.name);
    Reflect.defineMetadata("field", field, target.constructor, propertyKey.toString());
  }
}

export function Idx() {
  return function <SubModel extends IModel>(target: SubModel, propertyKey: keyof SubModel) {
    Reflect.defineMetadata("Idx", { name: propertyKey, isArray: false, type: "Id" }, target.constructor);
  }
}

export function Record<ModelType extends Constructor<IModel>>(recType: ModelType) {
  return function <SubModel extends IModel>(target: SubModel, propertyKey: keyof SubModel) {
    const name = propertyKey;
    const fields: IFieldParams<SubModel>[] = Reflect.getMetadata("fields", target.constructor, target.constructor.name) || [];
    let type = Reflect.getMetadata("design:type", target, propertyKey.toString());
    type = type ?? { name: "unknown" }
    const isArray = type.name === "Array";
    const isObject = type.name === "Object";
    const field = {
      name,
      isArray,
      isObject,
      type: `Record:${recType.name}`,
    }

    fields.push(field);

    Reflect.defineMetadata("fields", fields, target.constructor, target.constructor.name);
    Reflect.defineMetadata("field", field, target.constructor, propertyKey.toString());
  };
}


export function Relation<SubModel extends IModel,
  DirVia extends "->" | "<-",
  DirTo extends "->" | "<-",
  Via extends StaticModel,
  ViaSelectors extends DirViaOptions<Via>,
  To extends StaticModel>(dirVia: DirVia, via: Via, select?: ViaSelectors | DirTo, to?: To) {
  return function (target: SubModel, propertyKey: keyof SubModel) {
    const name = propertyKey;
    const fields: IFieldParams<SubModel>[] = Reflect.getMetadata("fields", target.constructor, target.constructor.name) || [];
    const field = {
      name,
      type: "Relation",
      isArray: true,
      isObject: false,
      params: { from: target, via, to: to, dirVia, select },
    }

    fields.push(field);
    Reflect.defineMetadata("fields", fields, target.constructor, target.constructor.name);
    Reflect.defineMetadata("field", field, target.constructor, propertyKey.toString());
  };
}