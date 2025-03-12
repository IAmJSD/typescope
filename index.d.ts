import type { StandardSchemaV1 } from "@standard-schema/spec";

type DoesNotContain<T, U extends string> = T extends `${U}${string}`
    ? false
    : T extends `${string}${U}${string}`
      ? false
      : T extends `${string}${U}`
        ? false
        : true;

type NotEmpty<T extends string> = T extends "" ? never : T;

type ScopeFragment<T extends string> = DoesNotContain<T, " " | ":"> extends true ? NotEmpty<T> : never;

type IndividualScopeTree = {
    [key: ScopeFragment<string>]: IndividualScopeTree | string;
};

/**
 * Defines the scopes tree. Strings are the scope descriptions and the fragments.
 * @example
 * ```ts
 * const scopesTree = {
 *     individualScopes: {
 *         user: {
 *             read: "This will give read access to the user resource.",
 *             write: "This will give write access to the user resource.",
 *         },
 *         domain: {
 *             "*": {
 *                 read: "This will give read access to $1.",
 *                 write: "This will give write access to $1.",
 *             },
 *         },
 *         admin: {
 *             read: "This will give read access to the admin resource.",
 *             write: "This will give write access to the admin resource.",
 *         },
 *     },
 *     allScopesMessage: "This will give full access to your account.",
 * } as const;
 * ```
 */
export type ScopeTree<IndividualScopes extends IndividualScopeTree> = {
    individualScopes: IndividualScopes;
    allScopesMessage: string;
};

type HandleColon<T extends string> = T extends "" ? "" : ":";

type UnwindChildren<T, Unwound extends string, Key extends string> = T extends string
    ? `${Unwound}${HandleColon<Unwound>}${Key}`
    : T extends IndividualScopeTree
      ? Untree<T, `${Unwound}${HandleColon<Unwound>}${Key}`>
      : never;

type Untree<T extends IndividualScopeTree, Unwound extends string> =
    | `${Unwound}${HandleColon<Unwound>}*`
    | {
          [key in keyof T]: key extends "*"
              ? UnwindChildren<T[key], Unwound, ScopeFragment<string>>
              : // @ts-expect-error: This is okay.
                UnwindChildren<T[key], Unwound, key>;
      }[keyof T];

/**
 * Creates a type union of all of the scopes and wildcards in the scopes tree.
 * @example
 * ```ts
 * type Scopes = AllScopes<{
 *     individualScopes: {
 *         "a": {
 *             "b": {
 *                 "c": {
 *                     "*": "hello",
 *                     "d": "world"
 *                 }
 *             }
 *         }
 *     }
 * }>;
 * ^ "*" | "a:*" | "a:b:*" | "a:b:c:*" | `a:b:c:${string}` | "a:b:c:d"
 * ```
 */
export type AllScopes<T extends ScopeTree<any>> = T extends { individualScopes: infer U }
    ? Untree<U extends IndividualScopeTree ? U : never, "">
    : never;

/**
 * Validates a list of scopes against a scopes tree. Returns the list of scopes that are valid and collapses them to the highest level scope.
 * @param scopesTree - The scopes tree to validate against.
 * @param unvalidatedScopes - The list of scopes to validate.
 * @returns The list of scopes that are valid and collapsed to the highest level scope.
 */
export function validateScopes<T extends ScopeTree<any>>(scopesTree: T, unvalidatedScopes: string[]): AllScopes<T>[];

/**
 * Checks if a scope is in a list of scopes or a higher level scope is.
 * @param scope - The scope to check.
 * @param userScopes - The list of scopes to check against.
 * @returns True if the scope is in the list of scopes, false otherwise.
 */
export function hasScope<T extends ScopeTree<any>>(scope: AllScopes<T>, userScopes: AllScopes<T>[]): boolean;

/**
 * Gets the description of a scope.
 * @param scopesTree - The scopes tree to get the description from.
 * @param scope - The scope to get the description from.
 * @param allResolve - The description to use if the fragment is a wildcard.
 * @returns The descriptions of the scope. Can be multiple if the scope is a wildcard.
 */
export function getScopeDescriptions<T extends ScopeTree<any>>(
    scopesTree: T,
    scope: AllScopes<T>,
    allResolve: string,
): string[];

/** Defines the standard schema type for a scopes validator. */
export interface ScopesStandardSchema<T extends ScopeTree<any>> extends StandardSchemaV1<AllScopes<T>[]> {
    type: "scopes";
    message: string;
}

/** Defines a function that creates a standard schema V1 validator for a scopes validator. */
export function createScopesStandardSchema<T extends ScopeTree<any>>(
    scopesTree: T,
    message: string,
): ScopesStandardSchema<T>;
export function createScopesStandardSchema<T extends ScopeTree<any>>(scopesTree: T): ScopesStandardSchema<T>;
