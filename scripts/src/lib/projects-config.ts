import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";

export interface ProjectEntry {
  path: string;
  name: string;
}

export interface ProjectsConfig {
  projects: ProjectEntry[];
  ignore: string[];
}

export async function loadProjectsConfig(path: string): Promise<ProjectsConfig> {
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      throw new Error(
        `projects.yml not found at ${path}. Copy from scripts/examples/projects.yml`,
      );
    }
    throw err;
  }

  const data = parseYaml(raw) as Partial<ProjectsConfig> | null;
  if (!data || !Array.isArray(data.projects)) {
    throw new Error(`projects.yml: missing or invalid 'projects' array`);
  }
  for (const [i, p] of data.projects.entries()) {
    if (!p?.path || !p?.name) {
      throw new Error(`projects.yml: projects[${i}] missing path or name`);
    }
  }
  return {
    projects: data.projects as ProjectEntry[],
    ignore: data.ignore ?? [],
  };
}
