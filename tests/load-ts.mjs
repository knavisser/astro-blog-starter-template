// Node 20 can't run TypeScript on its own. The helpers under test have no
// imports, so compiling one with the project's TypeScript and importing the
// result is all a test needs.
import { readFile } from "node:fs/promises";
import ts from "typescript";

export async function importTs(pathFromRepoRoot) {
	const source = await readFile(new URL(`../${pathFromRepoRoot}`, import.meta.url), "utf8");
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
	});
	return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
