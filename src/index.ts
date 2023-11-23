import "npm:reflect-metadata";
import "npm:core-js";

import { ExperimentalSurrealHTTP, Surreal } from "https://deno.land/x/surrealdb/mod.ts";
import { AsyncReturnType } from "npm:type-fest";
import { ConnectionOptions } from "./surreal-types.ts";

export type StrategyType = "HTTP" | "WS";
export type SurrealClient = AsyncReturnType<typeof TypedSurQL['Init']>;
export type SurrealStratClient<Strategy extends StrategyType = "WS"> = Strategy extends "WS" ? Surreal : ExperimentalSurrealHTTP;

export class TypedSurQL<Strategy extends StrategyType = "WS"> {
  public static SurrealDB: Surreal;
  public static STRATEGY: StrategyType = "WS";

  constructor(public readonly SurrealDB: SurrealStratClient<Strategy>) { }

  public static Init<Strategy extends boolean>(url: string, opts?: ConnectionOptions & { websocket?: Strategy }) {
    if (!url) throw new Error("URL is required");
    this.SetStrategy(opts?.websocket);
    return new Promise<SurrealStratClient<Strategy extends true ? "WS" : "HTTP">>((resolve, reject) => {
      const db = TypedSurQL.STRATEGY === "WS" ? new Surreal() : new ExperimentalSurrealHTTP();
      try {
        void db.connect(url, opts as any).then(() => {
          TypedSurQL.SurrealDB = db as Surreal;
          resolve(db as SurrealStratClient<Strategy extends true ? "WS" : "HTTP">)
        });
      } catch (e) {
        reject(e)
      }
    })
  }

  public promisify() {
    return new Promise<SurrealStratClient<Strategy>>((resolve, reject) => {
      try {
        resolve(this.SurrealDB)
      } catch (e) {
        reject(e)
      }
    })
  }

  public static SetStrategy<Strategy extends boolean = true>(strategy?: Strategy) {
    if (strategy === undefined || strategy === true)
      this.STRATEGY = "WS";
    else this.STRATEGY = "HTTP";
  }

  public static Create<Strategy extends boolean>(url: string, opts?: ConnectionOptions & { websocket?: Strategy }) {
    if (!url) throw new Error("URL is required");
    this.SetStrategy(opts?.websocket);

    return new Promise<TypedSurQL<Strategy extends true ? "WS" : "HTTP">>((resolve, reject) => {
      const db = this.STRATEGY === "WS" ? new Surreal() : new ExperimentalSurrealHTTP();
      try {
        void db.connect(url, opts as any).then(() => {
          resolve(new TypedSurQL(db as SurrealStratClient<Strategy extends true ? "WS" : "HTTP">))
        });
      } catch (e) {
        reject(e)
      }
    })
  }

  public static async Wait(iterations = 5): Promise<boolean> {
    if (iterations === 0) return false;
    if (!TypedSurQL.SurrealDB) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return TypedSurQL.Wait(iterations - 1);
    }
    return true;
    // return await TypedSurQL.SurrealDB.wait().then(() => true);
  }
}

export * as Q from './helpers.ts';
export type * from "./types.ts";
export * from './client.ts';
export * as query from './query.ts';