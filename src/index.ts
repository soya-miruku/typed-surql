import "npm:reflect-metadata@latest";
import "npm:core-js@latest";
import { ExperimentalSurrealHTTP, Surreal } from "surrealdb.js";
import { AsyncReturnType } from "npm:type-fest@latest";
import { ConnectionOptions } from "./surreal-types.ts";

export let STRATEGY: "HTTP" | "WS" = "HTTP";

export class TypedSurQL {
  public static SurrealDB: Surreal;

  public static Init(url: string, opts?: ConnectionOptions & { websocket?: boolean }) {
    if (!url) throw new Error("URL is required");
    if (opts?.websocket === undefined || opts?.websocket === true)
      STRATEGY = "WS";

    return new Promise<Surreal | ExperimentalSurrealHTTP>((resolve, reject) => {
      const db = STRATEGY === "WS" ? new Surreal() : new ExperimentalSurrealHTTP();
      try {
        void db.connect(url, opts as any).then(() => {
          TypedSurQL.SurrealDB = db as Surreal;
          resolve(db)
        });
      } catch (e) {
        reject(e)
      }
    })
  }

  public static async Wait(iterations = 5): Promise<boolean> {
    if (iterations === 0) return false;
    if (!TypedSurQL.SurrealDB) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return TypedSurQL.Wait(iterations - 1);
    }
    return await TypedSurQL.SurrealDB.wait().then(() => true);
  }
}

export type SurrealClient = AsyncReturnType<typeof TypedSurQL['Init']>;

export * from "./decerators.ts";
export type * from "./types.ts";
export * from './client.ts';
export * as query from './query.ts';