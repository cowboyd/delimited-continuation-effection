# Effection V4 prototype

There are a number of improvements that we would like to make to Effection that
are not possible with the current architecture.

1. Seamless stack traces for error boundaries
2. finer grained control over task, effect, and context encapsulation.
3. Performance improvements.

This spike attempts to make these improvements possible by migrating from the
[Frontside Continuation Library](https://github.com/thefrontside/continuation)
to an integrated zero-dependency solution. It has these features.

## Fine Grained Control

In e3, flow control and task encapsulation are all coupled directly to the
`Frame` object. In other words, in order to trap an error, you had to use
`call()` or `action()` which created a `Frame` internally, and also a new
iterator, and also reset your stack traces. Now, if you want to establish an
error boundary, you can use the `trap()` function which will route any error
that happens to be percolating upwards, even if it was thrown from a spawned
task:

```ts
await main(function* () {
  try {
    yield* trap(function* () {
      yield* spawn(function* () {
        throw new Error("Boom!");
      });
      yield* suspend();
    });
  } catch (error) {
    console.log("gotcha!", error);
  }
});
```

This will catch the error at the expected point, but it all happens inside the
single iterator, and so stack traces are preserved.

By the same token, tasks boundaries can be established around which no
concurrent tasks can escape

```ts
await main(function* () {
  yield* encapsulate(function* () {
    yield* spawn(function* () {
      try {
        yield* suspend();
      } finally {
        console.log("bye now!");
      }
    });
    yield* sleep(100);
  });

  console.log("done.");
});
```

prints:

```
bye now!
done.
```

Maybe we need to rename these functions? I'm open to that.

## Single Reduction loop

In Effection 3.0, there is one reduction queue per `Frame`, or rather each
iterator gets its own queue. This allows for some non-determenism in the sense
that there is not an absolute order of execution. In this branch however, every
single operation happens on a single reduction loop (by default). It is a LIFO
priority queue where the priority of an operation is determined by the
"generation" of its scope. The entry point scope is generation 1, any tasks it
spawns are generation 2, any tasks those set of children spawns is generation 3,
etc.. The main takeaway is that tasks higher up in the tree have a higher
priority than their children (which makes sense from a tree supervision
process), and siblings have an equivalent prority.

Another advantage of this single loop is that there are not nearly as many
runtime structures like event queues and futures necessary for each co-routine
which should improve baseline performance as previous versions were memory hogs.

## Reduced Instruction Set

There is only a single instruction type: Action<T> which can be used to express
anything. Furthermore, it also allows you to add as descriptive string to be
associated with it so that you can see what any give coroutine is currently
waiting for.

## Scope everything

The core primitive in this version of the library really is the `Scope` and the
`Context` which have been enhanced considerably. Also, scope is used to store
the key runtime data structures of Effection itself which means that making an
inspector will be much easier. For example, the scope tree, the task sets, and
even the run loop itself are all stored on the context.

## Observations / Areas for exploration

- This represents a gross simplification in my mind. All but one of the
  run/spawn tests from Effection proper are passing and this is < 700 LOC which
  could be reduced in size.
- The delimiter will tend to add a number of `yield*` to each call to `scoped()`
- iterator hoisting can be accomplished easily by adding iterators to the stack,
  running them to exhaustion, and then popping them off when a `"done""`
  instruction is found.
- string instruction names like "break" and "resume" are used for simplicity,
  but we could achieve some performance gain by using smi enum tags.

## Preserve all() and race() resoures

This is an experimental feature, but `race()` can preserve resources created in
the contestant operation, where scopes can adopt one another.

## TODO

- [ ] `star()` instruction for hoisting iterators
- [ ] preserve resources created in `all()` member operations
