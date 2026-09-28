import type { Catalog } from "../translate";
import { ai } from "./ai";
import { cockpit } from "./cockpit";
import { common } from "./common";
import { decisions } from "./decisions";
import { finance } from "./finance";
import { github } from "./github";
import { ideas } from "./ideas";
import { portfolio } from "./portfolio";
import { problems } from "./problems";
import { projects } from "./projects";
import { research } from "./research";

// One file per area so parallel cards never edit the same catalog file.
export const esAreas = { common, cockpit, ideas, problems, decisions, research, projects, finance, ai, github, portfolio } as const;
export const es: Catalog = Object.assign({}, ...Object.values(esAreas));
