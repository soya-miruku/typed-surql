import { build, emptyDir } from "dnt";
import project from "./project.json" assert { type: "json" };

await emptyDir("./npm");

await build({
	entryPoints: ["./src/index.ts"],
	outDir: "./npm",
	shims: {
		// see JS docs for overview and more options
		deno: false,
		webSocket: false,
	},
	package: {
		// package.json properties
		name: "@soyamiruku/typed-surql",
		version: project.version,
		description: "SurrealDB Extra",
		license: "Apache 2.0",
		repository: {
			type: "git",
			url: "https://github.com/soya-miruku/typed-surql.git",
		},
		author: {
			name: "Soya Miruku",
			url: "",
		},
		dependencies: {
			"@sinclair/typebox": "^0.31.28",
			"surrealdb.js": "latest",
			"reflect-metadata": "0.1.13",
			"core-js": "^3.33.3",
			"unws": "^0.2.3",
			"ws": "^8.13.0",
		},
		devDependencies: {
			"@types/node": "^18.7.18",
			"@types/ws": "8.5.3",
			"type-fest": "latest"
		},
		scripts: {
			"build": "esbuild ./esm/index.js --format=esm --minify --bundle --sourcemap --outfile=./dist/index.js",
		},
	},
	// mappings: { "./src/library/WebSocket/deno.ts": "./src/library/WebSocket/node.ts" },
	compilerOptions: {
		lib: ["ESNext", "DOM"],
		sourceMap: true,
	},
});

// post build steps
Deno.copyFileSync(".npmrc", "npm/.npmrc");