<h1 align="center">typescope</h1>

typescope is a simple library to create type-safe scope validations with built in support for permission strings on both client and server. It supports the following:

- Type safe unions of supported schemas for clients.
- Support for wildcards (both inside the scope tree in which they will be treated as `${string}` and inside validators where they will be treated as all).
- Support for custom strings on descriptions. Useful for internationalisation.
- Support for standard schema V1.

## How do I set this up in my client and server?

Shared between your client and server, you will want a file that contains the tree of scopes. Each object is a namespace (take like `author:member`) and each string is a description which means a full scope (take like `edit: "This will let you edit an author member."` would mean `author:member:edit`). The tree has 2 properties at its root, one for the message if `*` is selected as a scope, one for the tree:

```ts
export default {
    individualScopes: {
        author: {
            member: {
                edit: "This will let you edit an author member.",
            },
        },
    },
    allScopesMessage: "This will give full access to your account.",
} as const;
```

Additionally, typescope supports wildcards within the scopes. A wildcard fragment can include anything non-blank other than `:`. When we use a wildcard, we can do string substitution by using `$N` in the string where `N` is the number of the wildcard:

```ts
export default {
    individualScopes: {
        author: {
            member: {
                edit: "This will let you edit an author member.",
            },
        },
        domain: {
            "*": {
                edit: "This will let you edit $1.",
            },
        },
    },
    allScopesMessage: "This will give full access to your account.",
} as const;
```

In the client, we can get a type union of all the scopes for your client library. To do that, we will use the `AllScopes` helper to turn our tree into a union:

```ts
// We suggest just importing type for size reasons.
import type tree from "your_path_here";
import type { AllScopes } from "typescope";

export type Scopes = AllScopes<typeof tree>;
```

## Scopes Validation

When we take a string array of scopes from the user that they want, we will want to validate that they are okay. We can do this in one of two ways:

1. **Use the exception based method to handle this:** `validateScopes` will return an `AllScopes<typeof tree>[]` if the users scopes are valid, or throw if not:
    ```ts
    let scopes: AllScopes<typeof tree>[];
    try {
        // req.scopes is a string[]
        scopes = validateScopes(tree, req.scopes);
    } catch (e) {
        // do something with e.message
    }
    ```
2. **Use the standard schema V1 adapter:** If you have a standard schema V1 compatible validation library, you can use that with it:
    ```ts
    const validator = createScopesStandardSchema(tree, "Invalid scopes");
    // TODO: Use this validator.
    ```

In both cases, the returned array will only contain the highest permission scopes. For example, if you have `["user:*", "user:get", "user:edit"]`, the returned array will be `["user:*"]`

Checking if a user has a specific permission is trivial:

```ts
const userHas = hasScope("domain:example.com:edit", userScopes);
// ^ boolean
```

## Scope Descriptions

For showing users what risks the scopes have, it might be advantageous to grab formatted descriptions out of the tree. This is very easy to do:

```ts
// allResolves is the description to use if the fragment is a wildcard.
const allResolves = "all";

const descriptions = getScopeDescriptions(tree, "author:member:edit", allResolves);
```

Descriptions is an array because if the scope is a wildcard, it will get all the individual branches it can hit and put them in an array. Otherwise, it will be one item.
