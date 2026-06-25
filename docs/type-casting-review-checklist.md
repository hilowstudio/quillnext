# Type Safety Review Checklist

A reviewer-runnable list of type-casting and suppression anti-patterns. Every item is the same underlying move: making a value *read* as a type without anything *verifying* it is that type at runtime.

**The one meta-test that covers all of these:** for any assertion or suppression, ask what would have to be true at runtime for it to be honest, and whether anything in the code establishes that. If you produced the value and the compiler merely lost track, a narrow assertion can be fine. If the value came from outside (network, storage, env, `JSON.parse`, `catch`, user input), an assertion is a wish, and the honest move is to validate.

Items marked ⚠ are the insidious ones that read as principled and slip through review. Spend your time there.

> **Precondition: confirm type-aware linting is on before trusting the automated tells.** Several items below rely on the `@typescript-eslint/no-unsafe-*` family as a backstop. Those rules only run when the config enables type information (`projectService: true` or `parserOptions.project`). If that is off, every `no-unsafe-*` rule is silently inert and the leaks they would catch are invisible to CI. Verify this first; otherwise the tells marked *(needs type-checked lint)* are false reassurance and those items must be checked by hand.

---

## The cast family

- [ ] **`as any`** — the baseline. Disables checking and is contagious: flows through assignments, returns, and property access, weakening inference in files that contain no cast. Tell: grep `\bas any\b`. Fix: let inference work, narrow, or validate.
- [ ] ⚠ **Assertion laundering: `as RealType` over unverified data** — converting `as any` to `as User` reads as a fix but is still an unchecked assertion, and lies harder because the next reader trusts it. Tell: an `as SomeNamedType` directly on the output of `JSON.parse`, `.json()`, a generic, or anything the compiler could not have verified. Fix: validate the boundary, then the type is real.
- [ ] ⚠ **Blind double-cast: `as unknown as T`** — routing through `unknown` defeats all overlap checking, so you can land on a completely unrelated type with no error. Tell: grep `as unknown as`. Fix: when a double-cast is truly unavoidable, route through the narrowest legitimate intermediate (`as Narrow as T`) so a wrong target still trips the overlap check.
- [ ] ⚠ **Cross-variable laundering** — the same move split across lines to evade greps: `const tmp: unknown = x; const y = tmp as T`. Tell: a local typed `unknown` (or `any`) whose only use is to be asserted on the next line. Fix: same as the double-cast; it is one in disguise.
- [ ] **Non-null `!`** — `foo!.bar`, `arr.find(...)!`, `getElementById(...)!`. The same laundering move in one character. Tell: `!` after `.find(`, index access, or DOM lookups, which genuinely can miss. Fix: narrow with a real check first.
- [ ] **Index-signature escape hatch: `[key: string]: any` on a real interface** — added to a genuine interface so arbitrary access stops erroring. Converts a closed, checked type into an open, unchecked one for every consumer. Tell: an index signature whose value type is `any`/`unknown` on an otherwise-named-property interface. Fix: model the real keys, or use a separate `Record` only where dynamic access is genuinely needed.
- [ ] **Casting away `readonly`** — asserting a `readonly` array or `as const` object back to mutable to push to it. Lies about an immutability guarantee other code relies on. Fix: copy into a new mutable value instead of asserting.
- [ ] **Reaching past encapsulation: `(instance as any).privateThing`** — using `any` or bracket access to touch a `private`/`protected` member or a property the closed interface denies. Fix: expose a real method, or question why the access is needed.

## Generics and signatures that disguise

- [ ] ⚠ **Single-appearance generic / `<T = unknown>`** — a type parameter that appears once, driven by caller annotation and satisfied by an `any` body. Relocates the cast to every call site and makes it invisible. Tell: count `T` in the signature. Two or more in linked positions, inferred from a real argument, is honest; exactly one is `as T` in angle brackets. Fix: return the concrete type with a validator, or take a `schema: z.ZodType<T>` argument so `T` is linked and checked.
- [ ] **Soft constraints: `<T extends any>`, `<T extends Record<string, any>>`** — a bound that admits everything is a bound in name only. Tell: `@typescript-eslint/no-unnecessary-type-constraint` flags `extends any`. Fix: constrain to the real shape, or drop the generic.
- [ ] ⚠ **Lying type-predicate guards: `function isUser(x): x is User { return true }`** — *the most insidious item here.* A user-defined guard is an unchecked assertion the compiler trusts completely, and one that checks one field while claiming the whole type is worse than a cast because it is reusable and looks rigorous. Tell: review every `x is T` for whether the body actually proves `T`. Fix: check every required field, or generate the guard from a schema.
- [ ] **Overloads unchecked against an `any` implementation** — declared overloads look precise, but TypeScript never verifies them against an `any`-returning implementation body. Fix: type the implementation so the overloads are actually enforced.

## Wide types used as a soft `any`

- [ ] **`Record<string, any>`** — `any` with a keyboard; every property access is unchecked. Fix: `Record<string, unknown>` and narrow, or a real interface.
- [ ] **`{}`, `object`, `Function`** — `{}` means "anything except null/undefined," not "empty object." `Function` accepts any callable with no signature checking. Fix: `Record<string, never>` is the usual stand-in for empty (imperfect but conventional); a real call signature for functions.
- [ ] **`any` hidden in containers: `any[]`, `Promise<any>`, `Map<string, any>`** — slips review because the `any` is not at top level. Tell: the `no-unsafe-*` rules catch the leak point *(needs type-checked lint)*. Fix: parameterize with the real element type or `unknown`.

## Suppression comments

