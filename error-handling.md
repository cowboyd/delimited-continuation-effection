## Error Handling in direct stack reduction

The code on this branch reduces iterators directly with structural concurrency
guarantees. One of the goals also is to be able to scope tasks, resources, and
error handling while at the same time preserving the stack trace. What this
means in concrete terms is that we want the ability to delimit tasks, resources,
and errors _without_ creating a new iterator. In Effection v3, you delimit error
boundaries with `call()`

```ts
await run(function* main() {
  // <- iterator 1

  try {
    yield* call(function* () {
      // <- iterator 2
      yield* spawn(function* timeBomb() {
        // <- iterator 3
        yield* sleep(100);
        throw new Error("boom!");
        // this will resume iterator 1 with throw(error)
      });
      yield* suspend();
    });
  } catch (error) {
    console.error(error);
  }
});
```

However, if we want to do the same with this system, we cannot have the exact
same semantics. This is because there is only a single iterator. Therefore, our
only options are to trigger an immediate exit of that iterator with an error
effectively crashing the task, OR the other option is to "contain" the error by
resuming the iterator with a throw: (the scoped behavior can toggle between
these two options)

```ts
await run(function* main() {
  // <- iterator 1
  try {
    yield* scoped(function* () {
      // <- ALSO iterator 1
      yield* spawn(function* timeBomb() {
        // <- iterator 2
        yield* sleep(100);
        throw new Error("boom!");
        // should we resume iterator 1 with throw(error) ?
      });
      yield* suspend(); // if so exception will be raised here.
    });
  } catch (error) {
    console.error(error);
  }
});
```

This does have the desired behavior of establishing an error boundary, but only
really by coincidence, because the error is being raised from _within_ the
`scoped()` and then percolating outwards because the `scoped()` operation and
the `main()` operation share the same iterator. For example, we could actually
catch the error inside the `scoped()` operation:

```ts
await run(function* main() {
  // <- iterator 1
  yield* scoped(function* () {
    // <- ALSO iterator 1
    yield* spawn(function* timeBomb() {
      // <- iterator 2
      yield* sleep(100);
      throw new Error("boom!");
    });
    try {
      yield* suspend();
    } catch (error) {
      // This catch block IS in iterator 1, so it works
      console.error(error);
    }
  });
});
```

The two previous examples are equivalent, which begs the question, is it
desirable to toggle between these two behaviors? It seems like the real options
are:

### Always allow catching spawned errors from suspended code.

In other words, a failed concurrent task always resumes its parent with a
`throw()` options. Among other things, this would allow a very concise way to
write a supervisor:

```ts
function* run() {
  // spawn 10 servers. If one of them fails, restart them all.
  while (true) {
    let tasks = yield* spawnServers();
    try {
      yield* suspend();
    } catch (error) {
      console.log("error detected, restarting...", error);
      for (let task of tasks) {
        yield* task.halt();
      }
    }
  }
}
```

However, this does leave you open to the possibility of things like corrupted
resources, and how do you handle that?

```ts
function* run() {
  let socket = yield* useWebSocket("wss://my-connection.com");

  try {
    yield* suspend();
  } catch (error) {
    console.error(error);
  }

  yield* socket.send(); //what is the state of the socket?
}
```

Pp This was the reason that we decided from v2 onward that an error in
concurrent tasks and resources was a hard crash.

### Add a separate operation which _does_ creates a new iterator.

This could be something like `protect()` which _does_ create a new iterator and
establish an error boundary similar to v3. This would be completely separate
from the `scoped()` operation which only delimits concurrency.
