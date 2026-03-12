# Module Template

## Pure Function Module (Preferred)

```typescript
// src/{module-name}.ts

export interface {ModuleName}Input {
	// define typed input
}

export interface {ModuleName}Output {
	// define typed output
}

/** Brief description of what this module does */
export function {functionName}(input: {ModuleName}Input): {ModuleName}Output {
	// Pure transformation — no side effects, no external calls
	// Same input always produces same output
}
```

## Effectful Module (When Side Effects Needed)

```typescript
// src/{module-name}.ts

// Define interface for the external dependency — enables testing via injection
export interface {DependencyName} {
	get<T>(key: string): T | undefined;
	update(key: string, value: unknown, target: number): Thenable<void>;
}

/** Brief description */
export async function {functionName}(
	input: SomeInput,
	dependency: {DependencyName},
	target: number,
): Promise<void> {
	// Side effects go through the injected dependency only
}
```

## Test Template

```typescript
// src/test/unit/{module-name}.test.ts
import * as assert from 'assert';
import { {functionName} } from '../../{module-name}';

suite('{ModuleName}', () => {
	test('should {expected behavior}', () => {
		const result = {functionName}(input);
		assert.strictEqual(result, expected);
	});

	test('should handle edge case', () => {
		const result = {functionName}(edgeInput);
		assert.strictEqual(result, edgeExpected);
	});
});
```
