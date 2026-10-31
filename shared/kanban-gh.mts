// The Kanban over `gh`: thin calls beside the decisions of kanban.mts. A failed call throws; no write is best effort.
// `gh project` and the GraphQL project fields need a classic token with `project`, `read:org`, `read:discussion`.

import { z } from "zod";
import { toStatus, type Board, type Kanban, type Status } from "./kanban.mjs";
import { sh, shIn } from "./shell.mjs";
import type { Repo } from "./workspace.mjs";

const BOARD_QUERY = `query($owner: String!, $number: Int!) {
  repositoryOwner(login: $owner) { ... on ProjectV2Owner { projectV2(number: $number) {
    id
    field(name: "Status") { ... on ProjectV2SingleSelectField { id options { id name } } }
    workflows(first: 50) { nodes { name enabled } }
  } } }
}`;

const boardSchema = z.object({
  data: z.object({
    repositoryOwner: z.object({
      projectV2: z.object({
        id: z.string(),
        field: z.object({ id: z.string(), options: z.array(z.object({ id: z.string(), name: z.string() })) }),
        workflows: z.object({ nodes: z.array(z.object({ name: z.string(), enabled: z.boolean() })) }),
      }),
    }),
  }),
});

export type BoardRead = Board & { readonly projectId: string; readonly fieldId: string; readonly optionIds: Readonly<Record<string, string>> };

// The Kanban's Status field, options and built-in workflows. Throws when it cannot be read as a Status field.
export const readBoard = (home: Repo, kanban: Kanban): BoardRead => {
  const raw = sh(home.path, "gh", "api", "graphql", "-f", `query=${BOARD_QUERY}`, "-f", `owner=${kanban.owner}`, "-F", `number=${kanban.number}`);
  const { projectV2 } = boardSchema.parse(JSON.parse(raw)).data.repositoryOwner;
  return {
    projectId: projectV2.id,
    fieldId: projectV2.field.id,
    options: projectV2.field.options.map((option) => option.name),
    optionIds: Object.fromEntries(projectV2.field.options.map((option) => [option.name, option.id])),
    workflows: projectV2.workflows.nodes,
  };
};

const ITEM_QUERY = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) { issue(number: $number) { projectItems(first: 50) { nodes {
    project { id }
    fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
  } } } }
}`;

const itemSchema = z.object({
  data: z.object({
    repository: z.object({
      issue: z.object({ projectItems: z.object({ nodes: z.array(z.object({ project: z.object({ id: z.string() }), fieldValueByName: z.object({ name: z.string() }).nullable() })) }) }),
    }),
  }),
});

// The issue's Status on the Kanban; null when it is not on it or has none.
export const readStatus = (home: Repo, board: BoardRead, issue: number): Status | null => {
  const [owner, name] = home.slug.split("/");
  const raw = sh(home.path, "gh", "api", "graphql", "-f", `query=${ITEM_QUERY}`, "-f", `owner=${owner}`, "-f", `name=${name}`, "-F", `number=${issue}`);
  const item = itemSchema.parse(JSON.parse(raw)).data.repository.issue.projectItems.nodes.find((node) => node.project.id === board.projectId);
  const current = item?.fieldValueByName?.name;
  return current === undefined ? null : toStatus(current);
};

// Sets the issue's Status; the issue is added to the Kanban first (adding is an upsert).
export const setStatus = (home: Repo, kanban: Kanban, board: BoardRead, issue: number, status: Status): void => {
  const optionId = board.optionIds[status];
  if (optionId === undefined) throw new Error(`The Kanban has no Status option "${status}".`);
  const added = sh(home.path, "gh", "project", "item-add", `${kanban.number}`, "--owner", kanban.owner, "--url", `https://github.com/${home.slug}/issues/${issue}`, "--format", "json");
  const { id } = z.object({ id: z.string() }).parse(JSON.parse(added));
  sh(home.path, "gh", "project", "item-edit", "--id", id, "--project-id", board.projectId, "--field-id", board.fieldId, "--single-select-option-id", optionId);
};

// Comments on an issue.
export const comment = (home: Repo, issue: number, body: string): void => {
  shIn(home.path, body, "gh", "issue", "comment", `${issue}`, "--repo", home.slug, "--body-file", "-");
};
