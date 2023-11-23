
<h1 align="center">
  <br>
  <a href="http://www.amitmerchant.com/electron-markdownify"><img src="https://files.oaiusercontent.com/file-JF5lKVEp2mxqbJ94WkF7hO1E?se=2023-11-23T09%3A47%3A38Z&sp=r&sv=2021-08-06&sr=b&rscc=max-age%3D31536000%2C%20immutable&rscd=attachment%3B%20filename%3De60d6697-d6a9-4ae3-b7ef-12ebb54d26d4.webp&sig=t1sj%2BTRCn2TX6Hl1y4AnhqRiwEPVG2XVZJOyrtEGcE8%3D" alt="typed-surql" width="200"></a>
  <br>
  Typed-Surql
  <br>
</h1>

<h4 align="center">A minimal typed ORM <a href="https://github.com/surrealdb/surrealdb.js" target="_blank">Surrealdb.js</a>.</h4>


## How To Use

```bash
# Clone this repository
$ git clone https://github.com/soya-miruku/typed-surql
```

```ts
# Or Using Deno
import {TypedSurQL} from 'https://deno.land/x/typed_surql@v1.0.18/mod.ts';
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

import { Model, Table, Field, OnlyFields, RelationEdge, Relation } from 'https://deno.land/x/typed_surql@v1.0.18/mod.ts';
import { Lemons } from "./lemons";

@Table({ name: "eats" })
export class Eats extends RelationEdge<User, Lemons> { }

@Table({ name: "user" })
export class User extends Model {
  @Field({ index: { name: "username_idx", search: true } }) username!: string;
  @Field() something!: string;
  @Relation("->", Eats, "->", Lemons) readonly lemonsEaten!: Lemons[];
}

@Table({ name: "session" })
export class Session extends Model {
  @Field() active_expires!: number;
  @Field() idle_expires!: number;
  @Field() user!: User;
}

@Table({ name: "key" })
export class Account extends Model {
  @Field() hashed_password?: string | null;
  @Field() key_id!: string;
  @Field() user!: User;
}

// Defines the object types with only the properties
export type UserObject = OnlyFields<User>;
export type SessionObject = OnlyFields<Session>;
export type AccountObject = OnlyFields<Account>;

// Perform queries

const result = await User.select("*", { fetch: ["lemonsEaten"]});

// query functions

import { query } from 'https://deno.land/x/typed_surql@v1.0.18/mod.ts';

// field param provides all surrealdb functions / operators and the table name as well allowing you to select the model properties:

query.queryModel(User, (q, field) => q`SELECT *, ${field.string.uppercase(field("username")).as("cap_username")} FROM ${field.table} WHERE ${field("id")} = ....`)
```

> **Note**
> There may be bugs

## License

MIT

---

> [soyamiruku](https://github.com/soya-miruku) &nbsp;