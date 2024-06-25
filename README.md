# Sparse Iterator, Sparse Loop Effection

There are a number of improvements that we would like to make to Effection that are not possible with the current architecture.

1. Seamless stack traces for error boundaries
2. Performance improvements.

This spike attempts to make these improvements possible by migrating from the [FrontSide Continuation Library](https://github.com/thefrontside/continuation) to an integrated zero-dependency solution. It has these features.

## Single Reduction loop

In Effection 3.0, there is one reduction queue per `Frame`, or rather each iterator gets its own queue. This allows for some non-determenism in the sense that there is not an absolute order of execution. In this branch however, every entry point creates a unique run loop (reducer) which every operation run within this will share.

This also means not nearly as many runtime structures like event queues and futures which should improve baseline performance as previous versions were memory hogs.

## Operation Delimiters

This introduces the idea of "delimiters" or stateful objects that exist at a specified point in a stack of operations and effect how those operations run. Delimiters are the things that handle the instructions that are yielded by an operation during its execution. Any delimiter can be wrapped around any operation with the `delimit()` function which takes a delimiter, and an operation and returns an operation.


```
         ║                         
┌────────╬────────┐◁──Delimiter────
│        ║        │                
│┌───────╬───────┐◁──Delimiter──── 
││       ▼       ││                
││  ┌─────────┐  ││                
││  │Operation│  ││                
││  │    A    │  ││                
││  └─────────┘  ││                
││       ║       ││                
││       ▼       ││                
││  ┌─────────┐  ││                
││  │Operation│  ││                
││  │    B    │  ││                
││  └─────────┘  ││                
││       ║       ││                
││┌──────╬──────┐◁┼─Delimiter────  
│││      ▼      │││                
│││ ┌─────────┐ │││                
│││ │Operation│ │││                
│││ │    C    │ │││                
│││ └─────────┘ │││                
         ║                         
         ║                         
         ║                         
         ▼                         
```

## Spawn Delimiter

This _greatly_ simplifies how structured concurrency works since the mechanisms themselves are implemented as operations. For example, check out the `spawn()` delimiter which can be used in its raw form like this:

```ts
yield* delimit(spawnScope(), function*() {
  let one = yield* spawn(function*() {
    yield* sleep(100);
    console.log('yawn one');
  });
  
  let one = yield* spawn(function*() {
    yield* sleep(300);
    console.log('yawn two');
  });
  
  yield* sleep(200);
});
```

All of the tasks created with in the delimitation are destroyed at the
end of it which means that the second task is never allowed to
complete.

The key points of the implementation are as follows.

```ts
export function spawnScope(): Delimiter<() => Operation<unknown>> {
  // setup set of tasks at a specific point in the stack.
  let tasks = new Set<Task<unknown>>();
  return {
    name: "@effection/spawn",

    // handle spawns that happen within the scope of this delimiter
    handle(instruction, routine) {
      // create the child task and routine and add it to the task list
      let [task, childRoutine] = createChildTask(instruction, routine);
      tasks.add(task);
	  
      // continue the routine with the reference to the task
      reduce(routine, Resume(Ok(task)));
	  
      // continue the childRoutine to begin task execution
      reduce(childRoutine, Resume(Ok()));
    },

    // delimit a specified operation
    *delimit(operation) {
      try {
        // run the operation
        return yield* operation();
      } finally {
        // destroy all tasks in the set
        while (tasks.size) {
          for (let task of [...tasks].reverse()) {
            tasks.delete(task);
            yield* task.halt();
          }
        }
      }
    },
  }
}
```

This combination of allowing us to store state at a specific point in the call stack and then perform operations before and after is incredibly powerful. This is because there is _no concept of an absolute instruction set_. Instead, the instructions are simply those which have delimiters on the stack which are set up to handle them.

## Control Delimiter

We can see this in action by the fact that the iterator control itself is implemented as a delimiter. This allows us to localize control to a specific scope and associate an "exit" state with it, and this is how catching errors thrown externally to the iterator is achieved. When a spawned task within a control scope crashes it issues a "break" instruction with associated error on its parent. This instruction calls `return()` on the iterator, but also sets the exit state for the delimiter. Just before the delimiter is done, it throws the error inside the current iterator.

Again, we have a state that is associated with a very specific point in the call stack and we can act upon with handlers during execution, and then also take actions at the boundaries.

A halt is just a "break" instruction without an associated error.

## Scoped

The `scoped()` function we've been discussing then becomes a simple composition of delimiters:

```ts
function scoped<T>(op: () => Operation<T>): Operation<T> {
  return delimit(controlScope(), () => delimit(spawnScope(), op));
}
```

## Observations / Areas for exploration

- This represents a gross simplification in my mind. All but one of the run/spawn tests from Effection proper are passing and this is < 700 LOC which could be reduced in size.
- The delimiter will tend to add a number of `yield*` to each call to `scoped()`
- iterator hoisting can be accomplished easily by adding iterators to the stack, running them to exhaustion, and then popping them off when a `"done""` instruction is found.
- string instruction names like "break" and "resume" are used for simplicity, but we could achieve some performance gain by using smi enum tags.

## TODO

- [ ] clean up task implemenation 
- [ ] resource delimiter
- [ ] `star()` instruction for hoisting iterators
