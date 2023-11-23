
<h1 align="center">
  <br>
  <a href="http://www.amitmerchant.com/electron-markdownify"><img src="https://files.oaiusercontent.com/file-JF5lKVEp2mxqbJ94WkF7hO1E?se=2023-11-23T09%3A47%3A38Z&sp=r&sv=2021-08-06&sr=b&rscc=max-age%3D31536000%2C%20immutable&rscd=attachment%3B%20filename%3De60d6697-d6a9-4ae3-b7ef-12ebb54d26d4.webp&sig=t1sj%2BTRCn2TX6Hl1y4AnhqRiwEPVG2XVZJOyrtEGcE8%3D" alt="typed-surql" width="200"></a>
  <br>
  Typed-Surql
  <br>
</h1>

<h4 align="center">A minimal typed ORM built on top of <a href="https://github.com/surrealdb/surrealdb.js" target="_blank">Surrealdb.js</a>.</h4>
<h3> Note that there are still some features that have not been completed, such as migrations, schema generation</h3>

## How To Use

```bash
# Clone this repository
$ git clone https://github.com/soya-miruku/typed-surql
```

```ts
 ensure you have enabled the following in your tsconfig file:
  "emitDecoratorMetadata": true,
  "experimentalDecorators": true,
```

```ts
# Or Using Deno
import {TypedSurQL} from 'https://deno.land/x/typed_surql@v1.0.20/mod.ts';
# Or npm/bun
import { TypedSurQL } from '@soyamiruku/typed-surl';

// initialise the connection
TypedSurQL.Init(env.DB_URL, {
	websocket: false, auth: {
		username: env.DB_USER,
		password: env.DB_PASS
	},
	namespace: env.DB_NAMESPACE,
	database: env.DB_NAME
});

// wait until the connection is made
await TypedSurQL.Wait(5);
import { TypedSurQL, Model, Q, RelationEdge } from '../src/index.ts';
import { Lemons } from "./lemons";

@Q.Table({ name: "eats" })
export class Eats extends RelationEdge<User, Lemons> { }

@Q.Table({ name: "user" })
export class User extends Model {
  @Q.Field({ index: { name: "username_idx", search: true } }) username!: string;
  @Q.Field() something!: string;
  @Q.Relation("->", Eats, "->", Lemons) readonly lemonsEaten!: Lemons[];
}

@Q.Table({ name: "session" })
export class Session extends Model {
  @Q.Field() active_expires!: number;
  @Q.Field() idle_expires!: number;
  @Q.Field() user!: User;
}

@Q.Table({ name: "key" })
export class Account extends Model {
  @Q.Field() hashed_password?: string | null;
  @Q.Field() key_id!: string;
  @Q.Field() user!: User;
}

// Defines the object types with only the properties
export type UserObject = Q.Static<User>;
export type SessionObject = Q.Static<Session>;
export type AccountObject = Q.Static<Account>;

// Perform queries

const result = await User.select("*", { fetch: ["lemonsEaten"]});

// query functions

import { query } from 'https://deno.land/x/typed_surql@v1.0.20/mod.ts';

// field param provides all surrealdb functions / operators and the table name as well allowing you to select the model properties:

query.queryModel(User, (q, field) => q`SELECT *, ${field.string.uppercase(field("username")).as("cap_username")} FROM ${field.TABLE} WHERE ${field("id")} = ....`)
// or you can do
User.query((q, { VALUE, TABLE, field }) => ....)....
```

```txt
  There is also an example folder with you can check out
```

> **Note**
> There may be bugs

## License

MIT

---

> [soyamiruku](https://github.com/soya-miruku) &nbsp;