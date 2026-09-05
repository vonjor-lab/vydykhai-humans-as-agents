import { appendFileSync } from "node:fs";
appendFileSync("actions.log", "called\n");
