import "npm:reflect-metadata";
import { Optional, TObject, Type } from "npm:@sinclair/typebox";
import type { OnlyFields, StaticModel, Constructor, IModel } from "./types.ts";

export type ITable<SubModel extends IModel, K extends keyof SubModel = keyof SubModel, P = keyof OnlyFields<SubModel> & K> = {
  name: string;
  indexes?: { columns: P[], suffix?: string, unique?: boolean, search?: boolean };
};

export type IRelationParams<From extends IModel, Via extends StaticModel, To extends StaticModel> = {
  from: From;
  via: Via;
  to: To;
  dirVia: "<-" | "->";
  dirTo: "<-" | "->";
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
  type?: (t: typeof Type) => Types | Types;
}

export function Table<SubModel extends IModel>(props?: ITable<SubModel, keyof SubModel>) {
  return function (ctor: Constructor<SubModel>) {
    Reflect.defineMetadata('table', { name: props?.name ?? ctor.name, indexes: props?.indexes }, ctor);
  }
}

function parseTObject<T extends TObject>(t: T) {
  // we go through the object properties, do [k]: {type: "string", required: true}, if the type is object we will go through it recursively
  const properties: ObjType | { [k: string]: any } = {};
  for (const [k, v] of Object.entries(t.properties)) {
    if (v.type === "object") {
      properties[k] = { type: parseTObject(v as TObject), required: v[Optional] !== "Optional", name: k, isObject: true, isArray: false };
      continue;
    }
    properties[k] = { type: v.type, required: v[Optional] !== "Optional", name: k, isObject: v.type === "object", isArray: v.type === "array" };
  }

  return properties;
}

export function Field<SubModel extends IModel, Types extends TObject>(fieldProps?: IFieldProps<SubModel, Types>, schema?: ((t: typeof Type) => Types) | Types) {
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
      type: (isObject && schema) ? parseTObject(typeof schema === "function" ? schema(Type) : type) : type.name,
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

export function Relation<SubModel extends IModel, DirVia extends "->" | "<-", DirTo extends "->" | "<-", Via extends StaticModel, To extends StaticModel>(dirVia: DirVia, via: Via, dirTo: DirTo, to: To) {
  return function (target: SubModel, propertyKey: keyof SubModel) {
    const name = propertyKey;
    const fields: IFieldParams<SubModel>[] = Reflect.getMetadata("fields", target.constructor, target.constructor.name) || [];
    const field = {
      name,
      type: "Relation",
      isArray: true,
      isObject: false,
      params: { from: target, via, to: to, dirVia, dirTo },
    }

    fields.push(field);
    Reflect.defineMetadata("fields", fields, target.constructor, target.constructor.name);
    Reflect.defineMetadata("field", field, target.constructor, propertyKey.toString());
  };
}