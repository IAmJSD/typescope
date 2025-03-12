export function validateScopes(scopesTree, unvalidatedScopes) {
    if (!Array.isArray(unvalidatedScopes)) {
        throw new Error("unvalidatedScopes must be an array");
    }
    if (!unvalidatedScopes.every((scope) => typeof scope === "string")) {
        throw new Error("unvalidatedScopes must be an array of strings");
    }

    const scopes = [];
    for (const scope of unvalidatedScopes.slice().sort((a, b) => a.length - b.length)) {
        const scopeFragments = scope.split(":");
        let currentScope = scopesTree.individualScopes;
        let currentScopeFragment = scopeFragments.shift();
        let allScopeBitsThusFar = "";
        while (currentScopeFragment) {
            if (currentScopeFragment === "*") {
                // If this is a wildcard, it is valid because it means "everything in this branch".
                scopes.push(scope);
                break;
            }

            allScopeBitsThusFar += `${allScopeBitsThusFar ? ":" : ""}${currentScopeFragment}`;
            if (scopes.includes(allScopeBitsThusFar + ":*")) {
                // Do not include this scope because it is already included by the other wildcard.
                break;
            }

            currentScope = currentScope[currentScopeFragment] || currentScope["*"];
            if (typeof currentScope === "string") {
                // This is a leaf. Check there are no more scope fragments.
                if (scopeFragments.length > 0) {
                    // There are more scope fragments, so this is not a valid scope.
                    throw new Error(
                        `Scope ${scope} is not valid because it hit a leaf and there are more scope fragments.`,
                    );
                }
                scopes.push(scope);
                break;
            }

            if (!currentScope) {
                // This is not a valid scope because the current scope fragment does not exist.
                throw new Error(
                    `Scope ${scope} is not valid because the scope fragment ${currentScopeFragment} does not exist.`,
                );
            }

            currentScopeFragment = scopeFragments.shift();
        }
    }

    return scopes;
}

export function hasScope(scope, userScopes) {
    if (!Array.isArray(userScopes)) {
        throw new Error("userScopes must be an array");
    }
    if (!userScopes.every((scope) => typeof scope === "string")) {
        throw new Error("userScopes must be an array of strings");
    }
    if (typeof scope !== "string") {
        throw new Error("scope must be a string");
    }

    const wantedFragments = scope.split(":");
    for (const potentialScope of userScopes) {
        const fragments = potentialScope.split(":");
        let i = 0;
        for (; i < wantedFragments.length; i++) {
            const wantedFragment = wantedFragments[i];
            if (wantedFragment === "*") {
                // Whatever this is, it is valid.
                continue;
            }

            const fragment = fragments[i];
            if (fragment === "*") {
                // This fragment is a wildcard! This is valid.
                return true;
            }
            if (wantedFragment !== fragment) {
                // This fragment is not valid.
                break;
            }
        }
        if (i === wantedFragments.length) {
            // This is a valid scope. If it was invalid, it would have
            // broken out of the loop before this increment could be hit.
            return true;
        }
    }

    return false;
}

function renderDescription(description, wildcardResolves) {
    if (wildcardResolves.length === 0) {
        return description;
    }

    return description.replace(/\$\d+/g, (match) => {
        const index = parseInt(match.slice(1)) - 1;
        return wildcardResolves[index];
    });
}

function resolveAllDescriptions(scopesTree, wildcardResolves, descriptions, allResolve) {
    for (const key in scopesTree) {
        const value = scopesTree[key];
        if (typeof value === "string") {
            descriptions.push(renderDescription(value, wildcardResolves));
            continue;
        }

        wildcardResolves.push(key === "*" ? allResolve : key);
        resolveAllDescriptions(value, wildcardResolves, descriptions, allResolve);
        wildcardResolves.pop();
    }
}

export function getScopeDescriptions(scopesTree, scope, allResolve) {
    if (typeof scope !== "string") {
        throw new Error("scope must be a string");
    }

    if (scope === "*") {
        return scopesTree.allScopesMessage;
    }

    const descriptions = [];
    const fragments = scope.split(":");
    let currentScope = scopesTree.individualScopes;
    const wildcardResolves = [];
    for (const fragment of fragments) {
        if (fragment === "*") {
            // This is a wildcard our side.
            wildcardResolves.push(allResolve);
            resolveAllDescriptions(currentScope, wildcardResolves, descriptions, allResolve);
            break;
        }

        const sbak = currentScope;
        currentScope = sbak[fragment];
        if (!currentScope) {
            currentScope = sbak["*"];
            if (currentScope) {
                // The actual fragment is matching to a wildcard. We should push this as a resolve.
                wildcardResolves.push(fragment);
            }
        }

        if (!currentScope) {
            // This is not a valid scope because the current scope fragment does not exist.
            throw new Error(`Scope ${scope} is not valid because the scope fragment ${fragment} does not exist.`);
        }

        if (typeof currentScope === "string") {
            descriptions.push(renderDescription(currentScope, wildcardResolves));
            break;
        }
    }

    return descriptions;
}

export function createScopesStandardSchema(scopesTree, message = "Invalid scopes") {
    return {
        type: "scopes",
        message,
        "~standard": {
            version: 1,
            vendor: "typescope",
            validate(value) {
                try {
                    value = validateScopes(scopesTree, value);
                    return { value };
                } catch {
                    return {
                        issues: [{ message }],
                    };
                }
            },
        },
    };
}
