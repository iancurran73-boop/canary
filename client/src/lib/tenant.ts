/**
 * tenant.ts
 * Re-export shim so every file in client/src can import the tenant config via
 * the stable alias `@/lib/tenant` rather than fragile relative paths.
 * To rebrand: edit /tenant.config.ts at project root.
 */
export { default } from "../../../tenant.config";
