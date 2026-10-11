import { getIntegrationTestTarget } from "./integration-target";

const target = getIntegrationTestTarget(process.env);

console.info(`Dedicated Convex integration-test target accepted: ${target}`);
console.info("No backend integration suites are registered in B1. B7 adds them.");