- [ ] **`@ts-nocheck`** — the file-level nuke: disables type checking for the *entire file*, so every other item on this list can hide below it undetected. Tell: grep `@ts-nocheck`; it belongs at most on generated files. Fix: remove and fix the file, or scope the suppression to the real lines.
- [ ] **`@ts-ignore`** — suppresses the next line with no record of why, and does not self-clean, so it stays silent after the underlying error is gone. Tell: grep `@ts-ignore`. Fix: there is no good reason to prefer it over the expect-error form; replace it.
- [ ] ⚠ **`@ts-expect-error` on a permanent or fixable error** — its virtue is self-cleaning, which only pays off when covering a *temporary upstream bug*. On a permanent gap it never fires and also suppresses any *other* error that later lands on that line. Your `ban-ts-comment` already enforces the description; the human pass is the part lint cannot do: judge whether the error is actually temporary. Fix: keep a tracking link; for permanent gaps prefer a single narrow cast that surfaces unrelated future errors.
- [ ] ⚠ **`eslint-disable` on `no-explicit-any` or the `no-unsafe-*` family** — meta-laundering: suppressing the rules that exist to detect suppression. Tell: grep `eslint-disable` near `no-explicit-any`/`no-unsafe`. Fix: treat each as a real cast to investigate.
- [ ] **Bare `// eslint-disable-next-line` with no rule named** — disables *every* rule on that line, including the type-safety ones, often to silence something unrelated. Tell: a disable directive with nothing after it. Fix: name the specific rule so the others stay live.

## Boundary lies (external data asserted instead of validated)

- [ ] ⚠ **`JSON.parse(x) as T` and `res.json() as T`** — *the highest-volume offender.* Both return `any`; the assertion claims a shape nothing at runtime confirmed. This is where a bad payload becomes a crash three layers downstream. Fix: validate at the boundary with Zod and return the parsed type.
- [ ] **`localStorage.getItem(...) as T`, `process.env.X as SomeType`** — env values are `string | undefined` no matter what you assert; storage can be stale or malformed from a prior app version. Fix: parse/validate, provide defaults, narrow.
- [ ] **`someString as MyEnum` / `as 'a' | 'b'` without a membership check** — URL params, headers, and DB columns asserted into literal unions while the runtime value may not be a member. Fix: narrow with an `includes` check against the known values.
- [ ] **`catch (e)` then `(e as Error).message`** — anything can be thrown, so the cast is unfounded. Tell: keep `useUnknownInCatchVariables` on (default under `strict`) so `e` is `unknown`. Fix: narrow with `instanceof Error` first.

## Honest tools skipped

- [ ] **`as` where `satisfies` belongs** — `const config = {...} as Config` widens and swallows mistakes inside the literal; `satisfies Config` checks the literal without widening it. Tell: `as` on an object literal you author. Fix: switch to `satisfies` (TS 4.9+).
- [ ] **Redundant annotation on a subtype-returning call** — `const x: A = fn()` where `fn` returns `A`. Harmless when types match exactly, but if `fn` later narrows to a subtype of `A`, the annotation silently re-widens it instead of letting the narrower type flow. (An *incompatible* change still errors, so this is the narrow case, not all redundant annotations.) Fix: drop the annotation where the return type already says it.
- [ ] **Implicit `any` return into a typed signature** — a function annotated `: User` whose body returns an `any` expression; TypeScript accepts it silently. Tell: `no-unsafe-return` catches it *(needs type-checked lint)*. Fix: type the body.

---

## Legitimate: do not flag

A review list is only as trusted as its false-positive rate. These are honest and should pass without friction:

- `as const` on literals, and `satisfies T` on authored objects.
- A narrow assertion on a value *you* produced where the compiler lost track (e.g. a discriminated-union member after an exhaustive switch).
- A generic whose `T` appears twice in linked positions and is inferred from a real argument, especially when backed by a validator (`schema.parse`).
- `as unknown as T` *contained in one named, documented helper* with a stated precondition, versus scattered at call sites.
- `@ts-expect-error` with a description and tracking link over a confirmed temporary upstream bug.
- Test-mock casts (`as Partial<X>`, `as unknown as X` on a stub). Low priority; flag only if a mock hides a real signature change.

## The positive toolkit

When you flag something, the honest replacement is almost always one of these: let inference work; narrow with a real type guard whose body proves the type; validate external data at the boundary with Zod and return the parsed type; use `satisfies` for objects you author; route through a narrow intermediate on the rare unavoidable double-cast; reserve `@ts-expect-error` (with description and link) for genuinely temporary upstream bugs.

## Quick grep pass

A first sweep to populate the review, not a gate. Extended regex (`-E`) throughout; **adjust the path** (`src/`, `app/`, `lib/`) to your layout. Single-line greps miss multi-line and cross-variable laundering, so the human read still matters.

```bash
# Casts and suppressions
grep -rnE "\bas any\b" src/
grep -rn  "as unknown as" src/
grep -rnE "@ts-(ignore|nocheck)" src/
grep -rn  "@ts-expect-error" src/                       # judge each: temporary upstream bug, or permanent?
grep -rnE "eslint-disable.*(no-explicit-any|no-unsafe)" src/
grep -rnE "eslint-disable-next-line\s*$" src/           # bare disable, no rule named

# Wide types
grep -rnE "Record<string, ?any>" src/
grep -rnE ": any\[\]|Promise<any>|Map<[^,]*, ?any>" src/
grep -rnE "\[[a-zA-Z]+: string\]: ?any" src/            # index-signature escape hatch

# Boundary lies
grep -rnE "(JSON\.parse\(.*\)|\.json\(\)) as " src/
grep -rnE "(process\.env\.[A-Z_]+|getItem\(.*\)) as " src/

# Guards and predicates worth reading by hand
grep -rnE "\) ?: .+ is " src/                           # every user-defined type predicate
```
