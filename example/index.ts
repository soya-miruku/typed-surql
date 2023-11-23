import "npm:reflect-metadata";
import "npm:core-js";
import { TypedSurQL, Model, Q, RelationEdge } from '../src/index.ts';

await TypedSurQL.Init("http://127.0.0.1:8000", {
  auth: {
    username: "root",
    password: "root"
  },
  websocket: false,
  namespace: "test",
  database: "test"
})

const todo = Q.Type.Object({
  title: Q.Type.String(),
  completed: Q.Type.Boolean(),
});

@Q.Table({ name: "friends" })
class Friends extends RelationEdge<User, User>{ }

@Q.Table({ name: "user" })
class User extends Model {
  @Q.Field() name!: string
  @Q.Relation("->", Friends, "->", User) readonly friends!: User[] // so far the relational type must be readonly
  @Q.Field({}, todo) todos!: Todo[] // passing the object in the second arg, will allow you to later query the object using the query func
  @Q.Record(User) bestFriend?: User
}

export type UserObject = Q.Static<User>;
export type Todo = Q.Static<typeof todo>;

await User.create({ id: "user:0", name: "henry", todos: [{ title: "test", completed: false }] });
await User.create({ name: "bingo", bestFriend: "user:0", todos: [{ title: "test", completed: false }, { title: "test2", completed: true }] });

const result = await User.select(["todos", "friends", "bestFriend"], { fetch: ["friends", "bestFriend"] });
console.log(result)

/** RETURNS (AS AN EXAMPLE)
 * [
  { friends: [], todos: [ { completed: false, title: "test" } ] },
  {
    friends: [],
    todos: [
      { completed: false, title: "test" },
      { completed: true, title: "test2" }
    ]
  },
  { friends: [], todos: [ { completed: false, title: "test" } ] }
]
 */

const anotherway = await User.query((q, f) => q`SELECT ${f("todos.completed")} FROM ${f.TABLE}`).exec<Omit<User, "id" | "friends">[]>();
console.log(anotherway)

/** RETURNS (AS AN EXAMPLE)
 * [
  { todos: { completed: [ false ] } },
  { todos: { completed: [ false, true ] } },
  { todos: { completed: [ false ] } }
]
 */

type AliasReturn = { completed: boolean[] };
const alias = await User.query((q, f) => q`SELECT ${f("todos.completed").as("completed")} FROM ${f.TABLE}`).exec<AliasReturn[]>();
console.log(alias);

/** RETURNS (AS AN EXAMPLE)
 * [
  { completed: [ false ] },
  { completed: [ false, true ] },
  { completed: [ false ] }
]
 */

const aliasValue = await User.query((q, { VALUE, TABLE, field }) => q`SELECT ${VALUE} ${field("todos.completed").as("completed")} FROM ${TABLE}`).exec();
console.log(aliasValue);

/** RETURNS (AS AN EXAMPLE)
 * [ [ false ], [ false, true ], [ false ] ]
 */

const stringFnc = await User.query((q, { LIMIT, TABLE, field, string }) => q`SELECT ${string.uppercase(field("name")).as("upper_name")} FROM ${TABLE} ${LIMIT(2)}`).exec();
console.log(stringFnc);

/** RETURNS (AS AN EXAMPLE)
 * [ { upper_name: "MILK" } ]
 */