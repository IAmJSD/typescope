import { describe, it, expect, test } from "vitest";
import { validateScopes, hasScope, getScopeDescriptions, createScopesStandardSchema } from "./index";
import type { StandardSchemaV1 } from "@standard-schema/spec";

const testScopesTree = {
    individualScopes: {
        user: {
            read: "Read user data",
            write: "Write user data",
            delete: "Delete user data",
        },
        domain: {
            "*": {
                read: "Read access to $1",
                write: "Write access to $1",
            },
        },
        admin: {
            "*": "Full admin access to $1",
        },
    },
    allScopesMessage: "Full access to everything",
};

describe("validateScopes", () => {
    it("should validate simple scopes", () => {
        const scopes = validateScopes(testScopesTree, ["user:read", "user:write"]);
        expect(scopes).toEqual(["user:read", "user:write"]);
    });

    it("should handle wildcards", () => {
        const scopes = validateScopes(testScopesTree, ["domain:test:read", "domain:prod:read"]);
        expect(scopes).toEqual(["domain:test:read", "domain:prod:read"]);
    });

    it("should collapse wildcards", () => {
        const scopes = validateScopes(testScopesTree, ["domain:test:*"]);
        expect(scopes).toEqual(["domain:test:*"]);
    });

    it("should throw on invalid scopes", () => {
        expect(() => validateScopes<typeof testScopesTree>(testScopesTree, ["invalid:scope"])).toThrow(
            "Scope invalid:scope is not valid because the scope fragment invalid does not exist.",
        );
    });

    it("should throw on invalid input types", () => {
        // @ts-expect-error: Testing invalid input
        expect(() => validateScopes(testScopesTree, "not-an-array")).toThrow("unvalidatedScopes must be an array");

        // @ts-expect-error: Testing invalid input
        expect(() => validateScopes(testScopesTree, [123])).toThrow("unvalidatedScopes must be an array of strings");
    });
});

describe("hasScope", () => {
    it("should check simple scope matches", () => {
        expect(hasScope<typeof testScopesTree>("user:read", ["user:read"])).toBe(true);
        expect(hasScope<typeof testScopesTree>("user:write", ["user:read"])).toBe(false);
    });

    it("should handle wildcards in user scopes", () => {
        expect(hasScope<typeof testScopesTree>("user:read", ["user:*"])).toBe(true);
        expect(hasScope<typeof testScopesTree>("domain:test:read", ["domain:*"])).toBe(true);
    });

    it("should handle wildcards in requested scope", () => {
        expect(hasScope<typeof testScopesTree>("domain:*", ["domain:test:read"])).toBe(true);
        expect(hasScope<typeof testScopesTree>("user:*", ["domain:test:read"])).toBe(false);
        expect(hasScope<typeof testScopesTree>("*", ["user:read"])).toBe(true);
    });

    it("should throw on invalid input types", () => {
        // @ts-expect-error: Testing invalid input
        expect(() => hasScope<typeof testScopesTree>("scope", "not-an-array")).toThrow("userScopes must be an array");

        // @ts-expect-error: Testing invalid input
        expect(() => hasScope<typeof testScopesTree>(123, ["scope"])).toThrow("scope must be a string");

        // @ts-expect-error: Testing invalid input
        expect(() => hasScope<typeof testScopesTree>("scope", [123])).toThrow("userScopes must be an array of strings");
    });
});

describe("getScopeDescriptions", () => {
    it("should get simple scope descriptions", () => {
        const descriptions = getScopeDescriptions<typeof testScopesTree>(testScopesTree, "user:read", "ALL");
        expect(descriptions).toEqual(["Read user data"]);
    });

    it("should handle wildcards with replacements", () => {
        const descriptions = getScopeDescriptions<typeof testScopesTree>(testScopesTree, "domain:test:read", "ALL");
        expect(descriptions).toEqual(["Read access to test"]);
    });

    it("should handle all scopes wildcard", () => {
        const descriptions = getScopeDescriptions<typeof testScopesTree>(testScopesTree, "*", "ALL");
        expect(descriptions).toEqual("Full access to everything");
    });

    it("should throw on invalid scopes", () => {
        // @ts-expect-error: Testing invalid input
        expect(() => getScopeDescriptions(testScopesTree, "invalid:scope", "all")).toThrow(
            "Scope invalid:scope is not valid because the scope fragment invalid does not exist.",
        );
    });

    it("should throw on invalid input types", () => {
        // @ts-expect-error: Testing invalid input
        expect(() => getScopeDescriptions(testScopesTree, 123, "all")).toThrow("scope must be a string");
    });
});

function validateInput(schema: StandardSchemaV1, data: unknown) {
    const result = schema["~standard"].validate(data);
    if (result instanceof Promise) {
        throw new TypeError("Schema validation must be synchronous");
    }
    if (result.issues) {
        throw new Error(JSON.stringify(result.issues, null, 2));
    }
    return result.value;
}

describe("createScopesStandardSchema", () => {
    it("should create a standard schema", () => {
        const schema = createScopesStandardSchema(testScopesTree, "Scopes error");
        const parsed = validateInput(schema, [
            "user:read",
            "domain:test:read",
            "domain:*",
            "domain:prod:read",
            "admin:*",
        ]);
        expect(parsed).toEqual(["admin:*", "domain:*", "user:read"]);
    });
});

test("integration test", () => {
    const scopes = validateScopes(testScopesTree, [
        "user:read",
        "domain:test:read",
        "domain:*",
        "domain:prod:read",
        "admin:*",
    ]);
    expect(scopes).toEqual(["admin:*", "domain:*", "user:read"]);
    const descriptions = getScopeDescriptions<typeof testScopesTree>(testScopesTree, "domain:*", "ALL");
    expect(descriptions).toEqual(["Read access to ALL", "Write access to ALL"]);
    expect(hasScope<typeof testScopesTree>("domain:*", scopes)).toBe(true);
    expect(hasScope<typeof testScopesTree>("user:*", scopes)).toBe(true);
    expect(hasScope<typeof testScopesTree>("*", scopes)).toBe(true);
    expect(hasScope<typeof testScopesTree>("user:write", scopes)).toBe(false);
});
