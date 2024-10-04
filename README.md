# Sparse Iterator, Sparse Loop Effection

There are a number of improvements that we would like to make to Effection that are not possible with the current architecture.

1. Seamless stack traces for error boundaries
2. Performance improvements.

This spike attempts to make these improvements possible by migrating from the [FrontSide Continuation Library](https://github.com/thefrontside/continuation) to an integrated zero-dependency solution. It has these features.

## Single Reduction loop

In Effection 3.0, there is one reduction queue per `Frame`, or rather each iterator gets its own queue. This allows for some non-determenism in the sense that there is not an absolute order of execution. In this branch however, every entry point creates a unique run loop (reducer) which every operation run within this will share.

This also means not nearly as many runtime structures like event queues and futures which should improve baseline performance as previous versions were memory hogs.

## Reduced Instruction Set

There are only three core instructions: "resume", "break", and "do". This means maximum composability. and it turns out that's all you need.

## Scope everything

The core primitive in this version of the library really is the `Scope` and the `Context` which have been enhanced considerably. Also, scope is used to store the key runtime data structures of Effection itself which means that making an inspector will be much easier.

## Observations / Areas for exploration

- This represents a gross simplification in my mind. All but one of the run/spawn tests from Effection proper are passing and this is < 700 LOC which could be reduced in size.
- The delimiter will tend to add a number of `yield*` to each call to `scoped()`
- iterator hoisting can be accomplished easily by adding iterators to the stack, running them to exhaustion, and then popping them off when a `"done""` instruction is found.
- string instruction names like "break" and "resume" are used for simplicity, but we could achieve some performance gain by using smi enum tags.

## Preserve all() and race() resoures

This is an experimental feature, but `race()` preserves any resources created in the contestant operation, the same may be possible for `all()`

## TODO

- [ ] `star()` instruction for hoisting iterators
- [ ] preserve resources created in `all()` member operations
