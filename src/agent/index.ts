/**
 * GhostName agent service layer: deterministic, read-only, transport-free.
 *
 * Consumed by the MCP server, the CLI and the web app. Nothing here imports
 * React, a transport, a wallet, or any signing or write path; tests enforce
 * that boundary over the whole transitive import graph.
 */
export * from './types';
export * from './findings';
export * from './sanitize';
export * from './canonicalReport';
export * from './chains';
export * from './recommendations';
export * from './auditForAgent';
export * from './upgradePlan';
export * from './reaudit';
export * from './verify';
