import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "api";
export default defineRailway(() => {
  const api = service("api", {
    source: github("sevynlabs/trampo"),
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "apps/api/Dockerfile" },
    healthcheck: "/health",
    healthcheckTimeout: 60,
    replicas: { "iad": 1 },
  });

  return project("trampo", {
    variables: { managed: false },
    resources: [api],
  });
});
